terraform {
  required_version = ">= 1.10.0"
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4, < 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "auto_wake" {
  source = "../../modules/auto-wake"

  name_prefix                 = var.name_prefix
  environment                 = "production"
  artifact_bucket_name        = var.artifact_bucket_name
  artifact_bucket_arn         = var.artifact_bucket_arn
  artifact_key                = "releases/production-approved.zip"
  terraform_state_bucket_name = var.state_bucket_name
  terraform_state_bucket_arn  = var.state_bucket_arn
  terraform_state_key         = "production/data-plane.tfstate"
  terraform_deploy_role_arn   = var.terraform_deploy_role_arn
  vpc_link_subnet_ids         = var.private_subnet_ids
  vpc_link_security_group_ids = [var.vpc_link_security_group_id]
  tags                        = var.tags
}
