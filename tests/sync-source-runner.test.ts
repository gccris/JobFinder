import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companies: vi.fn(), fetchLever: vi.fn(), transaction: vi.fn(),
  sourceFind: vi.fn(), sourceUpdate: vi.fn(), runUpdate: vi.fn(), runUpdateMany: vi.fn(), failureDelete: vi.fn(), failureCreate: vi.fn(),
  jobFindMany: vi.fn(), jobUpdateMany: vi.fn(), jobUpsert: vi.fn(), signalsUpsert: vi.fn(), statsUpsert: vi.fn(),
}));
vi.mock("@/lib/companies", () => ({ getRegisteredCompanies: mocks.companies }));
vi.mock("@/lib/scrapers/lever", () => ({ fetchLeverJobs: mocks.fetchLever }));
vi.mock("@/lib/job-signals/persist", () => ({
  buildJobSignals: () => ({ analyzerVersion: "1", normalizedTextHash: "hash" }),
  buildJobSignalsUpdate: () => ({ analyzerVersion: "1", normalizedTextHash: "hash" }),
}));
vi.mock("@/lib/job-signals/extractor", () => ({ getJobSignalFingerprint: () => ({ analyzerVersion: "1", normalizedTextHash: "hash" }) }));
vi.mock("@/lib/sync-config", () => ({ COMPANY_CONCURRENCY: 2, dbWriteSemaphore: { run: (operation: () => unknown) => operation() } }));
vi.mock("@/lib/db", () => ({ db: {
  $transaction: mocks.transaction,
  syncSourceRun: { findUniqueOrThrow: mocks.sourceFind, update: mocks.sourceUpdate },
  syncRun: { update: mocks.runUpdate, updateMany: mocks.runUpdateMany },
  syncFailure: { deleteMany: mocks.failureDelete, create: mocks.failureCreate },
  job: { findMany: mocks.jobFindMany, updateMany: mocks.jobUpdateMany, upsert: mocks.jobUpsert },
  jobSignals: { upsert: mocks.signalsUpsert }, sourceSyncStat: { upsert: mocks.statsUpsert },
} }));

import { processSyncSource } from "../lib/sync-source-runner";

const company = { id: "lever:acme", source: "lever", slug: "acme", name: "Acme", url: "https://jobs.lever.co/acme" };
const job = {
  id: "ext-1", externalId: "ext-1", title: "Backend Engineer", description: "Node", company: "Acme", location: "Remote",
  source: "lever", url: "https://job", category: "BACKEND", workplaceType: "REMOTE", postedAt: "2026-07-01T00:00:00Z", tags: ["Remote"],
};

describe("source sync runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sourceFind.mockResolvedValue({ id: "source-run-1", startedAt: null });
    mocks.companies.mockResolvedValue([company]);
    mocks.transaction.mockResolvedValue([]);
    mocks.sourceUpdate.mockResolvedValue({});
    mocks.runUpdate.mockResolvedValue({});
    mocks.runUpdateMany.mockResolvedValue({ count: 1 });
    mocks.failureDelete.mockResolvedValue({ count: 0 });
    mocks.jobFindMany.mockResolvedValue([]);
    mocks.jobUpdateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 2 });
    mocks.jobUpsert.mockResolvedValue({ id: "job-1" });
    mocks.signalsUpsert.mockResolvedValue({});
    mocks.statsUpsert.mockResolvedValue({});
  });

  it("persists fetched jobs, analyzes them and closes stale jobs after a clean fetch", async () => {
    mocks.fetchLever.mockResolvedValue([job]);
    await processSyncSource("run-1", "lever");

    expect(mocks.fetchLever).toHaveBeenCalledWith("acme");
    expect(mocks.jobUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { source_externalId: { source: "lever", externalId: "ext-1" } },
      create: expect.objectContaining({ syncOwnerKey: "lever:acme", status: "OPEN", company: "Acme" }),
    }));
    expect(mocks.signalsUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: { jobId: "job-1" } }));
    expect(mocks.jobUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ syncOwnerKey: "lever:acme", status: "OPEN" }), data: expect.objectContaining({ status: "CLOSED" }),
    }));
    expect(mocks.sourceUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(mocks.statsUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ successfulJobs: 1, failures: 0 }) }));
  });

  it("records a company failure and completes the source with errors", async () => {
    mocks.fetchLever.mockRejectedValue(new Error("Lever offline"));
    mocks.failureCreate.mockResolvedValue({});
    await processSyncSource("run-1", "lever");

    expect(mocks.failureCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      runId: "run-1", sourceRunId: "source-run-1", source: "lever", scope: "COMPANY", company: "Acme", error: "Lever offline",
    }) });
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
    expect(mocks.sourceUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED_WITH_ERRORS" }) }));
  });
});
