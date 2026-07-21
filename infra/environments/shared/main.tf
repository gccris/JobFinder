terraform {
  required_version = ">= 1.10.0"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  common_tags = merge(var.tags, {
    project     = var.name_prefix
    environment = "shared"
    managed-by  = "terraform"
  })
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_kms_key" "shared" {
  description             = "CMK compartilhada para dados persistentes e mensagens operacionais."
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "shared" {
  name          = "alias/${var.name_prefix}-shared"
  target_key_id = aws_kms_key.shared.key_id
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each = { for index, az in local.availability_zones : az => index }

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, each.value)
  map_public_ip_on_launch = false
  tags                    = merge(local.common_tags, { Name = "${var.name_prefix}-public-${each.key}" })
}

resource "aws_subnet" "private" {
  for_each = { for index, az in local.availability_zones : az => index }

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, each.value + 8)
  tags              = merge(local.common_tags, { Name = "${var.name_prefix}-private-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(local.common_tags, { Name = "${var.name_prefix}-public" })
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "database" {
  name        = "${var.name_prefix}-aurora-sg"
  description = "Sem entrada por padrao; o data plane adiciona regras por task SG."
  vpc_id      = aws_vpc.this.id
  tags        = local.common_tags
}

resource "aws_security_group" "vpc_link" {
  name        = "${var.name_prefix}-vpc-link-sg"
  description = "Origem do API Gateway VPC Link para ALBs internos."
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = local.common_tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-aurora"
  subnet_ids = values(aws_subnet.private)[*].id
  tags       = local.common_tags
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = "${var.name_prefix}-aurora"
  engine                          = "aurora-postgresql"
  engine_version                  = var.aurora_engine_version
  database_name                   = var.database_name
  master_username                 = var.database_master_username
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.shared.arn
  backup_retention_period         = var.database_backup_retention_days
  preferred_backup_window         = "05:00-06:00"
  deletion_protection             = true
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name_prefix}-aurora-final"
  enabled_cloudwatch_logs_exports = ["postgresql"]

  serverlessv2_scaling_configuration {
    min_capacity             = 0
    max_capacity             = 1
    seconds_until_auto_pause = 900
  }

  tags = local.common_tags
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${var.name_prefix}-aurora-writer"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
  tags               = local.common_tags
}

resource "aws_ecr_repository" "app" {
  name                 = var.name_prefix
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Manter as 20 imagens mais recentes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_s3_bucket" "artifacts" {
  bucket = var.artifact_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.shared.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_secretsmanager_secret" "application" {
  for_each = toset([
    "production/database-url",
    "production/nextauth-secret",
    "production/google-client-id",
    "production/google-client-secret",
    "production/smartrecruiters-token",
    "production/smartrecruiters-api-key",
    "staging/database-url",
    "staging/nextauth-secret",
    "staging/google-client-id",
    "staging/google-client-secret",
    "staging/smartrecruiters-token",
    "staging/smartrecruiters-api-key",
  ])

  name                    = "${var.name_prefix}/${each.key}"
  recovery_window_in_days = 7
  description             = "Valor preenchido fora do Terraform."
  tags                    = local.common_tags
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = values(aws_secretsmanager_secret.application)[*].arn
  }
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name   = "read-application-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_secrets.json
}

resource "aws_iam_role" "ecs_app" {
  name               = "${var.name_prefix}-ecs-app"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role" "ecs_worker" {
  name               = "${var.name_prefix}-ecs-worker"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "auto_wake_deploy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:PrincipalArn"
      values = [
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-production-auto-wake-codebuild",
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-staging-auto-wake-codebuild",
      ]
    }
  }
}

resource "aws_iam_role" "auto_wake_deploy" {
  name               = "${var.name_prefix}-auto-wake-deploy"
  assume_role_policy = data.aws_iam_policy_document.auto_wake_deploy_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "auto_wake_deploy" {
  role       = aws_iam_role.auto_wake_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_role_policy" "auto_wake_pass_roles" {
  name = "pass-ecs-roles"
  role = aws_iam_role.auto_wake_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "iam:PassRole"
      Resource = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_app.arn, aws_iam_role.ecs_worker.arn]
    }]
  })
}

resource "aws_sns_topic" "alarms" {
  name              = "${var.name_prefix}-alarms"
  kms_master_key_id = aws_kms_key.shared.arn
  tags              = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.budget_email == null ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.budget_email
}

resource "aws_budgets_budget" "monthly" {
  for_each = toset(["20", "50", "80"])

  name         = "${var.name_prefix}-usd-${each.value}"
  budget_type  = "COST"
  limit_amount = each.value
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = var.budget_email == null ? [] : [var.budget_email]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 80
      threshold_type             = "PERCENTAGE"
      notification_type          = "FORECASTED"
      subscriber_email_addresses = [notification.value]
    }
  }
}
