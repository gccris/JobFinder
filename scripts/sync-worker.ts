import { Job, Worker } from "bullmq";
import { db } from "../lib/db";
import { processSyncSource } from "../lib/sync-source-runner";
import { finalizeSyncRun } from "../lib/sync-run-service";
import { buildSyncSourceJobId, getRedisConnection, getSyncQueue, SYNC_QUEUE_NAME, SyncSourceJob } from "../lib/sync-queue";
import { SOURCE_CONCURRENCY } from "../lib/sync-config";
import { SYNC_SOURCES } from "../lib/sync-sources";
import { CompanySource } from "../lib/companies";

async function main() {
  await recoverPendingRuns();
  const worker = new Worker<SyncSourceJob>(
    SYNC_QUEUE_NAME,
    async (job) => {
      if (!SYNC_SOURCES.includes(job.data.source as CompanySource)) {
        throw new Error(`Fonte inválida: ${job.data.source}`);
      }
      await processSyncSource(job.data.runId, job.data.source as CompanySource);
    },
    { connection: getRedisConnection(), concurrency: SOURCE_CONCURRENCY }
  );

  worker.on("completed", async (job) => {
    await finalizeSyncRun(job.data.runId).catch((error) => console.error("Falha ao consolidar sync:", error));
  });
  worker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await markSourceFailed(job, error).catch((markError) => console.error("Falha ao registrar erro da fonte:", markError));
  });
  worker.on("error", (error) => console.error("Erro no worker de sincronização:", error));

  const shutdown = async () => {
    await worker.close();
    await getSyncQueue().close();
    await db.$disconnect();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  console.log(`Worker ${SYNC_QUEUE_NAME} iniciado com concorrência ${SOURCE_CONCURRENCY}`);
}

async function recoverPendingRuns() {
  const sourceRuns = await db.syncSourceRun.findMany({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
      run: { status: { in: ["QUEUED", "RUNNING"] } },
    },
    select: { runId: true, source: true },
  });
  if (sourceRuns.length === 0) return;
  await getSyncQueue().addBulk(sourceRuns.map((sourceRun) => ({
    name: sourceRun.source,
    data: sourceRun,
    opts: { jobId: buildSyncSourceJobId(sourceRun.runId, sourceRun.source) },
  })));
}

async function markSourceFailed(job: Job<SyncSourceJob>, error: Error) {
  const sourceRun = await db.syncSourceRun.findUnique({
    where: { runId_source: { runId: job.data.runId, source: job.data.source } },
    select: { id: true },
  });
  if (!sourceRun) return;
  await db.$transaction([
    db.syncFailure.create({
      data: {
        runId: job.data.runId,
        sourceRunId: sourceRun.id,
        source: job.data.source,
        scope: "SOURCE",
        error: error.message.slice(0, 4_000),
        details: { name: error.name, stack: error.stack },
      },
    }),
    db.syncSourceRun.update({
      where: { id: sourceRun.id },
      data: { status: "FAILED", error: error.message.slice(0, 4_000), finishedAt: new Date(), failures: { increment: 1 } },
    }),
  ]);
  await finalizeSyncRun(job.data.runId);
}

main().catch(async (error) => {
  console.error("Não foi possível iniciar o worker:", error);
  await db.$disconnect();
  process.exit(1);
});
