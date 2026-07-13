import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeUser: vi.fn(), authorizeAdmin: vi.fn(),
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), deleteJob: vi.fn(),
}));
vi.mock("@/lib/api-authorization", () => ({ authorizeUser: mocks.authorizeUser, authorizeAdmin: mocks.authorizeAdmin }));
vi.mock("@/lib/db", () => ({ db: { job: {
  findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique,
  deleteMany: mocks.deleteMany, delete: mocks.deleteJob,
} } }));

import { DELETE as deleteAll, GET as listJobs } from "../app/api/jobs/route";
import { DELETE as deleteOne, GET as getJob } from "../app/api/jobs/[id]/route";

const user = { id: "user-1", role: "USER" };

describe("jobs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeUser.mockResolvedValue({ user, response: null });
    mocks.authorizeAdmin.mockResolvedValue({ user: { ...user, role: "ADMIN" }, response: null });
  });

  it("returns an authorization response without touching jobs", async () => {
    mocks.authorizeUser.mockResolvedValue({ user: null, response: NextResponse.json({ error: "no" }, { status: 401 }) });
    const response = await listJobs(new NextRequest("http://localhost/api/jobs"));
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("builds combined filters, pagination and user state", async () => {
    mocks.findMany.mockResolvedValue([{ id: "job-1", savedByUsers: [{ id: "saved" }], applications: [{ status: "APPLIED" }] }]);
    mocks.count.mockResolvedValue(21);
    const request = new NextRequest("http://localhost/api/jobs?page=2&limit=10&categories=backend,frontend&location=Brazil&search=Node&salaryMin=1000&salaryMax=5000&salaryOnly=true&workplaceTypes=remote&sortBy=title&sortOrder=asc");
    const response = await listJobs(request);
    const json = await response.json();
    const call = mocks.findMany.mock.calls[0][0];

    expect(call).toMatchObject({ skip: 10, take: 10, orderBy: { title: "asc" } });
    expect(call.where).toMatchObject({
      status: "OPEN",
      category: { in: ["BACKEND", "FRONTEND"] },
      location: { contains: "Brazil", mode: "insensitive" },
      workplaceType: { in: ["REMOTE", "UNSPECIFIED"] },
    });
    expect(call.where.AND).toHaveLength(2);
    expect(call.where.OR).toHaveLength(6);
    expect(json.data[0]).toMatchObject({ id: "job-1", saved: true, applicationStatus: "APPLIED" });
    expect(json.data[0]).not.toHaveProperty("savedByUsers");
    expect(json.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  it("falls back to posted date sorting and returns a safe 500", async () => {
    mocks.findMany.mockRejectedValue(new Error("db"));
    const response = await listJobs(new NextRequest("http://localhost/api/jobs?sortBy=invalid"));
    expect(response.status).toBe(500);
  });

  it("returns job detail with saved/application/admin state", async () => {
    mocks.authorizeUser.mockResolvedValue({ user: { ...user, role: "ADMIN" }, response: null });
    mocks.findUnique.mockResolvedValue({ id: "job-1", savedByUsers: [], applications: [{ status: "INTERVIEWING" }], signals: { keywords: ["react"] } });
    const response = await getJob(new NextRequest("http://localhost/api/jobs/job-1"), { params: { id: "job-1" } });
    expect(await response.json()).toMatchObject({ id: "job-1", saved: false, applicationStatus: "INTERVIEWING", canDelete: true });
  });

  it("returns 404 for an absent detail", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect((await getJob(new NextRequest("http://localhost/api/jobs/missing"), { params: { id: "missing" } })).status).toBe(404);
  });

  it("requires admin and deletes all or one job", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 3 });
    expect(await (await deleteAll()).json()).toMatchObject({ success: true, deleted: { jobs: 3 } });
    mocks.deleteJob.mockResolvedValue({ id: "job-1" });
    expect((await deleteOne(new NextRequest("http://localhost/api/jobs/job-1"), { params: { id: "job-1" } })).status).toBe(200);
    mocks.deleteJob.mockRejectedValue(new Error("missing"));
    expect((await deleteOne(new NextRequest("http://localhost/api/jobs/missing"), { params: { id: "missing" } })).status).toBe(404);
  });
});
