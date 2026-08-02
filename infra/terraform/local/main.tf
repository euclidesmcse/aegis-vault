# ═══════════════════════════════════════════════════════════════
# Aegis Vault — Infraestrutura Local (Docker via Terraform)
# Gerencia os mesmos containers do compose.yaml,
# mas com Terraform para state tracking, drift detection e CI/CD.
# ═══════════════════════════════════════════════════════════════

locals {
  pg_password   = var.postgres_password != "" ? var.postgres_password : random_password.pg.result
  redis_command = var.environment == "prod" ? ["redis-server", "--appendonly", "yes", "--maxmemory", "1gb", "--maxmemory-policy", "allkeys-lru", "--requirepass", var.redis_password] : ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
}

# ── Secrets ─────────────────────────────────────────────────

resource "random_password" "pg" {
  length  = 24
  special = false
}

# ── Network ─────────────────────────────────────────────────

resource "docker_network" "aegis" {
  name   = "aegis-${var.environment}"
  driver = "bridge"
}

# ── Images ──────────────────────────────────────────────────

resource "docker_image" "postgres" {
  name         = "postgres:16-alpine"
  keep_locally = true
}

resource "docker_image" "redis" {
  name         = "redis:7-alpine"
  keep_locally = true
}

resource "docker_image" "minio" {
  name         = "minio/minio:RELEASE.2024-09-13T20-26-02Z"
  keep_locally = true
}

resource "docker_image" "mailpit" {
  name         = "axllent/mailpit:latest"
  keep_locally = true
}

# ── Volumes ─────────────────────────────────────────────────

resource "docker_volume" "pgdata" {
  name = "aegis_${var.environment}_pgdata"
}

resource "docker_volume" "redisdata" {
  name = "aegis_${var.environment}_redisdata"
}

resource "docker_volume" "miniodata" {
  name = "aegis_${var.environment}_miniodata"
}

resource "docker_volume" "maildata" {
  name = "aegis_${var.environment}_maildata"
}

# ── Containers ──────────────────────────────────────────────

# PostgreSQL
resource "docker_container" "postgres" {
  name    = "aegis-${var.environment}-postgres"
  image   = docker_image.postgres.image_id
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  env = [
    "POSTGRES_USER=aegis",
    "POSTGRES_PASSWORD=${local.pg_password}",
    "POSTGRES_DB=aegis"
  ]

  ports {
    internal = 5432
    external = var.postgres_port
    ip       = "127.0.0.1"
  }

  volumes {
    volume_name    = docker_volume.pgdata.name
    container_path = "/var/lib/postgresql/data"
  }

  networks_advanced {
    name = docker_network.aegis.name
  }

  healthcheck {
    test         = ["CMD-SHELL", "pg_isready -U aegis -d aegis"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "10s"
  }
}

# Redis
resource "docker_container" "redis" {
  name    = "aegis-${var.environment}-redis"
  image   = docker_image.redis.image_id
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  command = local.redis_command

  ports {
    internal = 6379
    external = var.redis_port
    ip       = "127.0.0.1"
  }

  volumes {
    volume_name    = docker_volume.redisdata.name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.aegis.name
  }

  healthcheck {
    test         = ["CMD", "redis-cli", "PING"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "5s"
  }
}

# MinIO (S3-compatible object storage)
resource "docker_container" "minio" {
  name    = "aegis-${var.environment}-minio"
  image   = docker_image.minio.image_id
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  command = ["server", "/data", "--console-address", ":9001"]

  env = [
    "MINIO_ROOT_USER=${var.minio_root_user}",
    "MINIO_ROOT_PASSWORD=${var.minio_root_password}"
  ]

  ports {
    internal = 9000
    external = 9000
    ip       = "127.0.0.1"
  }

  ports {
    internal = 9001
    external = 9001
    ip       = "127.0.0.1"
  }

  volumes {
    volume_name    = docker_volume.miniodata.name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.aegis.name
  }

  healthcheck {
    test         = ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval     = "30s"
    timeout      = "10s"
    retries      = 3
    start_period = "5s"
  }
}

# Mailpit (dev email capture)
resource "docker_container" "mailpit" {
  name    = "aegis-${var.environment}-mailpit"
  image   = docker_image.mailpit.image_id
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  ports {
    internal = 1025
    external = var.mailpit_smtp_port
    ip       = "127.0.0.1"
  }

  ports {
    internal = 8025
    external = var.mailpit_ui_port
    ip       = "127.0.0.1"
  }

  volumes {
    volume_name    = docker_volume.maildata.name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.aegis.name
  }
}

# API (Express)
resource "docker_container" "api" {
  name    = "aegis-${var.environment}-api"
  image   = "aegis/api:${var.release_tag}"
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  user = "1000:1000"

  env = [
    "DATABASE_URL=postgres://aegis:${local.pg_password}@aegis-${var.environment}-postgres:5432/aegis",
    "REDIS_URL=redis://aegis-${var.environment}-redis:6379/0",
    "SESSION_SECRET=${var.session_secret}",
    "NODE_ENV=${var.environment == "prod" ? "production" : "development"}"
  ]

  ports {
    internal = 3001
    external = var.api_port
    ip       = "127.0.0.1"
  }

  networks_advanced {
    name = docker_network.aegis.name
  }

  depends_on = [
    docker_container.postgres,
    docker_container.redis
  ]

  healthcheck {
    test         = ["CMD", "wget", "-qO-", "http://localhost:3001/api/v1/health"]
    interval     = "15s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}

# Worker (background jobs)
resource "docker_container" "worker" {
  name    = "aegis-${var.environment}-worker"
  image   = "aegis/worker:${var.release_tag}"
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  user = "1000:1000"

  env = [
    "DATABASE_URL=postgres://aegis:${local.pg_password}@aegis-${var.environment}-postgres:5432/aegis",
    "REDIS_URL=redis://aegis-${var.environment}-redis:6379/0"
  ]

  networks_advanced {
    name = docker_network.aegis.name
  }

  depends_on = [
    docker_container.postgres,
    docker_container.redis
  ]
}

# Web (Next.js)
resource "docker_container" "web" {
  name    = "aegis-${var.environment}-web"
  image   = "aegis/web:${var.release_tag}"
  restart = var.environment == "prod" ? "always" : "unless-stopped"

  user = "1000:1000"

  env = [
    "NEXT_PUBLIC_API_BASE=http://aegis-${var.environment}-api:3001/api/v1",
    "NODE_ENV=${var.environment == "prod" ? "production" : "development"}"
  ]

  ports {
    internal = 3000
    external = var.web_port
  }

  networks_advanced {
    name = docker_network.aegis.name
  }

  depends_on = [
    docker_container.api
  ]

  healthcheck {
    test         = ["CMD", "wget", "-qO-", "http://localhost:3000/"]
    interval     = "15s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}
