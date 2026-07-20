# JobHub — Agregador de vagas

**Português** | [English](./README.en.md)

JobHub reúne vagas de múltiplos sistemas de recrutamento em uma única aplicação. Usuários autenticados podem pesquisar oportunidades, salvar vagas e acompanhar candidaturas; administradores podem sincronizar fontes, acompanhar o processamento em tempo real e consultar falhas e estatísticas.

## Funcionalidades

### Para usuários

- Cadastro e autenticação por e-mail e senha.
- Pesquisa por texto e localização.
- Filtros por categoria, modalidade de trabalho, faixa salarial, senioridade, departamento e tipo de contratação.
- Ordenação e paginação da listagem.
- Visualização dos detalhes, requisitos e link original da vaga.
- Favoritos e acompanhamento de candidaturas.
- Quadro de candidaturas com os estados aplicado, em entrevistas, rejeitado e aprovado.
- Dashboard com atividade por período e palavras-chave das candidaturas.
- Diretório pesquisável de empresas monitoradas.
- Tema claro e escuro e navegação responsiva.

### Para administradores

- Seleção das fontes que serão sincronizadas.
- Processamento em background com progresso geral e por fonte.
- Contadores de empresas processadas, vagas criadas, atualizadas e encerradas e falhas.
- Estatísticas históricas por fonte.
- Exclusão administrativa de vagas.
- Proteção das páginas e APIs administrativas por perfil.

## Fontes suportadas

A sincronização ativa aceita:

- Lever
- Greenhouse
- Ashby
- Teamtailor
- Workable
- JazzHR
- SmartRecruiters

As listas de empresas ficam em `jobs_list/*_companies.json`. Os adaptadores normalizam os formatos externos para o modelo interno de vagas.

Existem arquivos experimentais para LinkedIn e Indeed, mas essas plataformas **não fazem parte da sincronização ativa**. Não há sincronização agendada a cada seis horas: as execuções atuais são iniciadas manualmente pelo painel ou pela API administrativa.

## Arquitetura

```text
Navegador
   │
   ▼
Next.js (App Router + Route Handlers)
   ├── NextAuth / controle de acesso
   ├── Prisma ─────────────── PostgreSQL
   └── produtor BullMQ ────── Redis
                                │
                                ▼
                         Worker de sincronização
                                │
             APIs públicas dos sistemas de recrutamento
```

Ao iniciar uma sincronização, a aplicação cria um `SyncRun` e uma execução para cada fonte selecionada. Os trabalhos são enviados ao BullMQ e processados por um worker separado. Cada adaptador coleta empresas e vagas, normaliza os dados, classifica a vaga, extrai sinais técnicos e faz `upsert` no PostgreSQL.

As vagas são deduplicadas pela combinação `source + externalId`. O processamento também atualiza vagas existentes, marca como encerradas as vagas que deixaram de aparecer dentro do escopo sincronizado e registra falhas de fonte, empresa ou vaga. Concorrência, timeout e retries são configuráveis por variáveis de ambiente.

## Stack

- Next.js 14.2.35 com App Router
- React 18 e TypeScript
- NextAuth v5 beta com Credentials
- Prisma 5 e PostgreSQL 16
- Redis 7, BullMQ e worker Node.js isolado
- Tailwind CSS 4 e componentes Radix UI
- Vitest 3
- Docker e Docker Compose

## Laboratório SRE

O plano, o tutorial AWS e os runbooks estão em [`docs/sre-delivery-plan.md`](docs/sre-delivery-plan.md), [`docs/sre/02-aws-setup.md`](docs/sre/02-aws-setup.md) e [`docs/sre/03-operations-runbook.md`](docs/sre/03-operations-runbook.md). A infraestrutura como código fica em `infra/` e os pipelines em `.github/workflows/`.

## Início rápido com Docker

### Requisitos

- Docker Desktop ou Docker Engine
- Docker Compose v2

### Executar

```bash
docker compose up --build
```

O Compose inicia quatro serviços:

