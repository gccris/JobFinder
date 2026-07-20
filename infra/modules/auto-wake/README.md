# Módulo auto-wake

Módulo auxiliar implementado pela IA. Ele não provisiona o data plane; inicia o CodeBuild que aplica ou destrói o root Terraform da release aprovada.

## Integração

```hcl
module "auto_wake" {
  source = "../../modules/auto-wake"

  name_prefix                    = "jobhub"
  environment                    = "production"
  artifact_bucket_name           = var.artifact_bucket_name
  artifact_bucket_arn            = var.artifact_bucket_arn
  artifact_key                   = "releases/production-approved.zip"
  terraform_state_bucket_name    = var.state_bucket_name
  terraform_state_bucket_arn     = var.state_bucket_arn
  terraform_deploy_role_arn      = var.terraform_deploy_role_arn
  vpc_link_subnet_ids            = var.private_subnet_ids
  vpc_link_security_group_ids    = [aws_security_group.vpc_link.id]
  tags                           = local.tags
}
```

Após o apply:

1. Preencha o secret indicado por `access_secret_arn`.
2. Publique o zip da release em `artifact_key`.
3. Abra `access_url`, crie o cookie e acesse qualquer rota.
4. Acompanhe Lambda, CodeBuild e DynamoDB.

## Limites

- O deploy role é externo e deve permitir somente os recursos do data plane e seu backend.
- O zip da release deve conter o root informado em `terraform_root`.
- O CodeBuild baixa a versão fixada do Terraform; revise essa versão antes do apply.
- A task `ops:can-sleep` usa exit code `0` para seguro, `2` para ocupado e `1` para falha.
