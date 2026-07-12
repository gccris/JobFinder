-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "workplaceType" "WorkplaceType" NOT NULL DEFAULT 'UNSPECIFIED';

-- CreateIndex
CREATE INDEX "jobs_workplaceType_idx" ON "jobs"("workplaceType");
