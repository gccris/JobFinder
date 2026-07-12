CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'INTERVIEWING', 'REJECTED', 'APPROVED');

ALTER TABLE "jobs"
ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "syncOwnerKey" TEXT;

CREATE TABLE "job_applications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_application_events" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "status" "ApplicationStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_application_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_applications_userId_jobId_key" ON "job_applications"("userId", "jobId");
CREATE INDEX "job_applications_userId_status_idx" ON "job_applications"("userId", "status");
CREATE INDEX "job_application_events_applicationId_createdAt_idx" ON "job_application_events"("applicationId", "createdAt");
CREATE INDEX "job_application_events_status_createdAt_idx" ON "job_application_events"("status", "createdAt");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_syncOwnerKey_idx" ON "jobs"("syncOwnerKey");

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_application_events" ADD CONSTRAINT "job_application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
