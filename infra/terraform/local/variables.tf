# ── Environment ──────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
  default     = "dev"
}

# ── Postgres ────────────────────────────────────────────────
variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "postgres_port" {
  description = "PostgreSQL host port"
  type        = number
  default     = 5432
}

# ── Redis ───────────────────────────────────────────────────
variable "redis_password" {
  description = "Redis password (prod only)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "redis_port" {
  description = "Redis host port"
  type        = number
  default     = 6379
}

# ── MinIO ───────────────────────────────────────────────────
variable "minio_root_user" {
  type    = string
  default = "aegis-dev-access"
}

variable "minio_root_password" {
  type      = string
  sensitive = true
  default   = "aegis-dev-secret-change-me"
}

# ── Mailpit ─────────────────────────────────────────────────
variable "mailpit_smtp_port" {
  type    = number
  default = 1025
}

variable "mailpit_ui_port" {
  type    = number
  default = 8025
}

# ── API ─────────────────────────────────────────────────────
variable "api_port" {
  description = "API host port"
  type        = number
  default     = 3001
}

# ── Web ─────────────────────────────────────────────────────
variable "web_port" {
  description = "Web host port"
  type        = number
  default     = 3000
}

variable "release_tag" {
  description = "Image tag to deploy"
  type        = string
  default     = "latest"
}

variable "session_secret" {
  description = "Session signing secret"
  type        = string
  sensitive   = true
  default     = "dev-secret-change-me-in-prod"
}
