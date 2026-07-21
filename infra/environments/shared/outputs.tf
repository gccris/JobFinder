output "vpc_id" { value = aws_vpc.this.id }
output "public_subnet_ids" { value = values(aws_subnet.public)[*].id }
output "private_subnet_ids" { value = values(aws_subnet.private)[*].id }
output "database_security_group_id" { value = aws_security_group.database.id }
output "vpc_link_security_group_id" { value = aws_security_group.vpc_link.id }
output "database_endpoint" { value = aws_db_instance.this.address }
output "database_master_secret_arn" { value = aws_db_instance.this.master_user_secret[0].secret_arn }
output "application_secret_arns" { value = { for key, secret in aws_secretsmanager_secret.application : key => secret.arn } }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }
output "artifact_bucket_name" { value = aws_s3_bucket.artifacts.id }
output "artifact_bucket_arn" { value = aws_s3_bucket.artifacts.arn }
output "ecs_task_execution_role_arn" { value = aws_iam_role.ecs_execution.arn }
output "ecs_app_task_role_arn" { value = aws_iam_role.ecs_app.arn }
output "ecs_worker_task_role_arn" { value = aws_iam_role.ecs_worker.arn }
output "terraform_deploy_role_arn" { value = aws_iam_role.auto_wake_deploy.arn }
output "alarm_sns_topic_arn" { value = aws_sns_topic.alarms.arn }
