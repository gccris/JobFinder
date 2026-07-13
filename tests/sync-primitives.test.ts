import { afterEach, describe, expect, it, vi } from "vitest";

import { mapWithConcurrency, positiveInteger, Semaphore } from "../lib/concurrency";
import { normalizeSelectedSources, SYNC_SOURCES } from "../lib/sync-sources";
import { finishSyncProgress, getSyncProgress, markSourceProgress, resetSyncProgress, updateSyncProgress } from "../lib/sync-progress";

describe("concurrency", () => {
  it("rejects invalid limits", () => {
    expect(() => new Semaphore(0)).toThrow("at least 1");
    expect(() => new Semaphore(1.5)).toThrow("at least 1");
  });

  it("limits active work and releases permits after failures", async () => {
    const semaphore = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const operation = (fail = false) => semaphore.run(async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (fail) throw new Error("failure");
    });

    const settled = await Promise.allSettled([operation(true), operation(), operation()]);
    expect(peak).toBe(2);
    expect(settled.map((result) => result.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
  });

  it("maps concurrently while preserving input order and indexes", async () => {
    const indexes: number[] = [];
    await expect(mapWithConcurrency([3, 1, 2], 2, async (value, index) => {
      indexes.push(index);
      return value * 2;
    })).resolves.toEqual([6, 2, 4]);
    expect(indexes.sort()).toEqual([0, 1, 2]);
    await expect(mapWithConcurrency([], 3, async (value) => value)).resolves.toEqual([]);
  });

  it("parses positive integers with a fallback", () => {
    expect(positiveInteger("4", 2)).toBe(4);
    expect(positiveInteger("0", 2)).toBe(2);
    expect(positiveInteger("1.5", 2)).toBe(2);
    expect(positiveInteger(undefined, 2)).toBe(2);
  });
});

describe("sync sources", () => {
  it("normalizes, filters and deduplicates source selections", () => {
    expect(normalizeSelectedSources([" Lever ", "lever", "GREENHOUSE", 1, "unknown"]))
      .toEqual(["lever", "greenhouse"]);
    expect(normalizeSelectedSources("lever")).toEqual([]);
    expect(SYNC_SOURCES).toHaveLength(7);
  });
});

describe("sync progress", () => {
  afterEach(() => {
    delete globalThis.__jobSyncProgress;
    vi.useRealTimers();
  });

  it("resets, updates aggregate and source progress, then finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00.000Z"));
    expect(resetSyncProgress(4)).toMatchObject({ running: true, totalCompanies: 4, startedAt: "2026-07-12T12:00:00.000Z" });

    updateSyncProgress({ processedCompanies: 1, totalJobs: 5, source: "lever" });
    markSourceProgress("lever", { processedCompanies: 2, createdJobs: 3 });
    expect(getSyncProgress()).toMatchObject({
      processedCompanies: 1,
      totalJobs: 5,
      bySource: { lever: { processedCompanies: 2, totalJobs: 5, createdJobs: 3 } },
    });

    expect(finishSyncProgress()).toMatchObject({ running: false, finishedAt: "2026-07-12T12:00:00.000Z" });
  });

  it("lazily creates default progress", () => {
    expect(getSyncProgress()).toMatchObject({ running: false, bySource: {}, totalJobs: 0 });
    expect(updateSyncProgress({ running: true })).toMatchObject({ running: true, bySource: {} });
    expect(updateSyncProgress({ source: "ashby" })).toMatchObject({
      bySource: { ashby: { totalCompanies: 0, processedCompanies: 0, totalJobs: 0, createdJobs: 0, failures: 0 } },
    });
    expect(updateSyncProgress({ source: "ashby", totalJobs: 2 })).toMatchObject({
      bySource: { ashby: { totalCompanies: 0, processedCompanies: 0, totalJobs: 2, createdJobs: 0, failures: 0 } },
    });
    expect(markSourceProgress("lever", { failures: 1 })).toMatchObject({
      bySource: { lever: { totalCompanies: 0, processedCompanies: 0, totalJobs: 0, createdJobs: 0, failures: 1 } },
    });
  });
});
