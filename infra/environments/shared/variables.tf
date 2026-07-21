variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "jobhub"
}

variable "state_bucket_name" {
  type = string
}

variable "artifact_bucket_name" {
  description = "Nome globalmente unico para releases e backups exportados."
  type        = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "postgres_engine_version" {
  type    = string
  default = "16.3"
}

variable "database_instance_class" {
  description = "Classe pequena para laboratorio em conta AWS Free Plan."
  type        = string
  default     = "db.t4g.micro"
}

variable "database_allocated_storage" {
  description = "Armazenamento inicial em GiB para PostgreSQL."
  type        = number
  default     = 20
}

variable "database_name" {
  type    = string
  default = "job_aggregator"
}

variable "database_master_username" {
  type    = string
  default = "jobadmin"
}

variable "database_backup_retention_days" {
  description = "Dias de retencao de backup do PostgreSQL. Use 1 para contas AWS Free Plan."
  type        = number
  default     = 1
}

variable "budget_email" {
  type      = string
  default   = null
  nullable  = true
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
