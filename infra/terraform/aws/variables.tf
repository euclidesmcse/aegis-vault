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

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

# ── Networking ──────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

# ── Compute ─────────────────────────────────────────────────
variable "api_cpu" {
  description = "CPU units for the API ECS task (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory (MiB) for the API ECS task"
  type        = number
  default     = 1024
}

variable "api_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "worker_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 256
}

variable "web_memory" {
  type    = number
  default = 512
}

variable "web_count" {
  type    = number
  default = 1
}

# ── Database ────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "aegis"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "aegis_admin"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "Allocated storage (GiB) for RDS"
  type        = number
  default     = 20
}

# ── Redis ───────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

# ── Domain ──────────────────────────────────────────────────
variable "domain_name" {
  description = "Public domain name (leave empty to skip Route53 / TLS)"
  type        = string
  default     = ""
}

variable "release_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}
