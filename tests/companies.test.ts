import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), readdir: vi.fn(), groupBy: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: mocks.readFile, readdir: mocks.readdir }));
vi.mock("@/lib/db", () => ({ db: { job: { groupBy: mocks.groupBy } } }));

import { getRegisteredCompanies } from "../lib/companies";
import { getHomeStats } from "../lib/home-stats";

const files = ["lever_companies.json", "greenhouse_companies.json", "ashby_companies.json", "teamtailor_companies.json", "workable_companies.json", "jazz_companies.json", "smartrecruiters_companies.json"];
const links: Record<string, unknown[]> = {
  lever_companies: [{ link: "https://jobs.lever.co/ACME", title: "Acme - Lever" }, { link: "https://jobs.lever.co/acme", title: "Duplicate" }],
  greenhouse_companies: [{ link: "https://job-boards.greenhouse.io/Beta", title: "Job Openings - Beta" }],
  ashby_companies: [{ link: "https://jobs.ashbyhq.com/Gamma" }],
  teamtailor_companies: [{ link: "https://Delta.teamtailor.com/jobs" }],
  workable_companies: [{ link: "https://apply.workable.com/Epsilon" }],
  jazz_companies: [{ link: "https://Zeta.jazz.co/jobs", title: "Zeta - JazzHR" }],
  smartrecruiters_companies: [{ link: "https://careers.smartrecruiters.com/Eta", title: "Eta - SmartRecruiters" }],
};

describe("registered companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readdir.mockResolvedValue(files.map((name) => ({ name, isFile: () => true })));
    mocks.readFile.mockImplementation(async (path: unknown) => {
      const name = String(path).split(/[\\/]/).at(-1)?.replace(".json", "") || "";
      return JSON.stringify(links[name] || []);
    });
  });

  it("extracts, normalizes, deduplicates and sorts every supported source", async () => {
    const companies = await getRegisteredCompanies();
    expect(companies).toHaveLength(7);
    expect(companies.map((company) => company.source).sort()).toEqual([
      "ashby", "greenhouse", "jazzhr", "lever", "smartrecruiters", "teamtailor", "workable",
    ]);
    expect(companies.find((company) => company.source === "lever")).toMatchObject({ name: "Acme", slug: "acme", url: "https://jobs.lever.co/acme" });
    expect(companies.find((company) => company.source === "ashby")?.name).toBe("Gamma");
  });

  it("falls back to the alternate directory for a non-array file", async () => {
    mocks.readFile.mockResolvedValueOnce(JSON.stringify({ invalid: true }));
    await expect(getRegisteredCompanies()).resolves.toHaveLength(7);
  });
});

describe("home stats", () => {
  it("fills absent sources and calculates totals", async () => {
    mocks.groupBy.mockResolvedValue([
      { source: "lever", _count: { _all: 4 } },
      { source: "greenhouse", _count: { _all: 2 } },
    ]);
    const stats = await getHomeStats();
    expect(stats).toMatchObject({ totalOpenJobs: 6, activeSources: 2 });
    expect(stats.sources).toHaveLength(7);
    expect(stats.sources.find((source) => source.source === "ashby")?.openJobs).toBe(0);
  });
});
