# ── Resource Group ──────────────────────────────────────────
output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Azure Resource Group name"
}

output "resource_group_location" {
  value       = azurerm_resource_group.main.location
  description = "Azure region"
}

# ── Database ────────────────────────────────────────────────
output "db_fqdn" {
  value       = azurerm_postgresql_flexible_server.main.fqdn
  description = "PostgreSQL Flexible Server FQDN"
}

output "db_name" {
  value       = azurerm_postgresql_flexible_server_database.main.name
  description = "Database name"
}

# ── Redis ───────────────────────────────────────────────────
output "redis_hostname" {
  value       = azurerm_redis_cache.main.hostname
  description = "Redis Cache hostname"
}

output "redis_ssl_port" {
  value       = azurerm_redis_cache.main.ssl_port
  description = "Redis Cache SSL port (6380)"
}

output "redis_primary_key" {
  value       = azurerm_redis_cache.main.primary_access_key
  description = "Redis Cache primary access key"
  sensitive   = true
}

# ── Container Apps ──────────────────────────────────────────
output "container_app_env_name" {
  value       = azurerm_container_app_environment.main.name
  description = "Container Apps Environment name"
}

output "api_fqdn" {
  value       = azurerm_container_app.api.ingress[0].fqdn
  description = "API Container App FQDN"
}

output "web_fqdn" {
  value       = azurerm_container_app.web.ingress[0].fqdn
  description = "Web Container App FQDN"
}

# ── URLs ────────────────────────────────────────────────────
output "app_url" {
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
  description = "Application base URL"
}
