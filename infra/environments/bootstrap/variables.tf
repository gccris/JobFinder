variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "jobhub"
}

variable "state_bucket_name" {
  description = "Nome globalmente unico do bucket de state."
  type        = string
}

variable "github_owner" {
  type = string
}

variable "github_repository" {
  type = string
}

variable "github_default_branch" {
  type    = string
  default = "master"
}

variable "tags" {
  type    = map(string)
  default = {}
}
