import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), savedFindMany: vi.fn(), applicationFindMany: vi.fn(), eventFindMany: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db", () => ({ db: {
  savedJob: { findMany: mocks.savedFindMany },
  jobApplication: { findMany: mocks.applicationFindMany },
  jobApplicationEvent: { findMany: mocks.eventFindMany },
} }));

import { GET } from "../app/api/dashboard/route";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00.000Z"));
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.savedFindMany.mockResolvedValue([{ savedAt: new Date("2026-07-12"), job: { id: "saved-1" } }]);
    mocks.applicationFindMany.mockResolvedValue([
      { id: "a1", status: "APPLIED", job: { id: "job-1", signals: { keywords: [" React ", "TypeScript"] }, savedByUsers: [{ id: "saved" }] } },
      { id: "a2", status: "INTERVIEWING", job: { id: "job-2", signals: { keywords: ["react"] }, savedByUsers: [] } },
    ]);
    mocks.eventFindMany.mockResolvedValue([
      { status: "APPLIED", createdAt: new Date("2026-07-11T10:00:00Z") },
      { status: "INTERVIEWING", createdAt: new Date("2026-07-12T10:00:00Z") },
    ]);
  });

  afterEach(() => vi.useRealTimers());

  it("protects dashboard data", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/dashboard"))).status).toBe(401);
  });

  it("aggregates saved jobs, applications, transitions and keywords", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dashboard?period=7"));
    const json = await response.json();

    expect(json.saved[0]).toMatchObject({ job: { id: "saved-1", saved: true } });
    expect(json.applications[0]).toMatchObject({ id: "a1", job: { id: "job-1", saved: true } });
    expect(json.applications[0].job.savedByUsers).toBeUndefined();
    expect(json.transitions).toHaveLength(7);
    expect(json.transitions.at(-1)).toMatchObject({ date: "2026-07-12", INTERVIEWING: 1 });
    expect(json.keywords).toEqual([{ name: "react", value: 2 }, { name: "typescript", value: 1 }]);
  });

  it("uses 30 days for invalid periods and does not fill period all", async () => {
    const invalid = await (await GET(new NextRequest("http://localhost/api/dashboard?period=invalid"))).json();
    expect(invalid.transitions).toHaveLength(30);
    const all = await (await GET(new NextRequest("http://localhost/api/dashboard?period=all"))).json();
    expect(all.transitions).toHaveLength(2);
    expect(mocks.eventFindMany.mock.calls.at(-1)?.[0].where).not.toHaveProperty("createdAt");
  });

  it("groups keywords beyond the top eight as Outros", async () => {
    mocks.applicationFindMany.mockResolvedValue([{ id: "a", job: {
      id: "job", savedByUsers: [], signals: { keywords: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] },
    } }]);
    const json = await (await GET(new NextRequest("http://localhost/api/dashboard?period=all"))).json();
    expect(json.keywords).toHaveLength(9);
    expect(json.keywords.at(-1)).toEqual({ name: "Outros", value: 2 });
  });
});
