import { ConnectionOptions, Queue } from "bullmq";

export const SYNC_QUEUE_NAME = "sync-sources";

export type SyncSourceJob = {
  runId: string;
  source: string;
};

export function buildSyncSourceJobId(runId: string, source: string) {
  return `${runId}__${source}`;
}

function createSyncQueue() {
  return new Queue<SyncSourceJob>(SYNC_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
    },
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __syncQueue: ReturnType<typeof createSyncQueue> | undefined;
}

export function getRedisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function getSyncQueue(): ReturnType<typeof createSyncQueue> {
  if (!globalThis.__syncQueue) globalThis.__syncQueue = createSyncQueue();
  return globalThis.__syncQueue;
}
