# Runbook operacional

## Objetivos

- Disponibilidade: 99% enquanto o estado do ambiente for `READY`.
- Wake: P95 menor que 20 minutos.
- RPO: 24 horas.
- RTO: 2 horas.

## Release

1. Abra um pull request e aguarde CI, revisão e merge.
2. Execute o workflow `Release`.
3. A imagem é criada uma vez, enviada ao ECR por SHA e promovida pelo mesmo digest.
4. Staging aplica o Terraform, executa `prisma migrate deploy` em task isolada e só depois inicia app e worker.
5. O Environment `production` exige aprovação e publica uma nova versão do pacote no S3.
6. `activate_production_now=false` deixa a release para o próximo wake; `true` inicia a atualização imediatamente.

Migrations devem seguir expand/contract: primeiro adicionar estruturas compatíveis, depois migrar leitores/escritores e somente em outra release remover o formato antigo.

## Rollback

1. Pare novas releases e identifique o último digest saudável no ECR/registro do workflow.
2. Recupere a versão anterior de `releases/production-approved.zip` no bucket versionado.
3. Copie essa versão novamente para a chave aprovada.
4. Inicie o CodeBuild com `ACTION=WAKE`.
5. Confirme readiness, login e uma consulta de vagas.

O circuit breaker do ECS reverte tasks que não estabilizam. Migration destrutiva não é revertida automaticamente.

## Incidente HTTP

1. Verifique o estado no DynamoDB: `SLEEPING`, `WAKING`, `READY`, `SLEEPING_DOWN` ou `FAILED`.
2. Se estiver `WAKING`, acompanhe o CodeBuild e não inicie outro build.
3. Se estiver `READY`, examine os alarmes de targets, 5xx e P95 e os logs `/ecs/.../app`.
4. Teste `/api/health/live`; depois `/api/health/ready`.
5. Se a release causou o problema, execute o rollback.
6. Registre linha do tempo, impacto, causa, correção e ação preventiva.

## Worker ou fila

1. Confirme se o serviço worker possui uma task ativa e examine `/ecs/.../worker`.
2. Consulte os `SyncRun` em `QUEUED` ou `RUNNING` e os estados BullMQ.
3. Não force o sleep enquanto houver run ou job pendente; `ops:can-sleep` retorna código 2 nesse caso.
4. Reinicie o worker apenas depois de confirmar que o job é idempotente.

## Restore

1. Restaure o Aurora para um novo cluster a partir do ponto desejado.
2. Crie um secret temporário de `DATABASE_URL` apontando para o cluster restaurado.
3. Suba staging contra esse secret e execute migrations e smoke tests.
4. Meça desde o início do incidente até a validação; deve ser menor que 2 horas.
5. Não substitua produção antes de validar contagem de usuários, vagas, candidaturas e últimos `SyncRun`.

## Encerramento e custo

Após o sleep, confirme ausência de ALB, ECS tasks, Redis e IPv4 do data plane. Aurora, buckets, ECR, secrets, DynamoDB e logs permanecem por projeto. Nunca destrua `shared` como forma de desligar o ambiente.
