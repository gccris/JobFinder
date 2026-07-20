import { db } from "../lib/db";
import { getSyncQueue } from "../lib/sync-queue";

const BLOCKING_QUEUE_STATES = [
  "active",
  "waiting",
  "delayed",
  "prioritized",
  "waiting-children",
  "paused",
] as const;

async function main() {
  const queue = getSyncQueue();

  try {
    const [activeRuns, queueCounts] = await Promise.all([
      db.syncRun.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
      queue.getJobCounts(...BLOCKING_QUEUE_STATES),
    ]);
    const queuedJobs = Object.values(queueCounts).reduce((total, count) => total + count, 0);

    if (activeRuns > 0 || queuedJobs > 0) {
      console.log(JSON.stringify({ safeToSleep: false, activeRuns, queueCounts }));
      process.exitCode = 2;
      return;
    }

    console.log(JSON.stringify({ safeToSleep: true, activeRuns, queueCounts }));
  } finally {
    await queue.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Falha ao verificar se o ambiente pode desligar:", error);
  process.exitCode = 1;
});
