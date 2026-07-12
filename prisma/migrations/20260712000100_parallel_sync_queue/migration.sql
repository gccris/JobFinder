CREATE TYPE "SyncRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'INTERRUPTED'
);

CREATE TYPE "SyncTrigger" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "SyncFailureScope" AS ENUM ('SOURCE', 'COMPANY', 'JOB');

CREATE TABLE "sync_runs" (
  "id" TEXT NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'QUEUED',
  "trigger" "SyncTrigger" NOT NULL DEFAULT 'MANUAL',
  "sources" TEXT[],
  "totalSources" INTEGER NOT NULL,
  "completedSources" INTEGER NOT NULL DEFAULT 0,
  "totalCompanies" INTEGER NOT NULL DEFAULT 0,
  "processedCompanies" INTEGER NOT NULL DEFAULT 0,
  "totalJobs" INTEGER NOT NULL DEFAULT 0,
  "jobsCreated" INTEGER NOT NULL DEFAULT 0,
  "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
  "jobsClosed" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_source_runs" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'QUEUED',
  "totalCompanies" INTEGER NOT NULL DEFAULT 0,
  "processedCompanies" INTEGER NOT NULL DEFAULT 0,
  "totalJobs" INTEGER NOT NULL DEFAULT 0,
  "jobsCreated" INTEGER NOT NULL DEFAULT 0,
  "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
  "jobsClosed" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "currentCompany" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "lastProgressAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_source_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_failures" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceRunId" TEXT,
  "source" TEXT NOT NULL,
  "scope" "SyncFailureScope" NOT NULL,
  "company" TEXT,
  "externalId" TEXT,
  "error" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_failures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_runs_status_queuedAt_idx" ON "sync_runs"("status", "queuedAt");
CREATE UNIQUE INDEX "sync_runs_one_active_idx" ON "sync_runs" ((1)) WHERE "status" IN ('QUEUED', 'RUNNING');
CREATE UNIQUE INDEX "sync_source_runs_runId_source_key" ON "sync_source_runs"("runId", "source");
CREATE INDEX "sync_source_runs_status_createdAt_idx" ON "sync_source_runs"("status", "createdAt");
CREATE INDEX "sync_failures_runId_source_createdAt_idx" ON "sync_failures"("runId", "source", "createdAt");
CREATE INDEX "jobs_source_company_syncOwnerKey_idx" ON "jobs"("source", "company", "syncOwnerKey");
CREATE INDEX "jobs_syncOwnerKey_status_lastSeenAt_idx" ON "jobs"("syncOwnerKey", "status", "lastSeenAt");

ALTER TABLE "sync_source_runs" ADD CONSTRAINT "sync_source_runs_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_sourceRunId_fkey"
  FOREIGN KEY ("sourceRunId") REFERENCES "sync_source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
