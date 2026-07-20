variable "name_prefix" {
  description = "Prefixo curto usado nos nomes dos recursos."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name_prefix))
    error_message = "Use de 3 a 31 caracteres minúsculos, números ou hífens."
  }
}

variable "environment" {
  description = "Ambiente controlado pelo módulo."
  type        = string
  default     = "production"
}

variable "artifact_bucket_name" {
  description = "Bucket que recebe o pacote imutável da release."
  type        = string
}

variable "artifact_bucket_arn" {
  description = "ARN do bucket de artefatos."
  type        = string
}

variable "artifact_key" {
  description = "Chave S3 do zip que contém o Terraform da release aprovada."
  type        = string
}

variable "terraform_root" {
  description = "Diretório do data plane dentro do zip da release."
  type        = string
  default     = "infra/environments/production"
}

variable "terraform_state_bucket_name" {
  description = "Bucket do backend Terraform do data plane."
  type        = string
}

variable "terraform_state_bucket_arn" {
  description = "ARN do bucket do backend Terraform."
  type        = string
}

variable "terraform_state_key" {
  description = "Chave do state do data plane."
  type        = string
  default     = "production/data-plane.tfstate"
}

variable "terraform_deploy_role_arn" {
  description = "Role assumida pelo CodeBuild somente durante apply/destroy."
  type        = string
}

variable "vpc_link_subnet_ids" {
  description = "Subnets privadas usadas pelo VPC Link do API Gateway."
  type        = list(string)
}

variable "vpc_link_security_group_ids" {
  description = "Security groups do VPC Link."
  type        = list(string)
}

variable "terraform_version" {
  description = "Versão fixada do Terraform usada pelo CodeBuild."
  type        = string
  default     = "1.12.2"
}

variable "idle_minutes" {
  description = "Minutos sem requisições antes de tentar o auto-sleep."
  type        = number
  default     = 60

  validation {
    condition     = var.idle_minutes >= 15
    error_message = "idle_minutes precisa ser pelo menos 15."
  }
}

variable "session_ttl_seconds" {
  description = "Validade do cookie assinado do laboratório."
  type        = number
  default     = 2592000
}

variable "check_schedule_expression" {
  description = "Agenda EventBridge que avalia o auto-sleep."
  type        = string
  default     = "rate(15 minutes)"
}

variable "log_retention_days" {
  description = "Retenção econômica dos logs."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
