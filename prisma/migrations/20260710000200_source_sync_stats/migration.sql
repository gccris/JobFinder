CREATE TABLE "source_sync_stats" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "successfulJobs" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "source_sync_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_sync_stats_source_key" ON "source_sync_stats"("source");
