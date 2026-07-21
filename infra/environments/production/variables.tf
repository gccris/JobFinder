variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas usadas pelo Redis efemero."
  type        = list(string)
}

variable "task_subnet_ids" {
  description = "Subnets com rota para Internet; tasks recebem IPv4 apenas enquanto o ambiente esta ativo."
  type        = list(string)
}

variable "alb_subnet_ids" {
  type = list(string)
}

variable "api_gateway_vpc_link_security_group_id" {
  type = string
}

variable "api_gateway_id" {
  description = "ID da HTTP API criada pelo modulo auto-wake."
  type        = string
}

variable "api_gateway_vpc_link_id" {
  description = "ID do VPC Link criado pelo modulo auto-wake."
  type        = string
}

variable "ecs_task_execution_role_arn" {
  type = string
}

variable "ecs_app_task_role_arn" {
  type = string
}

variable "ecs_worker_task_role_arn" {
  type = string
}

variable "container_image" {
  type = string
}

variable "app_container_port" {
  type    = number
  default = 3000
}

variable "desired_count_app" {
  type    = number
  default = 1
}

variable "desired_count_worker" {
  type    = number
  default = 1
}

variable "database_url_secret_arn" {
  type = string
}

variable "nextauth_secret_arn" {
  type = string
}

variable "auth_google_id_secret_arn" {
  type = string
}

variable "auth_google_secret_secret_arn" {
  type = string
}

variable "smartrecruiters_token_secret_arn" {
  type = string
}

variable "smartrecruiters_api_key_secret_arn" {
  type = string
}

variable "nextauth_url" {
  type = string
}

variable "database_security_group_id" {
  description = "Security group do PostgreSQL persistente criado no state shared."
  type        = string
}

variable "database_port" {
  type    = number
  default = 5432
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "alarm_sns_topic_arn" {
  description = "Topico SNS para alarmes; null cria alarmes sem notificacao."
  type        = string
  default     = null
  nullable    = true
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "sync_source_concurrency" {
  type    = string
  default = "7"
}

variable "sync_company_concurrency" {
  type    = string
  default = "2"
}

variable "sync_http_concurrency" {
  type    = string
  default = "20"
}

variable "sync_db_write_concurrency" {
  type    = string
  default = "4"
}

variable "sync_http_timeout_ms" {
  type    = string
  default = "20000"
}

variable "sync_http_retries" {
  type    = string
  default = "2"
}
