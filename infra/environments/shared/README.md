# Entrega 2 — shared

Este root implementa:

- VPC em duas AZs, subnets públicas para tasks efêmeras e privadas para dados;
- security groups por origem, nunca por `0.0.0.0/0` para banco/Redis;
- ECR, roles ECS e buckets de state/release;
- RDS PostgreSQL pequeno para laboratorio;
- backups automatizados do PostgreSQL, bucket de release e contêineres de secrets;
- VPC Link security group;
- deploy role consumida pelo módulo auto-wake, budgets e SNS.

Os valores dos secrets são preenchidos fora do Terraform. Não destrua este state durante o auto-sleep.

Evidências: diagrama, plan/custo, regras de rede justificadas, conexão apenas a partir das tasks e restore de backup.
