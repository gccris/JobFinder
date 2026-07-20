output "api_gateway_integration_id" {
  description = "Integracao privada que o auto-wake conecta a rota default."
  value       = aws_apigatewayv2_integration.app.id
}

output "load_balancer_dimension" {
  description = "Sufixo usado pela metrica AWS/ApplicationELB/RequestCount."
  value       = aws_lb.internal.arn_suffix
}

output "target_group_arn" {
  value = aws_lb_target_group.app.arn
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "ecs_service_names" {
  value = [
    aws_ecs_service.app.name,
    aws_ecs_service.worker.name,
  ]
}

output "sleep_check_task_definition_arn" {
  description = "Usa a task web enquanto voce ainda nao separou uma task especifica de verificacao."
  value       = aws_ecs_task_definition.app.arn
}

output "sleep_check_container_name" {
  value = local.app_container_name
}

output "sleep_check_subnet_ids" {
  value = var.task_subnet_ids
}

output "sleep_check_security_group_ids" {
  value = [aws_security_group.app.id]
}

output "migration_task_definition_arn" {
  value = aws_ecs_task_definition.migration.arn
}

output "migration_container_name" {
  value = "migration"
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}
