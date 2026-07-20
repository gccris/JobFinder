output "site_url" {
  description = "URL HTTPS estável usada como NEXTAUTH_URL."
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "access_url" {
  description = "Página que cria o cookie assinado do laboratório."
  value       = "${aws_apigatewayv2_api.this.api_endpoint}/access"
}

output "api_id" {
  value = aws_apigatewayv2_api.this.id
}

output "default_route_id" {
  value = aws_apigatewayv2_route.default.id
}

output "wake_integration_id" {
  value = aws_apigatewayv2_integration.router.id
}

output "vpc_link_id" {
  value = aws_apigatewayv2_vpc_link.this.id
}

output "state_table_name" {
  value = aws_dynamodb_table.state.name
}

output "access_secret_arn" {
  value = aws_secretsmanager_secret.access.arn
}

output "codebuild_project_name" {
  value = aws_codebuild_project.orchestrator.name
}
