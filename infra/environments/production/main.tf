terraform {
  required_version = ">= 1.6.0"

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

locals {
  base_name             = "${var.name_prefix}-${var.environment}"
  app_container_name    = "app"
  worker_container_name = "worker"
  alarm_actions         = var.alarm_sns_topic_arn == null ? [] : [var.alarm_sns_topic_arn]
  common_tags = {
    Environment = var.environment
    Project     = var.name_prefix
    ManagedBy   = "terraform"
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${local.base_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_security_group" "alb" {
  name        = "${local.base_name}-alb-sg"
  description = "Recebe trafego do VPC Link e envia para o app."
  vpc_id      = var.vpc_id

  tags = local.common_tags
}

resource "aws_security_group" "app" {
  name        = "${local.base_name}-app-sg"
  description = "Recebe trafego apenas do ALB e sai para dependencias."
  vpc_id      = var.vpc_id

  tags = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "alb_from_vpc_link" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = var.api_gateway_vpc_link_security_group_id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  description                  = "HTTP privado do API Gateway VPC Link."
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.app_container_port
  to_port                      = var.app_container_port
  ip_protocol                  = "tcp"
  description                  = "Encaminhamento do ALB ao app."
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.app_container_port
  to_port                      = var.app_container_port
  ip_protocol                  = "tcp"
  description                  = "Trafego recebido somente do ALB."
}

resource "aws_security_group" "worker" {
  name        = "${local.base_name}-worker-sg"
  description = "Sem entrada publica; sai para banco, redis e fontes externas."
  vpc_id      = var.vpc_id

  tags = local.common_tags
}

resource "aws_security_group" "redis" {
  name        = "${local.base_name}-redis-sg"
  description = "Recebe Redis TLS somente das tasks app e worker."
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id, aws_security_group.worker.id]
  }

  tags = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "app_database" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = var.database_security_group_id
  from_port                    = var.database_port
  to_port                      = var.database_port
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL persistente."
}

resource "aws_vpc_security_group_egress_rule" "worker_database" {
  security_group_id            = aws_security_group.worker.id
  referenced_security_group_id = var.database_security_group_id
  from_port                    = var.database_port
  to_port                      = var.database_port
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL persistente."
}

resource "aws_vpc_security_group_egress_rule" "app_redis" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.redis.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Redis TLS efemero."
}

resource "aws_vpc_security_group_egress_rule" "worker_redis" {
  security_group_id            = aws_security_group.worker.id
  referenced_security_group_id = aws_security_group.redis.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Redis TLS efemero."
}

resource "aws_vpc_security_group_egress_rule" "app_https" {
  #trivy:ignore:AVD-AWS-0104 App precisa sair para endpoints AWS e provedores externos.
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS para APIs externas e AWS endpoints."
}

resource "aws_vpc_security_group_egress_rule" "worker_https" {
  #trivy:ignore:AVD-AWS-0104 Worker consome fontes externas de vagas por HTTPS.
  security_group_id = aws_security_group.worker.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS para fontes externas e AWS endpoints."
}

resource "aws_vpc_security_group_ingress_rule" "database_from_app" {
  security_group_id            = var.database_security_group_id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.database_port
  to_port                      = var.database_port
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL da task app."
}

resource "aws_vpc_security_group_ingress_rule" "database_from_worker" {
  security_group_id            = var.database_security_group_id
  referenced_security_group_id = aws_security_group.worker.id
  from_port                    = var.database_port
  to_port                      = var.database_port
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL da task worker."
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.base_name}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = substr(local.base_name, 0, 40)
  description                = "Fila efemera BullMQ do ${local.base_name}."
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  port                       = 6379
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]
  snapshot_retention_limit   = 0
  apply_immediately          = true

  tags = local.common_tags
}

resource "aws_lb" "internal" {
  name                       = substr(replace("${local.base_name}-alb", "_", "-"), 0, 32)
  internal                   = true
  load_balancer_type         = "application"
  subnets                    = var.alb_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true

  tags = local.common_tags
}

