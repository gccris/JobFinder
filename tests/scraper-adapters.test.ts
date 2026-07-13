import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ limitedAxiosGet: vi.fn(), limitedFetch: vi.fn() }));
vi.mock("@/lib/sync-http", () => ({ limitedAxiosGet: mocks.limitedAxiosGet, limitedFetch: mocks.limitedFetch }));

import { fetchAshbyJobs } from "../lib/scrapers/ashby";
import { fetchGreenhouseJobs } from "../lib/scrapers/greenhouse";
import { fetchJazzhrJobs } from "../lib/scrapers/jazzhr";
import { fetchLeverJobs } from "../lib/scrapers/lever";
import { fetchSmartRecruitersJobs } from "../lib/scrapers/smartrecruiters";
import { fetchTeamtailorJobs } from "../lib/scrapers/teamtailor";
import { fetchWorkableJobs } from "../lib/scrapers/workable";

describe("source scraper adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    delete process.env.SMARTRECRUITERS_TOKEN;
  });

  it("normalizes Lever postings", async () => {
    mocks.limitedAxiosGet.mockResolvedValue({ data: { postings: [{
      id: "lev-1", text: "Senior Backend Engineer", descriptionPlain: "Build APIs",
      categories: { location: "Remote", commitment: "Full-time", department: "Engineering", level: "Senior" },
      workplaceType: "remote", createdAt: 1_700_000_000_000,
      salaryRange: { min: 100000, max: 150000, currency: "USD", interval: "year" },
      urls: { apply: "https://apply", show: "https://job" }, reqCode: "REQ-1",
    }] } });
    const [job] = await fetchLeverJobs("acme");
    expect(job).toMatchObject({
      id: "lev-1", source: "lever", company: "Acme", category: "BACKEND", workplaceType: "REMOTE",
      salaryMin: 100000, salaryMax: 150000, applicationUrl: "https://apply", externalReference: "REQ-1",
    });
    await expect(fetchLeverJobs(" ")).resolves.toEqual([]);
  });

  it("enriches Greenhouse jobs and falls back when detail fails", async () => {
    const summary = { id: 10, title: "Frontend Engineer", absolute_url: "https://greenhouse/job", location: { name: "Hybrid" }, updated_at: "2026-07-01T00:00:00Z" };
    mocks.limitedAxiosGet.mockResolvedValueOnce({ data: { jobs: [summary] } }).mockResolvedValueOnce({ data: {
      ...summary, content: "<p>Build React</p>", departments: [{ name: "Engineering" }],
      pay_input_ranges: [{ min_cents: 10000000, max_cents: 15000000, currency_type: "USD", title: "year" }],
    } });
    const [job] = await fetchGreenhouseJobs("acme", "Acme");
    expect(job).toMatchObject({ source: "greenhouse", externalId: "10", description: "Build React", category: "FRONTEND", salaryMin: 100000, workplaceType: "HYBRID" });

    mocks.limitedAxiosGet.mockReset().mockResolvedValueOnce({ data: { jobs: [summary] } }).mockRejectedValueOnce(new Error("detail"));
    await expect(fetchGreenhouseJobs("acme", "Acme")).resolves.toHaveLength(1);
  });

  it("normalizes Ashby compensation and remote metadata", async () => {
    mocks.limitedAxiosGet.mockResolvedValue({ data: { jobs: [{
      id: "ash-1", title: "Platform Engineer", descriptionHtml: "<p>Terraform</p>", location: "Brazil",
      isRemote: true, department: "Infrastructure", publishedAt: "2026-07-01T00:00:00Z",
      compensation: { scrapeableCompensationSalarySummary: "$100k", summaryComponents: [{ compensationType: "Salary", minValue: 100000, maxValue: 120000, currencyCode: "USD", interval: "year" }] },
    }] } });
    const [job] = await fetchAshbyJobs("acme", "Acme");
    expect(job).toMatchObject({ source: "ashby", category: "PLATFORM_ENGINEER", workplaceType: "REMOTE", salary: "$100k", salaryMin: 100000 });
  });

  it("parses Teamtailor RSS", async () => {
    const xml = `<rss><channel><item><title>Senior DevOps Engineer</title><description><![CDATA[<p>Requirements: Docker</p>]]></description><link>https://team/job</link><guid>tt-1</guid><pubDate>Wed, 01 Jul 2026 10:00:00 GMT</pubDate><remoteStatus>Remote</remoteStatus><tt:department>Engineering</tt:department><tt:location><tt:city>São Paulo</tt:city><tt:country>Brazil</tt:country></tt:location></item></channel></rss>`;
    mocks.limitedFetch.mockResolvedValue({ ok: true, text: async () => xml });
    const [job] = await fetchTeamtailorJobs("acme", "Acme");
    expect(job).toMatchObject({ externalId: "tt-1", source: "teamtailor", category: "DEVOPS", workplaceType: "REMOTE", department: "Engineering" });
    mocks.limitedFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Error" });
    await expect(fetchTeamtailorJobs("acme", "Acme")).rejects.toThrow("Falha ao obter feed Teamtailor");
  });

  it("normalizes Workable response variants", async () => {
    mocks.limitedAxiosGet.mockResolvedValue({ data: { name: "Acme Inc", results: [{
      shortcode: "work-1", title: "QA Engineer", description: "<p>Testing</p>", city: "Lisbon", country: "Portugal",
      remote: true, department: "Quality", employment_type: "Full-time", url: "https://work/job", published_on: "2026-07-01",
    }] } });
    const [job] = await fetchWorkableJobs("acme", "Fallback");
    expect(job).toMatchObject({ externalId: "work-1", source: "workable", company: "Acme Inc", category: "QA", workplaceType: "REMOTE", location: "Lisbon, Portugal" });
  });

  it("parses JazzHR XML", async () => {
    const xml = `<jobs><job><id>jazz-1</id><title>Technical Support</title><description><![CDATA[Requirements: communication. Salary: $50,000 - $60,000 per year]]></description><city>Austin</city><state>TX</state><country>US</country><department>Support</department><type>Full-time</type><remote>true</remote><published>2026-07-01</published><url>https://jazz/job</url></job></jobs>`;
    mocks.limitedFetch.mockResolvedValue({ ok: true, text: async () => xml });
    const [job] = await fetchJazzhrJobs("acme", "Acme");
    expect(job).toMatchObject({ externalId: "jazz-1", source: "jazzhr", category: "SUPPORT", workplaceType: "REMOTE", department: "Support" });
  });

  it("filters and enriches SmartRecruiters postings", async () => {
    mocks.limitedAxiosGet
      .mockResolvedValueOnce({ data: { content: [{
        id: "smart-1", name: "Security Engineer", company: { identifier: "acme", name: "Acme" },
        location: { city: "Berlin", country: "Germany", remote: true },
        jobAd: { sections: { jobDescription: { text: "Security systems" }, qualifications: { text: "Cloud" } } },
        releasedDate: "2026-07-01T00:00:00Z", applyUrl: "https://smart/apply",
      }, { id: "other", name: "Other", company: { identifier: "other" } }] } })
      .mockResolvedValueOnce({ data: { content: [{ postingId: "smart-1", salary: { min: 90000, max: 110000, currency: "EUR", interval: "year" } }] } });
    const jobs = await fetchSmartRecruitersJobs("acme", "Fallback");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "smart-1", source: "smartrecruiters", company: "Acme", category: "SECURITY", workplaceType: "REMOTE" });
  });
});
