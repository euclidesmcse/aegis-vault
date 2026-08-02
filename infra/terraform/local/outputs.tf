# ── Endpoints ───────────────────────────────────────────────
output "postgres_host" {
  value       = "localhost"
  description = "PostgreSQL host"
}

output "postgres_port" {
  value       = var.postgres_port
  description = "PostgreSQL port"
}

output "redis_host" {
  value       = "localhost"
  description = "Redis host"
}

output "redis_port" {
  value       = var.redis_port
  description = "Redis port"
}

output "minio_api_url" {
  value       = "http://localhost:9000"
  description = "MinIO S3 API URL"
}

output "minio_console_url" {
  value       = "http://localhost:9001"
  description = "MinIO Web Console URL"
}

output "mailpit_smtp" {
  value       = "localhost:${var.mailpit_smtp_port}"
  description = "Mailpit SMTP endpoint"
}

output "mailpit_ui" {
  value       = "http://localhost:${var.mailpit_ui_port}"
  description = "Mailpit Web UI"
}

output "api_url" {
  value       = "http://localhost:${var.api_port}"
  description = "API base URL"
}

output "web_url" {
  value       = "http://localhost:${var.web_port}"
  description = "Web app URL"
}

# ── Container Names ─────────────────────────────────────────
output "network_name" {
  value       = docker_network.aegis.name
  description = "Docker network name"
}

output "container_names" {
  value = {
    postgres = docker_container.postgres.name
    redis    = docker_container.redis.name
    minio    = docker_container.minio.name
    mailpit  = docker_container.mailpit.name
    api      = docker_container.api.name
    worker   = docker_container.worker.name
    web      = docker_container.web.name
  }
  description = "All container names"
}
