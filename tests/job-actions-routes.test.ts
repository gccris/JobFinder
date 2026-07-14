import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeUser: vi.fn(),
  jobFind: vi.fn(), savedFind: vi.fn(), savedCreate: vi.fn(), savedDelete: vi.fn(),
  applicationFind: vi.fn(), applicationCreate: vi.fn(), applicationUpdate: vi.fn(), applicationDelete: vi.fn(),
}));
vi.mock("@/lib/api-authorization", () => ({ authorizeUser: mocks.authorizeUser }));
vi.mock("@/lib/db", () => ({ db: {
  job: { findUnique: mocks.jobFind },
  savedJob: { findUnique: mocks.savedFind, create: mocks.savedCreate, deleteMany: mocks.savedDelete },
  jobApplication: { findUnique: mocks.applicationFind, create: mocks.applicationCreate, update: mocks.applicationUpdate, deleteMany: mocks.applicationDelete },
} }));

import { DELETE as unsave, POST as save } from "../app/api/jobs/[id]/save/route";
import { GET as savedStatus } from "../app/api/jobs/[id]/saved/route";
import { DELETE as deleteApplication, GET as getApplication, PATCH as patchApplication, POST as createApplication } from "../app/api/jobs/[id]/application/route";

const request = (method = "GET", body?: unknown) => new NextRequest("http://localhost/api/jobs/job-1", {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: body === undefined ? undefined : { "content-type": "application/json" },
});
const context = { params: { id: "job-1" } };

describe("saved job routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeUser.mockResolvedValue({ user: { id: "user-1" }, response: null });
    mocks.jobFind.mockResolvedValue({ id: "job-1" });
  });

  it("rejects anonymous users", async () => {
    mocks.authorizeUser.mockResolvedValue({ user: null, response: new Response(null, { status: 401 }) });
    expect((await save(request("POST"), context)).status).toBe(401);
    expect((await savedStatus(request(), context)).status).toBe(401);
  });

  it("rejects missing jobs and duplicate saves", async () => {
    mocks.jobFind.mockResolvedValueOnce(null);
    expect((await save(request("POST"), context)).status).toBe(404);
    mocks.savedFind.mockResolvedValueOnce({ id: "saved" });
    expect((await save(request("POST"), context)).status).toBe(400);
  });

  it("creates, reports and idempotently removes a saved job", async () => {
    mocks.savedFind.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "saved" });
    mocks.savedCreate.mockResolvedValue({ id: "saved", jobId: "job-1" });
    expect(await (await save(request("POST"), context)).json()).toMatchObject({ id: "saved" });
    expect(await (await savedStatus(request(), context)).json()).toEqual({ saved: true });
    expect(await (await unsave(request("DELETE"), context)).json()).toEqual({ success: true });
    expect(mocks.savedDelete).toHaveBeenCalledWith({ where: { userId: "user-1", jobId: "job-1" } });
  });
});

describe("job application routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeUser.mockResolvedValue({ user: { id: "user-1" }, response: null });
    mocks.jobFind.mockResolvedValue({ id: "job-1" });
  });

  it("protects every operation", async () => {
    mocks.authorizeUser.mockResolvedValue({ user: null, response: new Response(null, { status: 401 }) });
    expect((await getApplication(request(), context)).status).toBe(401);
    expect((await createApplication(request("POST"), context)).status).toBe(401);
    expect((await patchApplication(request("PATCH", { status: "APPLIED" }), context)).status).toBe(401);
    expect((await deleteApplication(request("DELETE"), context)).status).toBe(401);
  });

  it("creates APPLIED with an event and is idempotent", async () => {
    mocks.applicationFind.mockResolvedValueOnce(null);
    mocks.applicationCreate.mockResolvedValue({ id: "application-1", status: "APPLIED" });
    const response = await createApplication(request("POST"), context);
    expect(response.status).toBe(201);
    expect(mocks.applicationCreate).toHaveBeenCalledWith({ data: {
      userId: "user-1", jobId: "job-1", status: "APPLIED", events: { create: { status: "APPLIED" } },
    } });
    mocks.applicationFind.mockResolvedValueOnce({ id: "existing", status: "APPLIED" });
    expect((await createApplication(request("POST"), context)).status).toBe(200);
  });

  it("validates transitions and records only changed statuses", async () => {
    expect((await patchApplication(request("PATCH", { status: "UNKNOWN" }), context)).status).toBe(400);
    mocks.applicationFind.mockResolvedValueOnce(null);
    expect((await patchApplication(request("PATCH", { status: "APPROVED" }), context)).status).toBe(404);
    mocks.applicationFind.mockResolvedValueOnce({ id: "application-1", status: "APPLIED" });
    mocks.applicationUpdate.mockResolvedValue({ id: "application-1", status: "INTERVIEWING" });
    expect((await patchApplication(request("PATCH", { status: "INTERVIEWING" }), context)).status).toBe(200);
    expect(mocks.applicationUpdate).toHaveBeenCalledWith({ where: { id: "application-1" }, data: { status: "INTERVIEWING", events: { create: { status: "INTERVIEWING" } } } });
  });

  it("gets and deletes only the current user's application", async () => {
    mocks.applicationFind.mockResolvedValue({ id: "application-1" });
    expect(await (await getApplication(request(), context)).json()).toEqual({ application: { id: "application-1" } });
    expect(await (await deleteApplication(request("DELETE"), context)).json()).toEqual({ success: true });
    expect(mocks.applicationDelete).toHaveBeenCalledWith({ where: { userId: "user-1", jobId: "job-1" } });
  });
});
