# ═══════════════════════════════════════════════════════════════
# Aegis Vault — Infraestrutura Azure
# Mapeamento Docker Compose → Azure:
#   postgres → PostgreSQL Flexible Server
#   redis    → Azure Cache for Redis
#   minio    → Azure Blob Storage
#   api      → Container Apps (serverless)
#   worker   → Container Apps (background)
#   web      → Container Apps (Next.js)
#   caddy    → Container Apps Ingress + TLS
# ═══════════════════════════════════════════════════════════════

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  pg_password = var.session_secret != "" ? var.session_secret : random_password.pg.result
}

# ── Resource Group ──────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location

  tags = {
    Project     = "aegis-vault"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Log Analytics (required by Container Apps Environment) ──

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = var.environment == "prod" ? 90 : 30

  tags = azurerm_resource_group.main.tags
}

# ── Container Apps Environment ──────────────────────────────

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name_prefix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = azurerm_resource_group.main.tags
}

# ── PostgreSQL Flexible Server ──────────────────────────────

resource "random_password" "pg" {
  length  = 32
  special = true
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${local.name_prefix}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = var.pg_version
  administrator_login    = "aegis_admin"
  administrator_password = local.pg_password

  storage_mb            = var.pg_storage_mb
  sku_name              = var.pg_sku_name
  zone                  = "1"
  backup_retention_days = var.environment == "prod" ? 35 : 7

  # Permite acesso dos Container Apps via subnet delegation
  delegated_subnet_id = azurerm_subnet.container_apps.id

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.main.id
}

# ── Virtual Network (para subnets delegadas) ────────────────

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.0.0.0/16"]

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_subnet" "container_apps" {
  name                 = "snet-containers"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]

  delegation {
    name = "Microsoft.App.environments"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "postgres" {
  name                 = "snet-postgres"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/24"]

  delegation {
    name = "Microsoft.DBforPostgreSQL/flexibleServers"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# ── Private DNS Zone (PostgreSQL) ───────────────────────────

resource "azurerm_private_dns_zone" "postgres" {
  name                = "${azurerm_postgresql_flexible_server.main.name}.private.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name

  depends_on = [azurerm_subnet.postgres]
}

# ── Redis Cache ─────────────────────────────────────────────

resource "azurerm_redis_cache" "main" {
  name                = "redis-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  redis_version       = "6" # 7 ainda nao disponivel em todos os SKUs

  redis_configuration {
    maxmemory_policy = "allkeys-lru"
  }

  tags = azurerm_resource_group.main.tags
}

# ── Storage Account (MinIO → Blob Storage) ──────────────────

resource "azurerm_storage_account" "vault" {
  name                     = "st${var.project_name}${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = var.environment == "prod" ? "GRS" : "LRS"
  min_tls_version          = "TLS1_2"

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_storage_container" "vault" {
  name                  = "vault-data"
  storage_account_name  = azurerm_storage_account.vault.name
  container_access_type = "private"
}

# ── Container Apps ──────────────────────────────────────────

# -- API --
resource "azurerm_container_app" "api" {
  name                         = "ca-api-${local.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = var.api_count
    max_replicas = var.api_count * 2

    container {
      name   = "api"
      image  = "aegis/api:${var.release_tag}"
      cpu    = var.api_cpu
      memory = var.api_memory

      env {
        name  = "NODE_ENV"
        value = var.environment == "prod" ? "production" : "development"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgres://aegis_admin:${local.pg_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.db_name}"
      }
      env {
        name  = "REDIS_URL"
        value = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}/0"
      }
      env {
        name  = "STORAGE_ACCOUNT"
        value = azurerm_storage_account.vault.name
      }
      env {
        name  = "SESSION_SECRET"
        value = local.pg_password
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3001
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = azurerm_resource_group.main.tags
}

# -- Worker --
resource "azurerm_container_app" "worker" {
  name                         = "ca-worker-${local.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = var.worker_count
    max_replicas = var.worker_count

    container {
      name   = "worker"
      image  = "aegis/worker:${var.release_tag}"
      cpu    = var.worker_cpu
      memory = var.worker_memory

      env {
        name  = "NODE_ENV"
        value = var.environment == "prod" ? "production" : "development"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgres://aegis_admin:${local.pg_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.db_name}"
      }
      env {
        name  = "REDIS_URL"
        
