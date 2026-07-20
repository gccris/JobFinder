# Preparação da conta AWS

## Segurança e custo

1. Ative MFA no usuário root e não crie access key para ele.
2. Use IAM Identity Center ou CloudShell para administração humana.
3. Escolha `us-east-1` e aplique as tags `project`, `environment`, `owner`, `managed-by` e `expires-at`.
4. Informe `budget_email` no state `shared`; o Terraform cria budgets mensais de USD 20, 50 e 80 e um tópico SNS.
5. Confirme o e-mail da assinatura SNS depois do apply.

## Ordem dos states

Execute os roots nesta ordem, sempre com `fmt`, `validate`, `plan` salvo e revisão de custo:

```powershell
cd infra/environments/bootstrap
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform plan -out bootstrap.tfplan
terraform apply bootstrap.tfplan

cd ../shared
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init -backend-config="bucket=SEU_BUCKET" -backend-config="key=shared/terraform.tfstate" -backend-config="region=us-east-1" -backend-config="use_lockfile=true"
terraform plan -out shared.tfplan
terraform apply shared.tfplan

cd ../staging
terraform init -backend-config="bucket=SEU_BUCKET" -backend-config="key=staging/control.tfstate" -backend-config="region=us-east-1" -backend-config="use_lockfile=true"

cd ../production-control
terraform init -backend-config="bucket=SEU_BUCKET" -backend-config="key=production/control.tfstate" -backend-config="region=us-east-1" -backend-config="use_lockfile=true"
```

O state `shared` contém VPC, ECR, Aurora, buckets, roles e secrets e não participa do auto-sleep. Os control planes de staging e produção contêm API Gateway, Lambdas, DynamoDB e CodeBuild. O data plane criado sob demanda contém ALB, ECS e Redis.

## Secrets

O Terraform não grava valores da aplicação. Depois do state `shared`, preencha cada secret no console ou CloudShell. Para o banco, recupere a senha do secret gerenciado pelo Aurora e grave a URL completa no secret `jobhub/ENVIRONMENT/database-url`:

```text
postgresql://jobadmin:SENHA@ENDPOINT:5432/job_aggregator?sslmode=require&connection_limit=8&pool_timeout=10
```

Preencha também `nextauth-secret`, credenciais Google e credenciais SmartRecruiters. Nunca coloque os valores em `.tfvars`, GitHub Variables, logs ou commits.

## GitHub

Crie os Environments `staging` e `production`; em `production`, configure revisores obrigatórios. Cadastre como Variables do repositório `AWS_REGION`, `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN` e `ECR_REPOSITORY`. Em cada Environment, cadastre:

- `ARTIFACT_BUCKET`;
- `AUTO_WAKE_CODEBUILD_PROJECT`;
- `STATE_BUCKET` e `PLAN_IMAGE_URI` para o plan de staging;
- `TERRAFORM_VARS_JSON`, com o conteúdo equivalente ao `terraform.tfvars.example`, sem valores secretos e sem `container_image`.

Proteja `master` exigindo pull request, um revisor e os jobs `application`, `secrets` e `terraform` do workflow CI.
