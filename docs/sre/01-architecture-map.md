# Mapeamento da arquitetura

## 1. Visão geral

O sistema é uma aplicação web que consulta APIs de empresas e plataformas de recrutamento para agregar vagas disponíveis. Nele, o usuário pode consultar e salvar vagas, além de acompanhar seus processos de candidatura. A sincronização das vagas é executada de forma assíncrona.

## 2. Componentes

### Aplicação Next.js

- Responsabilidade: servir o frontend e as APIs do sistema, autenticar usuários, aplicar as regras de negócio e solicitar sincronizações.
- Comando de inicialização: `npm run dev` em desenvolvimento; em produção, `npm run build` seguido de `npm run start`.
- Porta: `3000`.
- Dependências: PostgreSQL, Redis para enfileirar sincronizações, APIs externas e variáveis de ambiente de autenticação e integração.
- Estado persistente: não mantém estado persistente localmente; os dados duráveis são armazenados no PostgreSQL.

### Worker BullMQ

- Responsabilidade: consumir os jobs da fila Redis, consultar as fontes externas, persistir as vagas no PostgreSQL e atualizar o estado das sincronizações.
- Comando de inicialização: `npm run sync:worker`.
- Dependências: Redis, PostgreSQL, APIs externas e variáveis de ambiente da sincronização.
- Comportamento ao encerrar: ao receber `SIGTERM` ou `SIGINT`, fecha o worker e a conexão com a fila, desconecta do banco e encerra o processo. O graceful shutdown da aplicação Next.js ainda precisa ser definido.

### PostgreSQL

- Dados armazenados: usuários, autenticação e sessões, vagas, empresas/fontes cadastradas, vagas salvas, candidaturas e histórico das sincronizações.
- Quem acessa: aplicação Next.js e worker BullMQ.
- Estratégia de backup: backups automatizados do PostgreSQL com retenção configurável e snapshot final protegido no state `shared`. O teste de restore continua sendo uma atividade operacional obrigatória.

### Redis

- Finalidade: atuar como broker da fila BullMQ, armazenando e coordenando os jobs que serão consumidos pelo worker.
- Quem acessa: a aplicação Next.js, como produtora dos jobs, e o worker, como consumidor.
- Consequência se ficar indisponível: novas sincronizações não podem ser enfileiradas e o worker não consegue consumir os jobs. Erros de conexão e crescimento da idade da fila devem ser monitorados.

### Fontes externas

- Serviço: APIs de Lever, Greenhouse, Ashby, Teamtailor, Workable, JazzHR e SmartRecruiters.
- Como é utilizado: a sincronização usa os identificadores das empresas cadastradas para consultar suas vagas nas respectivas plataformas.
- Timeout: 20 segundos por requisição, configurável por `SYNC_HTTP_TIMEOUT_MS`.
- Consequência de falha: a fonte afetada fica desatualizada e a sincronização pode terminar parcialmente ou com erro; as demais fontes não devem ser interrompidas.

## 3. Fluxo de uma requisição

Fluxo de navegação: usuário acessa uma URL → aplicação Next.js autentica e processa a requisição → consulta o PostgreSQL quando necessário → renderiza a página ou retorna a resposta da API.

Fluxo de consulta externa: worker identifica a empresa e a plataforma → realiza a requisição HTTP → transforma os dados recebidos → grava as vagas e o resultado da sincronização no PostgreSQL.

## 4. Fluxo de um job assíncrono

Administrador solicita `POST /api/jobs/sync/all` → aplicação cria o registro da sincronização no PostgreSQL → aplicação adiciona um job por fonte no Redis → worker consome os jobs → worker consulta as APIs externas → worker grava os resultados no PostgreSQL → execução é consolidada como concluída, parcialmente concluída ou com falha → frontend consulta o progresso.

## 5. Requisitos operacionais

- Liveness: `GET /api/health/live` verifica somente se o processo responde.
- Readiness: `GET /api/health/ready` verifica PostgreSQL e Redis e é usado pelo Docker e pelo target group do ALB.
- Graceful shutdown: implementado no worker para `SIGTERM` e `SIGINT`; pendente para o processo Next.js e para validação em container.
- Variáveis de ambiente: fornecidas por `.env` no desenvolvimento e injetadas no ambiente de execução em produção.
- Secrets: `.env` apenas no desenvolvimento; ECS injeta valores do AWS Secrets Manager e o Terraform cria somente os contêineres dos secrets.
- Logs: `stdout` e `stderr` são enviados aos log groups do CloudWatch com retenção configurável.
- Métricas: ALB 5xx, P95 de latência, targets saudáveis, profundidade da fila e idade do job mais antigo possuem alarmes. Duração das sincronizações permanece como evolução da instrumentação.

## 6. Pontos de falha

| Componente | Possível falha | Impacto | Como detectar |
| --- | --- | --- | --- |
| Next.js | processo encerrado ou erro ao processar uma rota | site e APIs ficam indisponíveis | liveness, logs e taxa de respostas 5xx |
| Worker | processo parado ou travado | fila cresce e as vagas ficam desatualizadas | logs, profundidade e idade da fila |
| PostgreSQL | indisponibilidade ou falha de conexão | site e sincronizações não conseguem acessar ou salvar dados | readiness, erros de conexão e métricas do banco |
| Redis | indisponibilidade ou falha de conexão | jobs não são enfileirados nem consumidos | erros de conexão e métricas da fila |
| Fontes externas | timeout, indisponibilidade ou limitação de requisições | fonte afetada fica desatualizada e a sincronização pode terminar parcialmente | logs, registros de falha e métricas de sincronização por fonte |

## 7. Evoluções pendentes

- Publicar duração e taxa de falha das sincronizações como métricas customizadas.
- Executar e registrar trimestralmente um restore cronometrado.
- Adicionar tracing distribuído quando o volume justificar o custo.
