# JobHub — Job aggregator

[Português](./README.md) | **English**

JobHub brings jobs from multiple applicant tracking systems into a single application. Authenticated users can search opportunities, save jobs, and track applications; administrators can synchronize sources, monitor processing in real time, and review failures and statistics.

## Features

### For users

- Email and password registration and authentication.
- Search by text and location.
- Filters for category, workplace type, salary range, seniority, department, and employment type.
- Sorting and pagination.
- Job details, requirements, and links to the original posting.
- Saved jobs and application tracking.
- Application board with applied, interviewing, rejected, and approved states.
- Dashboard with activity by period and application keywords.
- Searchable directory of monitored companies.
- Light and dark themes and responsive navigation.

### For administrators

- Selection of the sources included in a synchronization run.
- Background processing with overall and per-source progress.
- Counters for processed companies, created, updated, and closed jobs, and failures.
- Historical statistics by source.
- Administrative job deletion.
- Role-based protection for administrative pages and APIs.

## Supported sources

Active synchronization supports:

- Lever
- Greenhouse
- Ashby
- Teamtailor
- Workable
- JazzHR
- SmartRecruiters

Company catalogs live in `jobs_list/*_companies.json`. The adapters normalize external formats into the internal job model.

The repository contains experimental LinkedIn and Indeed files, but these platforms are **not part of active synchronization**. There is no six-hour scheduled synchronization: current runs are started manually through the admin panel or API.

## Architecture

```text
Browser
   │
   ▼
Next.js (App Router + Route Handlers)
   ├── NextAuth / access control
   ├── Prisma ─────────────── PostgreSQL
   └── BullMQ producer ────── Redis
                                │
                                ▼
                          Synchronization worker
                                │
                   Public applicant tracking APIs
```

When a synchronization starts, the application creates a `SyncRun` and one source run for every selected source. Jobs are sent to BullMQ and processed by a separate worker. Each adapter fetches companies and jobs, normalizes the data, classifies the job, extracts technical signals, and upserts it into PostgreSQL.

Jobs are deduplicated by `source + externalId`. Processing also updates existing jobs, closes jobs that disappear within the synchronized scope, and records source, company, or job failures. Concurrency, timeouts, and retries are configurable through environment variables.

## Stack

- Next.js 14.2.35 with App Router
- React 18 and TypeScript
- NextAuth v5 beta with Credentials
- Prisma 5 and PostgreSQL 16
- Redis 7, BullMQ, and an isolated Node.js worker
- Tailwind CSS 4 and Radix UI components
- Vitest 3
- Docker and Docker Compose

## Quick start with Docker

### Requirements

- Docker Desktop or Docker Engine
- Docker Compose v2

### Run

```bash
docker compose up --build
```

Compose starts four services:

- `db`: PostgreSQL;
- `redis`: queue and job state;
- `app`: the Next.js development application;
- `worker`: the BullMQ consumer responsible for synchronization.

