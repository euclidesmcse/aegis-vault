# ── Networking ──────────────────────────────────────────────
output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "VPC ID"
}

output "private_subnet_ids" {
  value       = module.vpc.private_subnets
  description = "Private subnet IDs"
}

output "public_subnet_ids" {
  value       = module.vpc.public_subnets
  description = "Public subnet IDs"
}

# ── Database ────────────────────────────────────────────────
output "db_endpoint" {
  value       = aws_db_instance.main.address
  description = "RDS PostgreSQL endpoint (hostname)"
}

output "db_port" {
  value       = aws_db_instance.main.port
  description = "RDS PostgreSQL port"
}

output "db_name" {
  value       = aws_db_instance.main.db_name
  description = "Database name"
}

# ── Redis ───────────────────────────────────────────────────
output "redis_endpoint" {
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
  description = "ElastiCache Redis endpoint (hostname)"
}

output "redis_port" {
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
  description = "ElastiCache Redis port"
}

# ── Storage ─────────────────────────────────────────────────
output "s3_bucket_name" {
  value       = aws_s3_bucket.vault.id
  description = "S3 bucket name for vault storage"
}

output "s3_bucket_arn" {
  value       = aws_s3_bucket.vault.arn
  description = "S3 bucket ARN"
}

# ── Compute ─────────────────────────────────────────────────
output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "api_service_name" {
  value       = aws_ecs_service.api.name
  description = "API ECS service name"
}

output "web_service_name" {
  value       = aws_ecs_service.web.name
  description = "Web ECS service name"
}

# ── Load Balancer ───────────────────────────────────────────
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB public DNS name"
}

output "alb_arn" {
  value       = aws_lb.main.arn
  description = "ALB ARN"
}

# ── Application URL ─────────────────────────────────────────
output "app_url" {
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
  description = "Application base URL"
}
