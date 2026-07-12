# JobHub Project Context

## Purpose

JobHub is a job aggregation app for tech roles. It lets users register, sign in, browse jobs, save favorites, and view saved jobs. It also has admin-oriented job synchronization flows, with the currently useful integration centered on Lever.

## Stack

- Next.js 14.2.35 with App Router
- React 18 and TypeScript
- Prisma 5 with PostgreSQL
- NextAuth v5 beta using credentials auth
- Tailwind CSS dependency plus custom global CSS variables/classes
- Docker and Docker Compose for local app + database

Important repo rule: `AGENTS.md` says this Next.js version should not be treated from memory alone. Before changing Next APIs, conventions, or routing behavior, check the relevant local Next docs under `node_modules/next/dist/docs/` if available. In this checkout that docs folder did not appear to exist, so verify against the installed package or official docs before framework-sensitive edits.

## Main Directories

- `app/`: App Router pages, layouts, client views, and route handlers.
- `app/api/`: API routes for auth, jobs, saved jobs, companies, and sync.
- `app/components/`: Shared UI pieces such as navbar and back button.
- `lib/`: Shared server utilities, Prisma client, auth config, sync orchestration.
- `lib/scrapers/`: Source-specific job/company import logic.
- `prisma/`: Prisma schema and migrations.
- `jobs_list/`: JSON company lists for Lever and Greenhouse.
- `public/`: Static assets and `lever_companies.txt`.

## Data Model

Defined in `prisma/schema.prisma`.

- `User`: email/password user with `USER` or `ADMIN` role.
- `Job`: normalized job record. Deduplicated by `source + externalId`.
- `SavedJob`: join table between users and jobs, unique by `userId + jobId`.
- `LeverCompany`: stored Lever company metadata.

Job categories are enum values:

- `BACKEND`
- `FRONTEND`
- `FULLSTACK`
- `DEVOPS`
- `DATASCIENCE`
- `PRODUCT`

Note: the initial migration read during the overview did not include `LeverCompany`, although the schema does. Check migration state before assuming a fresh database has this table.

## Auth And Protection

Auth lives in `lib/auth.ts`.

- NextAuth uses the Credentials provider.
- Passwords are checked with `bcryptjs`.
- JWT/session callbacks copy `role` into the token/session.
- Custom sign-in page: `/login`.

`middleware.ts` protects:

- `/admin`
- `/jobs`
- `/dashboard`

Admin routes additionally require `session.user.role === "ADMIN"`.

Important: the middleware matcher excludes `/api`, so API route handlers must enforce their own authorization. Some sync endpoints currently appear public and should be reviewed before production use.

## Core Routes

Pages:

- `/`: Home page.
- `/login`: Credentials login.
- `/register`: User registration.
- `/jobs`: Client-side job listing, filters, pagination, and Lever sync UI.
- `/jobs/[id]`: Job detail and save/unsave flow.
- `/dashboard`: Saved jobs.
- `/companies`: Company list extracted from JSON files.
- `/admin`: Admin panel.

APIs:

- `POST /api/auth/register`: Create a user.
- `/api/auth/[...nextauth]`: NextAuth handlers.
- `GET /api/jobs`: Paginated/filterable job list.
- `GET /api/jobs/[id]`: Job detail.
- `GET /api/jobs/[id]/saved`: Saved status for current user.
- `POST /api/jobs/[id]/save`: Save job.
- `DELETE /api/jobs/[id]/save`: Remove saved job.
- `GET /api/dashboard/saved-jobs`: Current user's saved jobs.
- `GET /api/companies`: Extract Lever/Greenhouse companies from JSON files.
- `GET/POST/DELETE /api/lever/companies`: Stored Lever company operations.
- `POST /api/jobs/sync/lever`: Sync jobs from Lever public postings API.
- `POST /api/admin/sync`: Admin-only sync wrapper for `syncAllJobs()`.

## Data Ingestion

Active useful integration:

- `lib/scrapers/lever.ts`
- Uses public Lever endpoint: `https://api.lever.co/v0/postings/{siteName}?mode=json`
- Maps postings into the internal `Job` shape.
- Categorizes from title keywords.
- Strips simple HTML from descriptions.
- Deduplicates through existing `source` and `externalId`.

Placeholder integrations:

- `lib/scrapers/linkedin.ts` currently returns an empty array.
- `lib/scrapers/indeed.ts` currently returns an empty array.
- `lib/sync-jobs.ts` calls Indeed and LinkedIn, so it currently creates/updates nothing unless those implementations are completed.

Company extraction:

- `app/api/companies/route.ts` reads `jobs_list/lever_companies.json` and `jobs_list/greenhouse_companies.json`.
- It extracts company slugs and public job-board URLs.
- The bulk sync UI in `/jobs` filters this list to Lever companies only.

## Known Issues / Risks

- Many Portuguese strings and symbols are mojibake/corrupted, e.g. `FaÃ§a`, `VocÃª`, and broken emoji sequences. A copy/UI pass should fix encoding broadly.
- `app/admin/page.tsx` sends `lever_company_id`, while `POST /api/jobs/sync/lever` expects `site_name`. Admin sync likely fails.
- `app/jobs/[id]/page.tsx` checks `/saved` with `res.ok` and sets `saved=true` without reading the JSON `{ saved: boolean }`.
- Client components use `useSession`, but a `SessionProvider` was not seen in `app/layout.tsx`. Verify runtime behavior.
- Several API write endpoints lack visible auth/role checks, especially Lever sync.
- Documentation mentions endpoints like `/api/admin/jobs`, but those files were not present in the current tree.
- Docker Compose contains placeholder `NEXTAUTH_SECRET`; production needs a real secret.
- `postcss.config.mjs` has an empty plugins object despite Tailwind dependencies.
- Git commands failed with `dubious ownership`; configure `safe.directory` before doing repo operations.

## Running Locally

Recommended documented flow:

```bash
docker-compose up --build
```

This starts PostgreSQL and the Next dev server at:

```text
http://localhost:3000
```

Useful scripts:

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## Notes For Future Work

- For framework-sensitive changes, inspect the installed Next package/docs first because of the repo-specific `AGENTS.md` warning.
- Prefer fixing route/API contract mismatches before adding new features.
- Add authorization to sync endpoints before exposing this app beyond local development.
- Consider moving sync controls out of the general `/jobs` user view and into admin-only surfaces.
- Before schema work, check whether Prisma migrations are in sync with `schema.prisma`.
- After code changes that affect runtime behavior, restart the Docker container(s) so the app picks up the new build/state.
