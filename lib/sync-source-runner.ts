import { Company, CompanySource, getRegisteredCompanies } from "./companies";
import { db } from "./db";
import { Prisma, SyncFailureScope } from "@prisma/client";
import { ParsedJob } from "./scrapers/shared";
import { fetchAshbyJobs } from "./scrapers/ashby";
import { fetchGreenhouseJobs } from "./scrapers/greenhouse";
import { fetchJazzhrJobs } from "./scrapers/jazzhr";
import { fetchLeverJobs } from "./scrapers/lever";
import { fetchSmartRecruitersJobs } from "./scrapers/smartrecruiters";
import { fetchTeamtailorJobs } from "./scrapers/teamtailor";
import { fetchWorkableJobs } from "./scrapers/workable";
import { buildJobSignals, buildJobSignalsUpdate } from "./job-signals/persist";
import { getJobSignalFingerprint } from "./job-signals/extractor";
import { COMPANY_CONCURRENCY, dbWriteSemaphore } from "./sync-config";
import { mapWithConcurrency } from "./concurrency";

type Counters = {
  processedCompanies: number;
  totalJobs: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsClosed: number;
  failures: number;
  currentCompany: string | null;
};

export async function processSyncSource(runId: string, source: CompanySource) {
  const sourceRun = await db.syncSourceRun.findUniqueOrThrow({ where: { runId_source: { runId, source } } });
  const startedAt = sourceRun.startedAt ?? new Date();
  const companies = (await getRegisteredCompanies()).filter((company) => company.source === source);
  const counters: Counters = {
    processedCompanies: 0,
    totalJobs: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsClosed: 0,
    failures: 0,
    currentCompany: null,
  };
  const flush = createProgressFlusher(sourceRun.id, counters);

  await db.$transaction([
    db.syncFailure.deleteMany({ where: { sourceRunId: sourceRun.id } }),
    db.syncSourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: "RUNNING",
        startedAt,
        finishedAt: null,
        error: null,
        totalCompanies: companies.length,
        processedCompanies: 0,
        totalJobs: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        jobsClosed: 0,
        failures: 0,
      },
    }),
    db.syncRun.updateMany({
      where: { id: runId, startedAt: null },
      data: { startedAt },
    }),
    db.syncRun.update({
      where: { id: runId },
      data: { status: "RUNNING" },
    }),
  ]);

  await mapWithConcurrency(companies, COMPANY_CONCURRENCY, async (company) => {
    counters.currentCompany = company.name;
    await flush();
    try {
      const fetched = await fetchCompanyJobs(source, company);
      const result = await persistCompanyJobs(runId, sourceRun.id, company, fetched, startedAt);
      counters.totalJobs += result.total;
      counters.jobsCreated += result.created;
      counters.jobsUpdated += result.updated;
      counters.jobsClosed += result.closed;
      counters.failures += result.failures;
    } catch (error) {
      counters.failures++;
      await recordFailure(runId, sourceRun.id, source, "COMPANY", company, error);
    } finally {
      counters.processedCompanies++;
      await flush();
    }
  });

  counters.currentCompany = null;
  await flush(true);
  const status = counters.failures > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  await db.syncSourceRun.update({
    where: { id: sourceRun.id },
    data: { status, finishedAt: new Date(), currentCompany: null },
  });
  await db.sourceSyncStat.upsert({
    where: { source },
    create: { source, successfulJobs: counters.jobsCreated + counters.jobsUpdated, failures: counters.failures, lastSyncedAt: new Date() },
    update: { successfulJobs: counters.jobsCreated + counters.jobsUpdated, failures: counters.failures, lastSyncedAt: new Date() },
  });
}

