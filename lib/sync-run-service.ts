import { Prisma, SyncRunStatus, SyncTrigger } from "@prisma/client";
import { getRegisteredCompanies } from "./companies";
import { db } from "./db";
import { buildSyncSourceJobId, getSyncQueue } from "./sync-queue";
import { CompanySource } from "./companies";

const TERMINAL: SyncRunStatus[] = ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "INTERRUPTED"];

export class ActiveSyncRunError extends Error {
  constructor(public readonly runId?: string) {
    super("Já existe uma sincronização em andamento");
  }
}

export async function enqueueSyncRun(input: { sources: CompanySource[]; trigger: SyncTrigger }) {
  const companies = await getRegisteredCompanies();
  const totalBySource = new Map<string, number>();
  for (const company of companies) {
    totalBySource.set(company.source, (totalBySource.get(company.source) ?? 0) + 1);
  }

  let run;
  try {
    run = await db.syncRun.create({
      data: {
        sources: input.sources,
        trigger: input.trigger,
        totalSources: input.sources.length,
        totalCompanies: input.sources.reduce((sum, source) => sum + (totalBySource.get(source) ?? 0), 0),
        sourceRuns: {
          create: input.sources.map((source) => ({
            source,
            totalCompanies: totalBySource.get(source) ?? 0,
          })),
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const active = await db.syncRun.findFirst({
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        select: { id: true },
      });
      throw new ActiveSyncRunError(active?.id);
    }
    throw error;
  }

  try {
    await getSyncQueue().addBulk(input.sources.map((source) => ({
      name: source,
      data: { runId: run.id, source },
      opts: { jobId: buildSyncSourceJobId(run.id, source) },
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enfileirar sincronização";
    await db.$transaction([
      db.syncSourceRun.updateMany({
        where: { runId: run.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      }),
      db.syncRun.update({
        where: { id: run.id },
        data: { status: "FAILED", failures: input.sources.length, finishedAt: new Date() },
      }),
    ]);
    throw error;
  }

  return run;
}

export async function finalizeSyncRun(runId: string) {
  const run = await db.syncRun.findUnique({
    where: { id: runId },
    include: { sourceRuns: true },
  });
  if (!run) return null;

  const completedSources = run.sourceRuns.filter((source) => TERMINAL.includes(source.status)).length;
  const totals = run.sourceRuns.reduce((sum, source) => ({
    processedCompanies: sum.processedCompanies + source.processedCompanies,
    totalJobs: sum.totalJobs + source.totalJobs,
    jobsCreated: sum.jobsCreated + source.jobsCreated,
    jobsUpdated: sum.jobsUpdated + source.jobsUpdated,
    jobsClosed: sum.jobsClosed + source.jobsClosed,
    failures: sum.failures + source.failures,
  }), { processedCompanies: 0, totalJobs: 0, jobsCreated: 0, jobsUpdated: 0, jobsClosed: 0, failures: 0 });

  const allTerminal = completedSources === run.totalSources;
  const allFailed = allTerminal && run.sourceRuns.every((source) => source.status === "FAILED");
  const hasErrors = run.sourceRuns.some((source) => source.status === "FAILED" || source.failures > 0);
  const status: SyncRunStatus = !allTerminal
    ? "RUNNING"
    : allFailed
      ? "FAILED"
      : hasErrors
        ? "COMPLETED_WITH_ERRORS"
        : "COMPLETED";

  const data = {
    ...totals,
    completedSources,
    status,
    startedAt: run.startedAt ?? new Date(),
    finishedAt: allTerminal ? new Date() : null,
  };
  if (allTerminal) return db.syncRun.update({ where: { id: runId }, data });

  await db.syncRun.updateMany({
    where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
    data,
  });
  return db.syncRun.findUnique({ where: { id: runId } });
}

export async function getSyncRunProgress(runId?: string) {
  return db.syncRun.findFirst({
    where: runId ? { id: runId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { sourceRuns: { orderBy: { source: "asc" } } },
  });
}
