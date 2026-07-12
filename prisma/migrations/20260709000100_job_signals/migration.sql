-- CreateTable
CREATE TABLE "job_signals" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "frameworks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "concepts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "normalizedTextHash" TEXT,
    "analyzerVersion" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_signals_jobId_key" ON "job_signals"("jobId");

-- CreateIndex
CREATE INDEX "job_signals_analyzedAt_idx" ON "job_signals"("analyzedAt");

-- AddForeignKey
ALTER TABLE "job_signals" ADD CONSTRAINT "job_signals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
