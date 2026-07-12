ALTER TABLE "jobs"
  ADD COLUMN "salaryMin" INTEGER,
  ADD COLUMN "salaryMax" INTEGER,
  ADD COLUMN "salaryCurrency" TEXT,
  ADD COLUMN "salaryInterval" TEXT,
  ADD COLUMN "externalReference" TEXT,
  ADD COLUMN "externalUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "applicationUrl" TEXT,
  ADD COLUMN "jobUrl" TEXT,
  ADD COLUMN "employmentType" TEXT,
  ADD COLUMN "seniority" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "requirements" TEXT,
  ADD COLUMN "rawMetadata" JSONB;

CREATE INDEX "jobs_employmentType_idx" ON "jobs"("employmentType");
CREATE INDEX "jobs_seniority_idx" ON "jobs"("seniority");
CREATE INDEX "jobs_department_idx" ON "jobs"("department");
CREATE INDEX "jobs_externalUpdatedAt_idx" ON "jobs"("externalUpdatedAt");
CREATE INDEX "jobs_salaryMin_idx" ON "jobs"("salaryMin");
