# ── Environment ──────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

# ── Naming ──────────────────────────────────────────────────
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "aegisvault"
}

variable "release_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

# ── Container Apps ──────────────────────────────────────────
variable "api_cpu" {
  description = "CPU cores for the API container app (0.5 = half core)"
  type        = number
  default     = 0.5
}

variable "api_memory" {
  description = "Memory in Gi for the API container app"
  type        = string
  default     = "1.0Gi"
}

variable "api_count" {
  description = "Min replicas for API (max = 2x min for auto-scale)"
  type        = number
  default     = 1
}

variable "worker_cpu" {
  type    = number
  default = 0.25
}

variable "worker_memory" {
  type    = string
  default = "0.5Gi"
}

variable "worker_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 0.25
}

variable "web_memory" {
  type    = string
  default = "0.5Gi"
}

variable "web_count" {
  type    = number
  default = 1
}

# ── PostgreSQL Flexible Server ──────────────────────────────
variable "pg_sku_name" {
  description = "SKU for PostgreSQL Flexible Server"
  type        = string
  default     = "B_Standard_B1ms" # Burstable, 1 vCore, 2 GiB
}

variable "pg_storage_mb" {
  description = "Storage in MB for PostgreSQL"
  type        = number
  default     = 32768 # 32 GiB
}

variable "pg_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "aegis"
}

# ── Redis Cache ─────────────────────────────────────────────
variable "redis_sku" {
  description = "Redis Cache SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Basic"
}

variable "redis_family" {
  description = "Redis Cache family (C = standard)"
  type        = string
  default     = "C"
}

variable "redis_capacity" {
  description = "Redis Cache capacity (0 = 250 MB)"
  type        = number
  default     = 0
}

# ── Secrets ─────────────────────────────────────────────────
variable "session_secret" {
  description = "Session signing secret"
  type        = string
  sensitive   = true
  default     = ""
}