async function persistCompanyJobs(
  runId: string,
  sourceRunId: string,
  company: Company,
  jobs: ParsedJob[],
  startedAt: Date
) {
  const ownerKey = `${company.source}:${company.slug}`;
  const unique = new Map<string, ParsedJob>();
  for (const job of jobs) unique.set(`${job.source}:${job.externalId}`, job);
  const rows = Array.from(unique.values());

  const existingRows = rows.length > 0 ? await db.job.findMany({
    where: { source: company.source, externalId: { in: rows.map((job) => job.externalId) } },
    select: {
      id: true,
      externalId: true,
      createdAt: true,
      signals: { select: { normalizedTextHash: true, analyzerVersion: true } },
    },
  }) : [];
  const existing = new Map(existingRows.map((job) => [job.externalId, job]));

  await dbWriteSemaphore.run(() => db.job.updateMany({
    where: { source: company.source, company: company.name, syncOwnerKey: null },
    data: { syncOwnerKey: ownerKey },
  }));

  let created = 0;
  let updated = 0;
  let failures = 0;
  await mapWithConcurrency(rows, 2, async (job) => {
    try {
      const previous = existing.get(job.externalId);
      const data = jobData(job, ownerKey, startedAt);
      const syncedJob = await dbWriteSemaphore.run(() => db.job.upsert({
        where: { source_externalId: { source: job.source, externalId: job.externalId } },
        create: data,
        update: data,
      }));

      const signalText = [job.title, job.description, ...(job.tags || [])].filter(Boolean).join(" ");
      const fingerprint = getJobSignalFingerprint(signalText);
      if (!previous?.signals || previous.signals.normalizedTextHash !== fingerprint.normalizedTextHash || previous.signals.analyzerVersion !== fingerprint.analyzerVersion) {
        await dbWriteSemaphore.run(() => db.jobSignals.upsert({
          where: { jobId: syncedJob.id },
          update: buildJobSignalsUpdate({ title: job.title, description: job.description, tags: job.tags }),
          create: buildJobSignals({ jobId: syncedJob.id, title: job.title, description: job.description, tags: job.tags }),
        }));
      }
      if (!previous || previous.createdAt >= startedAt) created++; else updated++;
    } catch (error) {
      failures++;
      await recordFailure(runId, sourceRunId, company.source, "JOB", company, error, job.externalId);
    }
  });

  let closed = 0;
  if (failures === 0) {
    closed = (await dbWriteSemaphore.run(() => db.job.updateMany({
      where: { syncOwnerKey: ownerKey, status: "OPEN", lastSeenAt: { lt: startedAt } },
      data: { status: "CLOSED", closedAt: new Date() },
    }))).count;
  }
  return { total: rows.length, created, updated, closed, failures };
}

function jobData(job: ParsedJob, syncOwnerKey: string, lastSeenAt: Date) {
  return {
    title: job.title,
    description: job.description,
    company: job.company,
    location: job.location,
    salary: job.salary,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryInterval: job.salaryInterval,
    workplaceType: job.workplaceType as never,
    source: job.source,
    externalId: job.externalId,
    externalReference: job.externalReference,
    externalUpdatedAt: job.externalUpdatedAt ? new Date(job.externalUpdatedAt) : undefined,
    url: job.url,
    applicationUrl: job.applicationUrl,
    jobUrl: job.jobUrl,
    category: job.category as never,
    employmentType: job.employmentType,
    seniority: job.seniority,
    department: job.department,
    requirements: job.requirements,
    postedAt: new Date(job.postedAt),
    expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
    tags: job.tags,
    rawMetadata: job.rawMetadata as Prisma.InputJsonValue | undefined,
    syncOwnerKey,
    status: "OPEN" as const,
    closedAt: null,
    lastSeenAt,
  };
}

async function fetchCompanyJobs(source: CompanySource, company: Company) {
  switch (source) {
    case "lever":
      return (await fetchLeverJobs(company.slug)).map((job) => ({ ...job, company: company.name }));
    case "greenhouse": return fetchGreenhouseJobs(company.slug, company.name);
    case "ashby": return fetchAshbyJobs(company.slug, company.name);
    case "teamtailor": return fetchTeamtailorJobs(company.slug, company.name);
    case "workable": return fetchWorkableJobs(company.slug, company.name);
    case "jazzhr": return fetchJazzhrJobs(company.slug, company.name);
    case "smartrecruiters": return fetchSmartRecruitersJobs(company.slug, company.name);
  }
}

async function recordFailure(
  runId: string,
  sourceRunId: string,
  source: string,
  scope: SyncFailureScope,
  company: Company,
  error: unknown,
  externalId?: string
) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  await dbWriteSemaphore.run(() => db.syncFailure.create({
    data: {
      runId,
      sourceRunId,
      source,
      scope,
      company: company.name,
      externalId,
      error: message.slice(0, 4_000),
      details: error instanceof Error ? { name: error.name, stack: error.stack } : undefined,
    },
  }));
}

function createProgressFlusher(sourceRunId: string, counters: Counters) {
  let lastFlush = 0;
  let chain = Promise.resolve<unknown>(undefined);
  return (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < 1_000) return Promise.resolve();
    lastFlush = now;
    const snapshot = { ...counters };
    chain = chain.then(() => dbWriteSemaphore.run(() => db.syncSourceRun.update({
      where: { id: sourceRunId },
      data: { ...snapshot, lastProgressAt: new Date() },
    })));
    return chain.then(() => undefined);
  };
}