resource "aws_lb_target_group" "app" {
  name        = substr(replace("${local.base_name}-app-tg", "_", "-"), 0, 32)
  port        = var.app_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = "/api/health/ready"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  #trivy:ignore:AVD-AWS-0054 ALB e privado; TLS fica no API Gateway publico.
  load_balancer_arn = aws_lb.internal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_apigatewayv2_integration" "app" {
  api_id                 = var.api_gateway_id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = aws_lb_listener.http.arn
  connection_type        = "VPC_LINK"
  connection_id          = var.api_gateway_vpc_link_id
  payload_format_version = "1.0"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.base_name}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_app_task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.app_container_name
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = var.app_container_port
          hostPort      = var.app_container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "NEXTAUTH_URL", value = var.nextauth_url },
        { name = "AUTH_TRUST_HOST", value = "true" },
        { name = "REDIS_URL", value = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.database_url_secret_arn },
        { name = "NEXTAUTH_SECRET", valueFrom = var.nextauth_secret_arn },
        { name = "AUTH_GOOGLE_ID", valueFrom = var.auth_google_id_secret_arn },
        { name = "AUTH_GOOGLE_SECRET", valueFrom = var.auth_google_secret_secret_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      stopTimeout = 30
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.base_name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_worker_task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.worker_container_name
      image     = var.container_image
      essential = true
      command   = ["node", "--import", "tsx", "scripts/sync-worker.ts"]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "APP_ENVIRONMENT", value = var.environment },
        { name = "REDIS_URL", value = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379" },
        { name = "SYNC_SOURCE_CONCURRENCY", value = var.sync_source_concurrency },
        { name = "SYNC_COMPANY_CONCURRENCY", value = var.sync_company_concurrency },
        { name = "SYNC_HTTP_CONCURRENCY", value = var.sync_http_concurrency },
        { name = "SYNC_DB_WRITE_CONCURRENCY", value = var.sync_db_write_concurrency },
        { name = "SYNC_HTTP_TIMEOUT_MS", value = var.sync_http_timeout_ms },
        { name = "SYNC_HTTP_RETRIES", value = var.sync_http_retries }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.database_url_secret_arn },
        { name = "SMARTRECRUITERS_TOKEN", valueFrom = var.smartrecruiters_token_secret_arn },
        { name = "SMARTRECRUITERS_API_KEY", valueFrom = var.smartrecruiters_api_key_secret_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      stopTimeout = 60
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "migration" {
  family                   = "${local.base_name}-migration"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_app_task_role_arn

  container_definitions = jsonencode([{
    name      = "migration"
    image     = var.container_image
    essential = true
    command   = ["node_modules/.bin/prisma", "migrate", "deploy"]
    environment = [
      { name = "NODE_ENV", value = "production" }
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = var.database_url_secret_arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migration.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
    stopTimeout = 120
  }])

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.base_name}/app"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.base_name}/worker"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "migration" {
  name              = "/ecs/${local.base_name}/migration"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_ecs_service" "app" {
  name            = "${local.base_name}-app"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count_app
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = true
    subnets          = var.task_subnet_ids
    security_groups  = [aws_security_group.app.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = local.app_container_name
    container_port   = var.app_container_port
  }

  depends_on = [aws_lb_listener.http]

  tags = local.common_tags
}

resource "aws_ecs_service" "worker" {
  name            = "${local.base_name}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count_worker
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = true
    subnets          = var.task_subnet_ids
    security_groups  = [aws_security_group.worker.id]
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.base_name}-alb-5xx"
  alarm_description   = "ALB retornou erros 5xx."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.internal.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
  alarm_actions = local.alarm_actions
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "target_latency" {
  alarm_name          = "${local.base_name}-target-latency"
  alarm_description   = "P95 do target acima de 2 segundos."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95.0"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.internal.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
  alarm_actions = local.alarm_actions
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "${local.base_name}-unhealthy-targets"
  alarm_description   = "Nenhum target saudavel no servico web."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions = {
    LoadBalancer = aws_lb.internal.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
  alarm_actions = local.alarm_actions
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "queue_depth" {
  alarm_name          = "${local.base_name}-queue-depth"
  alarm_description   = "Fila de sincronizacao acumulou mais de 50 jobs."
  namespace           = "JobHub"
  metric_name         = "QueueDepth"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 50
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    Environment = var.environment
  }
  alarm_actions = local.alarm_actions
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "oldest_job" {
  alarm_name          = "${local.base_name}-oldest-job"
  alarm_description   = "Job mais antigo aguarda ha mais de 15 minutos."
  namespace           = "JobHub"
  metric_name         = "OldestJobAgeSeconds"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 900
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    Environment = var.environment
  }
  alarm_actions = local.alarm_actions
  tags          = local.common_tags
}
