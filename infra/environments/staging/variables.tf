variable "aws_region" { type = string }
variable "name_prefix" { type = string }
variable "state_bucket_name" { type = string }
variable "state_bucket_arn" { type = string }
variable "artifact_bucket_name" { type = string }
variable "artifact_bucket_arn" { type = string }
variable "terraform_deploy_role_arn" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "vpc_link_security_group_id" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
