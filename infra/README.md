# Laboratório Terraform

Este diretório separa o mecanismo de economia, entregue pronto, dos exercícios que devem ser preenchidos manualmente.

## Ordem de execução

1. `environments/bootstrap`
2. `environments/shared`
3. `environments/staging`
4. `environments/production-control`
5. `environments/production` (aplicado sob demanda pelo CodeBuild)

Nunca execute `apply` sem revisar o plan e o custo previsto. Nunca execute `destroy` no state `shared` para desligar o laboratório.

## Contrato do data plane

O root de staging/production precisa exportar:

| Output | Tipo | Uso |
| --- | --- | --- |
| `api_gateway_integration_id` | string | Integração privada criada para o listener do ALB. |
| `load_balancer_dimension` | string | Sufixo usado pela métrica `AWS/ApplicationELB/RequestCount`. |
| `target_group_arn` | string | Espera de targets saudáveis. |
| `ecs_cluster_name` | string | Cluster das tasks. |
| `ecs_service_names` | list(string) | Espera dos serviços app e worker. |
| `sleep_check_task_definition_arn` | string | Task definition que contém `ops:can-sleep`. |
| `sleep_check_container_name` | string | Container sobrescrito pelo CodeBuild. |
| `sleep_check_subnet_ids` | list(string) | Subnets da task de verificação. |
| `sleep_check_security_group_ids` | list(string) | Security groups da task de verificação. |

O root também precisa declarar `variable "environment" { type = string }`.

## Secret do auto-wake

O Terraform cria apenas o contêiner do secret. Depois do primeiro apply, grave manualmente um JSON:

```json
{
  "accessToken": "gere-um-token-longo",
  "signingKey": "gere-uma-chave-hmac-independente"
}
```

Não salve esses valores em `.tfvars`, state, GitHub ou documentação.
