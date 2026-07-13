import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRegisteredCompanies: vi.fn(), addBulk: vi.fn(),
  syncRunCreate: vi.fn(), syncRunFindFirst: vi.fn(), syncRunFindUnique: vi.fn(), syncRunUpdate: vi.fn(), syncRunUpdateMany: vi.fn(),
  sourceUpdateMany: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/companies", () => ({ getRegisteredCompanies: mocks.getRegisteredCompanies }));
vi.mock("@/lib/sync-queue", () => ({
  buildSyncSourceJobId: (runId: string, source: string) => `${runId}__${source}`,
  getSyncQueue: () => ({ addBulk: mocks.addBulk }),
}));
vi.mock("@/lib/db", () => ({ db: {
  syncRun: { create: mocks.syncRunCreate, findFirst: mocks.syncRunFindFirst, findUnique: mocks.syncRunFindUnique, update: mocks.syncRunUpdate, updateMany: mocks.syncRunUpdateMany },
  syncSourceRun: { updateMany: mocks.sourceUpdateMany },
  $transaction: mocks.transaction,
} }));

import { enqueueSyncRun, finalizeSyncRun, getSyncRunProgress } from "../lib/sync-run-service";

describe("sync run service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates source runs with company totals and enqueues deterministic jobs", async () => {
    mocks.getRegisteredCompanies.mockResolvedValue([
      { source: "lever" }, { source: "lever" }, { source: "greenhouse" },
    ]);
    mocks.syncRunCreate.mockResolvedValue({ id: "run-1", status: "QUEUED" });
    mocks.addBulk.mockResolvedValue([]);

    await expect(enqueueSyncRun({ sources: ["lever", "greenhouse"], trigger: "MANUAL" })).resolves.toMatchObject({ id: "run-1" });
    expect(mocks.syncRunCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      sources: ["lever", "greenhouse"], totalSources: 2, totalCompanies: 3,
      sourceRuns: { create: [{ source: "lever", totalCompanies: 2 }, { source: "greenhouse", totalCompanies: 1 }] },
    }) });
    expect(mocks.addBulk).toHaveBeenCalledWith([
      { name: "lever", data: { runId: "run-1", source: "lever" }, opts: { jobId: "run-1__lever" } },
      { name: "greenhouse", data: { runId: "run-1", source: "greenhouse" }, opts: { jobId: "run-1__greenhouse" } },
    ]);
  });

  it("marks the run and sources failed when queueing fails", async () => {
    mocks.getRegisteredCompanies.mockResolvedValue([]);
    mocks.syncRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.addBulk.mockRejectedValue(new Error("redis offline"));
    mocks.transaction.mockResolvedValue([]);
    await expect(enqueueSyncRun({ sources: ["lever"], trigger: "MANUAL" })).rejects.toThrow("redis offline");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.sourceUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", error: "redis offline" }) }));
  });

  it.each([
    [[{ status: "COMPLETED", processedCompanies: 2, totalJobs: 4, jobsCreated: 2, jobsUpdated: 2, jobsClosed: 1, failures: 0 }], "COMPLETED"],
    [[{ status: "COMPLETED_WITH_ERRORS", processedCompanies: 2, totalJobs: 4, jobsCreated: 1, jobsUpdated: 1, jobsClosed: 0, failures: 2 }], "COMPLETED_WITH_ERRORS"],
    [[{ status: "FAILED", processedCompanies: 0, totalJobs: 0, jobsCreated: 0, jobsUpdated: 0, jobsClosed: 0, failures: 1 }], "FAILED"],
  ])("finalizes terminal sources as %s", async (sourceRuns, expected) => {
    mocks.syncRunFindUnique.mockResolvedValue({ id: "run-1", totalSources: 1, startedAt: null, sourceRuns });
    mocks.syncRunUpdate.mockImplementation(async ({ data }: { data: unknown }) => data);
    const result = await finalizeSyncRun("run-1");
    expect(result).toMatchObject({ status: expected, completedSources: 1 });
  });

  it("keeps a partially completed run running and aggregates progress", async () => {
    mocks.syncRunFindUnique
      .mockResolvedValueOnce({
        id: "run-1", totalSources: 2, startedAt: new Date(),
        sourceRuns: [
          { status: "COMPLETED", processedCompanies: 2, totalJobs: 4, jobsCreated: 1, jobsUpdated: 2, jobsClosed: 1, failures: 0 },
          { status: "RUNNING", processedCompanies: 1, totalJobs: 2, jobsCreated: 1, jobsUpdated: 0, jobsClosed: 0, failures: 0 },
        ],
      })
      .mockResolvedValueOnce({ id: "run-1", status: "RUNNING" });
    mocks.syncRunUpdateMany.mockResolvedValue({ count: 1 });
    await expect(finalizeSyncRun("run-1")).resolves.toMatchObject({ status: "RUNNING" });
    expect(mocks.syncRunUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalJobs: 6, jobsCreated: 2, completedSources: 1, status: "RUNNING" }) }));
  });

  it("returns null for an absent run and queries latest or selected progress", async () => {
    mocks.syncRunFindUnique.mockResolvedValue(null);
    await expect(finalizeSyncRun("missing")).resolves.toBeNull();
    mocks.syncRunFindFirst.mockResolvedValue({ id: "latest" });
    await getSyncRunProgress();
    expect(mocks.syncRunFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    await getSyncRunProgress("run-1");
    expect(mocks.syncRunFindFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "run-1" } }));
  });
});