Migrations are applied during startup. Open [http://localhost:3000](http://localhost:3000).

### Useful commands

```bash
# Follow logs
docker compose logs -f app worker

# Apply migrations
docker compose exec app npx prisma migrate deploy

# Open Prisma Studio
docker compose exec app npm run prisma:studio

# Stop services
docker compose down

# Rebuild after dependency changes
docker compose up --build
```

Values in `docker-compose.yml` are intended for development only. Replace the credentials and `NEXTAUTH_SECRET` before any shared or public deployment.

## Local setup

### Requirements

- Node.js 20+
- npm
- PostgreSQL
- Redis

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create `.env` at the project root for Next.js and Prisma:

```env
DATABASE_URL="postgresql://jobuser:YOUR_LOCAL_PASSWORD@localhost:5432/job_aggregator"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-secure-secret"
```

### 3. Prepare the database

```bash
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` runs `prisma migrate dev` and is intended for development. Use `npx prisma migrate deploy` in deployed environments.

### 4. Start the application and worker

Use separate terminals:

```bash
npm run dev
```

The worker does not explicitly load dotenv files. Export at least `DATABASE_URL` and `REDIS_URL` in the second terminal before starting it. PowerShell example:

```powershell
$env:DATABASE_URL="postgresql://jobuser:YOUR_LOCAL_PASSWORD@localhost:5432/job_aggregator"
$env:REDIS_URL="redis://localhost:6379"
npm run sync:worker
```

```bash
export DATABASE_URL="postgresql://jobuser:YOUR_LOCAL_PASSWORD@localhost:5432/job_aggregator"
export REDIS_URL="redis://localhost:6379"
npm run sync:worker
```

The application works without the worker for browsing and managing existing jobs, but new synchronization runs remain queued until the worker is active.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection used by Prisma. |
| `REDIS_URL` | For synchronization | `redis://localhost:6379` | BullMQ connection. |
| `NEXTAUTH_SECRET` | Yes | — | Session signing and protection. |
| `NEXTAUTH_URL` | Yes when deployed | `http://localhost:3000` in Compose | Canonical application URL. |
| `SMARTRECRUITERS_TOKEN` | No | — | Optional SmartRecruiters token. |
| `SMARTRECRUITERS_API_KEY` | No | — | Optional alias for the SmartRecruiters token. |
| `SYNC_SOURCE_CONCURRENCY` | No | `7` | Sources processed simultaneously by the worker. |
| `SYNC_COMPANY_CONCURRENCY` | No | `2` | Concurrent companies within each source. |
| `SYNC_HTTP_CONCURRENCY` | No | `20` | Global concurrent HTTP request limit. |
| `SYNC_DB_WRITE_CONCURRENCY` | No | `4` | Global concurrent database write limit. |
| `SYNC_HTTP_TIMEOUT_MS` | No | `20000` | Timeout per HTTP request in milliseconds. |
| `SYNC_HTTP_RETRIES` | No | `2` | Configured number of HTTP retries. |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server. |
| `npm run build` | Creates the production build. |
| `npm run start` | Runs the production build. |
| `npm run sync:worker` | Starts the BullMQ worker. |
| `npm run lint` | Runs ESLint. |
| `npm test` | Runs the Vitest suite once. |
| `npm run test:watch` | Runs tests in watch mode. |
| `npm run test:coverage` | Generates the coverage report. |
| `npm run prisma:generate` | Generates Prisma Client. |
| `npm run prisma:migrate` | Creates/applies development migrations. |
| `npm run prisma:studio` | Opens Prisma Studio. |
| `npm run prisma:seed` | Reserved for seeding; its `prisma/seed.ts` target does not exist yet. |

## Application routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Marketing page for visitors and summary for authenticated users. |
| `/login` | Public | Authentication. |
| `/register` | Public | Registration. |
| `/jobs` | Authenticated | Job search and filtering. |
| `/jobs/[id]` | Authenticated | Details, saved state, and application actions. |
| `/dashboard` | Authenticated | Application board and analytics. |
| `/companies` | Authenticated | Monitored company directory. |
| `/admin` | Administrator | Synchronization, progress, and statistics. |

Authenticated users are redirected away from login and registration pages. Unauthenticated protected API requests receive `401`; non-administrators receive `403` for restricted operations.

## Main APIs

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` | Public | Creates an account. |
| `GET /api/jobs` | Authenticated | Lists open jobs with filters, sorting, and pagination. |
| `GET /api/jobs/[id]` | Authenticated | Returns job details and user-specific state. |
| `POST/DELETE /api/jobs/[id]/save` | Authenticated | Saves or removes a job. |
| `GET/POST/PATCH/DELETE /api/jobs/[id]/application` | Authenticated | Reads and manages an application. |
| `GET /api/dashboard` | Authenticated | Returns the board, activity, and analytics. |
| `GET /api/companies` | Authenticated | Lists companies from configured sources. |
| `POST /api/jobs/sync/all` | Administrator | Enqueues the sources sent in `sources`. |
| `GET /api/jobs/sync/all/progress?runId=...` | Administrator | Reads aggregated progress and failures. |
| `GET /api/admin/source-stats` | Administrator | Reads historical statistics by source. |
| `GET/POST/DELETE /api/lever/companies` | Administrator | Manages persisted Lever companies. |

Synchronization example:

```bash
curl -X POST http://localhost:3000/api/jobs/sync/all \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=..." \
  -d '{"sources":["lever","greenhouse","ashby"]}'
```

A successful response uses HTTP `202` and returns a `runId`. If another run is active, the API responds with `409` and that run's identifier.

## Data models

- `User`: account, hashed password, and `USER` or `ADMIN` role.
- `Job`: normalized job, classification, compensation, workplace, metadata, and open/closed state.
- `JobSignals`: extracted keywords, tools, languages, frameworks, and concepts.
- `SavedJob`: unique relationship between a user and a saved job.
- `JobApplication`: application and its current state.
- `JobApplicationEvent`: application state change history.
- `LeverCompany`: Lever companies persisted by the admin panel.
- `SourceSyncStat`: historical success and failure totals per source.
- `SyncRun`, `SyncSourceRun`, and `SyncFailure`: run, per-source progress, and detailed failures.

The complete schema is in [`prisma/schema.prisma`](./prisma/schema.prisma).

## Project structure

```text
app/                 pages, layouts, components, and Route Handlers
lib/                 authentication, access rules, and shared services
lib/scrapers/        job source adapters
lib/job-signals/     technical signal extraction and persistence
scripts/             executable processes, including the worker
prisma/              schema and migrations
jobs_list/           company catalogs and reference responses
tests/               route and unit tests using Vitest
```

## Tests and quality

```bash
npm test
npm run lint
npm run build
npm run test:coverage
```

The suite covers authorization, registration, companies, job and dashboard routes, saved jobs and applications, classification, signal extraction, adapters, queue primitives, and synchronization services.

## Troubleshooting

### Synchronization remains queued

Make sure Redis is available and `npm run sync:worker` is running. With Docker:

```bash
docker compose ps
docker compose logs -f redis worker
```

### PostgreSQL connection error

Review `DATABASE_URL`, confirm the database exists, and apply migrations:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

### Outdated Prisma Client

```bash
npm run prisma:generate
```

Restart the application and worker after schema, dependency, or environment variable changes.

### Port already in use

Change the port mappings in `docker-compose.yml` or stop the process using ports `3000`, `5432`, or `6379`.

## Security and deployment

- Do not publish the development credentials from Compose.
- Use a long, unique `NEXTAUTH_SECRET`.
- Restrict PostgreSQL and Redis to the deployment's private network.
- Run migrations with `prisma migrate deploy` before starting production processes.
- Run the application and worker as separate processes connected to the same PostgreSQL and Redis instances.
- Tune concurrency limits for the database, CPU, memory, and source limits.
- The application has no active synchronization scheduler; configure an external trigger only if needed.

## Contributing

Before changing Next.js APIs, conventions, or project structure, follow `AGENTS.md` and consult documentation for the installed version. This project uses a specific framework release and should not be updated based solely on conventions from other versions.

After runtime-affecting changes, restart the affected containers or processes. Keep migrations, tests, and documentation aligned with the implemented contracts.
