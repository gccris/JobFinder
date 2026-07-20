# Trilha SRE — CI/CD, Terraform e produção AWS

## Objetivo

Treinar CI, CD, Terraform, AWS e operação produtiva usando o JobHub. O aluno implementa manualmente os componentes SRE; a IA fornece o mecanismo auxiliar de auto-wake/auto-sleep para preservar créditos.

Em cada entrega, registre:

- objetivo e hipótese;
- decisão e justificativa;
- risco e custo;
- rollback e evidência;
- aprendizado obtido.

## Arquitetura-alvo

```text
Usuário
  │
  ▼
API Gateway ── Lambda Authorizer
  │
  ├── ambiente dormindo ── Lambda/CodeBuild/Terraform
  │
  └── ambiente pronto ── VPC Link ── ALB interno
                                      ├── ECS app ──── Aurora PostgreSQL
                                      └── ECS worker ─ ElastiCache/BullMQ
```

Qualquer requisição autenticada acorda o ambiente. Em `GET`/`HEAD`, uma página inline acompanha o provisionamento e recarrega a URL original. Requisições mutáveis retornam `503` com `Retry-After` e nunca são repetidas automaticamente.

## Responsabilidades

### Exercícios manuais do aluno

- Docker de produção e graceful shutdown.
- Infraestrutura principal em Terraform.
- CI, CD, staging, aprovação e produção.
- IAM, secrets, backups e observabilidade.
- SLO, RPO/RTO, runbooks, rollback e testes operacionais.

### Entregue pela IA

- API Gateway, authorizer e cookie assinado.
- Lambda de roteamento, status e página de inicialização.
- Estado/locking no DynamoDB.
- CodeBuild para `apply`/`destroy` do data plane.
- Auto-sleep por EventBridge e CloudWatch.
- Proteções contra concorrência, jobs ativos e repetição de mutações.
- Testes unitários e contrato Terraform documentado.

## Entregas

### 1. Fundamentos de produção

- Mapear Next.js, worker, PostgreSQL, Redis e fontes externas.
- Criar Dockerfile multi-stage.
- Validar lint, testes, build, migration, app, worker, liveness e readiness.
- Defaults do laboratório: SLO 99% durante `READY`, wake P95 de 20 minutos, RPO de 24 horas e RTO de 2 horas.

### 2. Preparação da AWS

- Criar Free Plan em `us-east-1`.
- Proteger root e acesso administrativo com MFA.
- Usar CloudShell e evitar access keys permanentes.
- Não habilitar Organizations ou Control Tower no laboratório Free Plan.
- Criar budgets de US$ 20, US$ 50 e US$ 80, alerta com US$ 20 restantes e detecção de anomalias.
- Aplicar tags `project`, `environment`, `owner`, `managed-by` e `expires-at`.
- Preencher custo antes de cada `terraform apply`.

### 3. Terraform

Separar estados:

1. `bootstrap`: backend e GitHub OIDC.
2. `shared`: rede, ECR, banco, secrets e observabilidade.
3. `auto-wake`: módulo entregue pela IA.
4. `staging`: ambiente temporário completo.
5. `production`: banco persistente e data plane efêmero.

Executar sempre `fmt`, `validate`, análise de segurança, `plan`, revisão de custo, apply, novo plan e detecção de drift.

### 4. CI

- Node.js 20, `npm ci` e Prisma Generate.
- Lint, testes e cobertura.
- PostgreSQL/Redis temporários e teste de migrations.
- Build Next.js e Docker.
- Scan de dependências, secrets e imagem.
- Terraform format, validate, lint, segurança e plan por OIDC.
- Proteger `master` com revisão e checks obrigatórios.

### 5. CD

- Construir a imagem uma vez e marcar com commit SHA.
- Enviar ao ECR e registrar o digest.
- Provisionar staging, executar migration isolada e smoke tests.
- Exigir aprovação no GitHub Environment `production`.
- Promover exatamente o mesmo digest.
- Criar snapshot antes de migrations de risco.
- Executar rolling deployment, observar e registrar a release.
- Destruir staging e deixar produção sob auto-sleep.

Rollback usa a task definition/digest anterior. Migrations seguem expand/contract e não são revertidas automaticamente.

### 6. Operação e confiabilidade

- Logs com retenção econômica, métricas e alarmes SNS.
- Queue depth/age, ECS task stops, ALB 5xx/latência, Aurora e Redis.
- Backup PostgreSQL no S3 e snapshot pré-release.
- Teste periódico de restore dentro do RTO.
- Game days: task encerrada, worker indisponível, release ruim e dependência lenta.

## Auto-wake e auto-sleep

Estados: `SLEEPING`, `WAKING`, `READY`, `SLEEPING_DOWN` e `FAILED`.

Wake:

1. Qualquer rota autenticada encontra `SLEEPING`.
2. DynamoDB permite um único lock.
3. Lambda inicia CodeBuild.
4. Terraform cria ALB, ECS e ElastiCache.
5. CodeBuild aguarda services/targets saudáveis.
6. API Gateway passa a encaminhar ao ALB via VPC Link.
7. O navegador recarrega a URL original.

Sleep:

1. EventBridge verifica a cada 15 minutos.
2. Após 60 minutos sem tráfego, inicia `SLEEPING_DOWN`.
3. Uma task executa `npm run ops:can-sleep`.
4. Jobs BullMQ ou `SyncRun` ativos adiam o desligamento.
5. API Gateway volta ao modo wake antes do destroy.
6. ECS, ALB e ElastiCache são removidos; Aurora entra em auto-pause.

## Critérios de aceitação

- Qualquer rota autenticada acorda o ambiente e preserva path/query.
- Chamadas simultâneas iniciam apenas um CodeBuild.
- Cookie inválido não cria recursos.
- Mutações não são repetidas.
- Sleep não interrompe jobs.
- Dados persistem após sleep/wake.
- Staging e produção usam o mesmo digest.
- Restore atende RPO/RTO.
- Após destroy, não sobram ALB, tasks, ElastiCache ou IPv4 cobrando.

## Implementação disponível no repositório

- Imagem Docker multi-stage e Compose equivalente à topologia app/worker/PostgreSQL/Redis.
- Liveness, readiness e verificação segura antes do auto-sleep.
- CI com migrations, lint, testes, cobertura, build, imagem e scans.
- Release com OIDC, ECR, digest imutável, staging e aprovação de produção.
- States Terraform separados para bootstrap, shared, staging, control plane e data plane.
- Aurora persistente, Redis efêmero com TLS, ECS/ALB, Secrets Manager, budgets, logs e alarmes.
- Tutorial AWS e runbooks de release, rollback, incidentes e restore.

## Próximos conteúdos SRE

- Linux, redes, DNS, TLS e HTTP.
- SLIs, SLOs, error budgets, logs, métricas e tracing.
- On-call, incidentes, runbooks e post-mortems.
- Capacity planning, testes de carga e performance.
- IAM, vulnerabilidades e supply chain.
- Disaster recovery, game days e FinOps.
- Evolução para Multi-AZ, réplicas, domínio, ACM, WAF e tasks privadas.

## Premissas de custo

- Região `us-east-1`; auto-sleep após 60 minutos.
- O Free Plan termina em até seis meses ou ao consumir os créditos.
- Aurora pausa compute em `0 ACU`, mas armazenamento/backups continuam cobrando.
- Antes de aplicar, confirme os valores na calculadora oficial da AWS.
