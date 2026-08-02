# ═══════════════════════════════════════════════════════════════
# Aegis Vault — Infraestrutura Cloud (AWS)
# Mapeamento dos servicos do Docker Compose para recursos cloud:
#   postgres → RDS PostgreSQL
#   redis    → ElastiCache Redis
#   minio    → S3 (nativo, com VPC endpoint)
#   mailpit  → SES (dev: Mailpit em ECS; prod: SES)
#   api      → ECS Fargate (serverless)
#   worker   → ECS Fargate (background)
#   web      → ECS Fargate (Next.js)
#   caddy    → ALB + ACM
# ═══════════════════════════════════════════════════════════════

# ── Networking ──────────────────────────────────────────────

data "aws_availability_zones" "available" {}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "aegis-${var.environment}"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  private_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  public_subnets  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + var.az_count)]

  enable_nat_gateway   = var.environment != "dev"
  single_nat_gateway   = var.environment == "staging"
  enable_dns_hostnames = true

  enable_s3_endpoint = true

  tags = { Name = "aegis-${var.environment}" }
}

# ── Security Groups ─────────────────────────────────────────

resource "aws_security_group" "db" {
  name        = "aegis-${var.environment}-db"
  description = "PostgreSQL access"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis" {
  name        = "aegis-${var.environment}-redis"
  description = "Redis access"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }
}

resource "aws_security_group" "api" {
  name        = "aegis-${var.environment}-api"
  description = "API ECS tasks"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "web" {
  name        = "aegis-${var.environment}-web"
  description = "Web ECS tasks"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "alb" {
  name        = "aegis-${var.environment}-alb"
  description = "Application Load Balancer"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Database (PostgreSQL → RDS) ─────────────────────────────

resource "random_password" "db" {
  length  = 32
  special = false
}

locals {
  db_password = var.db_password != "" ? var.db_password : random_password.db.result
}

resource "aws_db_subnet_group" "main" {
  name       = "aegis-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_db_instance" "main" {
  identifier = "aegis-${var.environment}"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = local.db_password

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 100
  storage_encrypted     = true

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  publicly_accessible    = false
  skip_final_snapshot    = var.environment == "dev"
  backup_retention_period = var.environment == "prod" ? 30 : 7

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = { Name = "aegis-${var.environment}-db" }
}

# ── Cache (Redis → ElastiCache) ─────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "aegis-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_cluster" "main" {
  cluster_id = "aegis-${var.environment}"

  engine         = "redis"
  engine_version = "7"
  node_type      = var.redis_node_type
  num_cache_nodes = 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Name = "aegis-${var.environment}-redis" }
}

# ── Object Storage (MinIO → S3) ─────────────────────────────

resource "aws_s3_bucket" "vault" {
  bucket        = "aegis-vault-${var.environment}-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"

  tags = { Name = "aegis-${var.environment}-vault" }
}

resource "aws_s3_bucket_versioning" "vault" {
  bucket = aws_s3_bucket.vault.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vault" {
  bucket = aws_s3_bucket.vault.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "vault" {
  bucket                  = aws_s3_bucket.vault.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_caller_identity" "current" {}

# ── IAM (ECS Task Execution Role) ───────────────────────────

resource "aws_iam_role" "ecs_task_execution" {
  name = "aegis-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "aegis-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "aegis-${var.environment}-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = [
        aws_s3_bucket.vault.arn,
        "${aws_s3_bucket.vault.arn}/*"
      ]
    }]
  })
}

# ── ECS Cluster ─────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "aegis-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ── ALB (Load Balancer) ─────────────────────────────────────

resource "aws_lb" "main" {
  name               = "aegis-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "api" {
  name        = "aegis-${var.environment}-api"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }
}