- `db`: PostgreSQL;
- `redis`: fila e estado dos trabalhos;
- `app`: aplicação Next.js em desenvolvimento;
- `worker`: consumidor BullMQ responsável pelas sincronizações.

As migrations são aplicadas na inicialização. Acesse [http://localhost:3000](http://localhost:3000).

### Comandos úteis

```bash
# Acompanhar logs
docker compose logs -f app worker

# Aplicar migrations
docker compose exec app npx prisma migrate deploy

# Abrir o Prisma Studio
docker compose exec app npm run prisma:studio

# Parar os serviços
docker compose down

# Reconstruir depois de alterar dependências
docker compose up --build
```

Os valores do `docker-compose.yml` são adequados apenas para desenvolvimento. Troque as credenciais e `NEXTAUTH_SECRET` antes de qualquer implantação compartilhada ou pública.

## Setup local

### Requisitos

- Node.js 20+
- npm
- PostgreSQL
- Redis

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

Crie `.env` na raiz para o Next.js e o Prisma:

```env
DATABASE_URL="postgresql://jobuser:SUA_SENHA_LOCAL@localhost:5432/job_aggregator"
REDIS_URL="redis://localhost:6379"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="substitua-por-uma-chave-longa-e-aleatoria"

AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

SYNC_SOURCE_CONCURRENCY="7"
SYNC_COMPANY_CONCURRENCY="2"
SYNC_HTTP_CONCURRENCY="20"
SYNC_DB_WRITE_CONCURRENCY="4"
SYNC_HTTP_TIMEOUT_MS="20000"
SYNC_HTTP_RETRIES="2"

SMARTRECRUITERS_TOKEN=""
SMARTRECRUITERS_API_KEY=""

NEXT_DIST_DIR=".next"
```

Mantenha apenas `.env` na raiz com os valores locais. Arquivos `.env*` com segredos são ignorados pelo Git.

### Login com Google

1. No Google Cloud Console, configure a tela de consentimento OAuth.
2. Crie um cliente OAuth 2.0 do tipo **Web application**.
3. Cadastre as URIs de redirecionamento autorizadas:

```text
http://localhost:3000/api/auth/callback/google
https://seu-dominio.com/api/auth/callback/google
```

4. Preencha `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` no ambiente da aplicação.

Em produção, use HTTPS e substitua `seu-dominio.com` pelo mesmo domínio configurado em `NEXTAUTH_URL`. O protocolo, domínio, porta e caminho da URI precisam corresponder exatamente ao cadastro no Google. Reinicie a aplicação ou o container depois de alterar essas variáveis.

### 3. Prepare o banco

```bash
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` executa `prisma migrate dev` e é indicado para desenvolvimento. Em ambientes implantados, use `npx prisma migrate deploy`.

### 4. Inicie a aplicação e o worker

Use terminais separados:

```bash
npm run dev
```

O worker não carrega arquivos dotenv explicitamente. Exporte pelo menos `DATABASE_URL` e `REDIS_URL` no ambiente do segundo terminal antes de iniciá-lo. Exemplo em PowerShell:

```powershell
$env:DATABASE_URL="postgresql://jobuser:SUA_SENHA_LOCAL@localhost:5432/job_aggregator"
$env:REDIS_URL="redis://localhost:6379"
npm run sync:worker
```

```bash
export DATABASE_URL="postgresql://jobuser:SUA_SENHA_LOCAL@localhost:5432/job_aggregator"
export REDIS_URL="redis://localhost:6379"
npm run sync:worker
```

A aplicação funciona sem o worker para navegação e gerenciamento de vagas existentes, mas novas sincronizações permanecerão na fila até que o worker esteja ativo.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sim | — | Conexão PostgreSQL usada pelo Prisma. |
| `REDIS_URL` | Para sincronização | `redis://localhost:6379` | Conexão do BullMQ. |
| `NEXTAUTH_SECRET` | Sim | — | Assinatura e proteção da sessão. |
| `NEXTAUTH_URL` | Sim em implantação | `http://localhost:3000` no Compose | URL canônica da aplicação. |
| `AUTH_GOOGLE_ID` | Para login Google | — | ID do cliente OAuth 2.0 criado no Google Cloud. |
| `AUTH_GOOGLE_SECRET` | Para login Google | — | Segredo do cliente OAuth; nunca deve ser versionado. |
| `SMARTRECRUITERS_TOKEN` | Não | — | Token opcional para SmartRecruiters. |
| `SMARTRECRUITERS_API_KEY` | Não | — | Alias opcional do token de SmartRecruiters. |
| `SYNC_SOURCE_CONCURRENCY` | Não | `7` | Fontes processadas simultaneamente pelo worker. |
| `SYNC_COMPANY_CONCURRENCY` | Não | `2` | Empresas simultâneas dentro de cada fonte. |
| `SYNC_HTTP_CONCURRENCY` | Não | `20` | Limite global de requisições HTTP simultâneas. |
| `SYNC_DB_WRITE_CONCURRENCY` | Não | `4` | Limite global de escritas simultâneas no banco. |
| `SYNC_HTTP_TIMEOUT_MS` | Não | `20000` | Timeout por requisição HTTP, em milissegundos. |
| `SYNC_HTTP_RETRIES` | Não | `2` | Número configurado de novas tentativas HTTP. |

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera o build de produção. |
| `npm run start` | Executa o build de produção. |
| `npm run sync:worker` | Inicia o worker BullMQ. |
| `npm run lint` | Executa o ESLint. |
| `npm test` | Executa a suíte Vitest uma vez. |
| `npm run test:watch` | Executa os testes em modo watch. |
| `npm run test:coverage` | Gera o relatório de cobertura. |
| `npm run prisma:generate` | Gera o Prisma Client. |
| `npm run prisma:migrate` | Cria/aplica migrations de desenvolvimento. |
| `npm run prisma:studio` | Abre o Prisma Studio. |
| `npm run prisma:seed` | Reservado para seed; o arquivo-alvo `prisma/seed.ts` ainda não existe. |

## Rotas da aplicação

| Rota | Acesso | Finalidade |
| --- | --- | --- |
| `/` | Público | Apresentação para visitantes e resumo para usuários autenticados. |
| `/login` | Público | Autenticação. |
| `/register` | Público | Cadastro. |
| `/jobs` | Autenticado | Pesquisa e filtros de vagas. |
| `/jobs/[id]` | Autenticado | Detalhes, favoritos e candidatura. |
| `/dashboard` | Autenticado | Quadro e analytics das candidaturas. |
| `/companies` | Autenticado | Diretório de empresas monitoradas. |
| `/admin` | Administrador | Sincronização, progresso e estatísticas. |

Usuários autenticados são redirecionados para fora das telas de login e cadastro. Requisições não autenticadas às APIs protegidas recebem `401`; usuários sem perfil administrativo recebem `403` nas operações restritas.

## APIs principais

| Método e caminho | Acesso | Finalidade |
| --- | --- | --- |
| `POST /api/auth/register` | Público | Cria uma conta. |
| `GET /api/jobs` | Autenticado | Lista vagas abertas com filtros, ordenação e paginação. |
| `GET /api/jobs/[id]` | Autenticado | Retorna detalhes e estado do usuário para uma vaga. |
| `POST/DELETE /api/jobs/[id]/save` | Autenticado | Salva ou remove uma vaga dos favoritos. |
| `GET/POST/PATCH/DELETE /api/jobs/[id]/application` | Autenticado | Consulta e gerencia uma candidatura. |
| `GET /api/dashboard` | Autenticado | Retorna quadro, atividade e analytics. |
| `GET /api/companies` | Autenticado | Lista empresas das fontes configuradas. |
| `POST /api/jobs/sync/all` | Administrador | Enfileira as fontes enviadas em `sources`. |
| `GET /api/jobs/sync/all/progress?runId=...` | Administrador | Consulta progresso e falhas agregadas. |
| `GET /api/admin/source-stats` | Administrador | Consulta estatísticas históricas por fonte. |
| `GET/POST/DELETE /api/lever/companies` | Administrador | Gerencia empresas Lever persistidas. |

Exemplo de sincronização:

```bash
curl -X POST http://localhost:3000/api/jobs/sync/all \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=..." \
  -d '{"sources":["lever","greenhouse","ashby"]}'
```

A resposta bem-sucedida usa HTTP `202` e retorna `runId`. Se já existir uma execução ativa, a API responde `409` com o identificador dessa execução.

## Modelos de dados

- `User`: conta, senha com hash e perfil `USER` ou `ADMIN`.
- `Job`: vaga normalizada, campos de classificação, remuneração, modalidade, metadados e estado aberto/encerrado.
- `JobSignals`: palavras-chave, ferramentas, linguagens, frameworks e conceitos extraídos.
- `SavedJob`: relacionamento único entre usuário e vaga favorita.
- `JobApplication`: candidatura e estado atual.
- `JobApplicationEvent`: histórico de mudanças de estado da candidatura.
- `LeverCompany`: empresas Lever persistidas pelo painel administrativo.
- `SourceSyncStat`: totais históricos de sucesso e falha por fonte.
- `SyncRun`, `SyncSourceRun` e `SyncFailure`: execução, progresso por fonte e falhas detalhadas.

O schema completo está em [`prisma/schema.prisma`](./prisma/schema.prisma).

## Estrutura do projeto

```text
app/                 páginas, layouts, componentes e Route Handlers
lib/                 autenticação, regras de acesso e serviços compartilhados
lib/scrapers/        adaptadores das fontes de vagas
lib/job-signals/     extração e persistência de sinais técnicos
scripts/             processos executáveis, incluindo o worker
prisma/              schema e migrations
jobs_list/           catálogos de empresas e respostas de referência
tests/               testes unitários e de rotas com Vitest
```

## Testes e qualidade

```bash
npm test
npm run lint
npm run build
npm run test:coverage
```

A suíte cobre autorização, cadastro, empresas, rotas de vagas e dashboard, favoritos e candidaturas, classificação, extração de sinais, adaptadores, fila e serviços de sincronização.

## Troubleshooting

### A sincronização fica na fila

Confirme que Redis está disponível e que `npm run sync:worker` está ativo. No Docker:

```bash
docker compose ps
docker compose logs -f redis worker
```

### Erro de conexão com PostgreSQL

Revise `DATABASE_URL`, confirme que o banco existe e aplique as migrations:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

### Prisma Client desatualizado

```bash
npm run prisma:generate
```

Reinicie a aplicação e o worker depois de mudanças de schema, dependências ou variáveis de ambiente.

### Porta ocupada

Altere o mapeamento de portas no `docker-compose.yml` ou encerre o processo que usa as portas `3000`, `5432` ou `6379`.

## Segurança e implantação

- Não publique as credenciais de desenvolvimento do Compose.
- Use um `NEXTAUTH_SECRET` longo e exclusivo.
- Restrinja PostgreSQL e Redis à rede privada da implantação.
- Execute migrations com `prisma migrate deploy` antes de iniciar os processos de produção.
- Mantenha aplicação e worker como processos separados apontando para o mesmo PostgreSQL e Redis.
- Configure limites de concorrência de acordo com banco, CPU, memória e limites das fontes.
- A aplicação não inclui um agendador de sincronização ativo; configure um disparador externo somente se necessário.

## Contribuição

Antes de alterar APIs, convenções ou estrutura do Next.js, siga `AGENTS.md` e consulte a documentação correspondente à versão instalada. Este projeto usa uma versão específica do framework e não deve ser atualizado com base apenas em convenções de outras versões.

Ao alterar comportamento em runtime, reinicie os containers ou processos afetados. Mantenha migrations, testes e documentação alinhados com os contratos implementados.
