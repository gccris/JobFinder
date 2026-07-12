import { PrismaClient } from "@prisma/client";

type PrismaSingleton = PrismaClient & { __validated?: true };

const globalForPrisma = global as unknown as { prisma?: PrismaSingleton };

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }) as PrismaSingleton;
}

function hasRequiredDelegates(client: PrismaClient) {
  return (
    typeof client.job?.upsert === "function" &&
    typeof client.jobSignals?.upsert === "function" &&
    typeof client.sourceSyncStat?.upsert === "function" &&
    typeof client.leverCompany?.upsert === "function"
  );
}

export const db = (() => {
  const cached = globalForPrisma.prisma;

  if (cached && hasRequiredDelegates(cached)) {
    return cached;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
})();
