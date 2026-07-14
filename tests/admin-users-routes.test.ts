import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/api-authorization", () => ({ authorizeAdmin: mocks.authorizeAdmin }));
vi.mock("@/lib/db", () => ({ db: { user: {
  findMany: mocks.findMany,
  findUnique: mocks.findUnique,
  update: mocks.update,
} } }));

import { GET } from "../app/api/admin/users/route";
import { PATCH } from "../app/api/admin/users/[id]/access/route";

const context = { params: { id: "user-1" } };
const request = (body: unknown) => new NextRequest("http://localhost/api/admin/users/user-1/access", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("admin user access routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeAdmin.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" }, response: null });
  });

  it("protects the list and access update", async () => {
    mocks.authorizeAdmin.mockResolvedValue({ user: null, response: new Response(null, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect((await PATCH(request({ enabled: true }), context)).status).toBe(403);
  });

  it("lists the safe user fields in pending-first order", async () => {
    const users = [{ id: "user-1", email: "ana@example.com", role: "USER", accessEnabled: false }];
    mocks.findMany.mockResolvedValue(users);
    expect(await (await GET()).json()).toEqual({ success: true, users });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ accessEnabled: "asc" }, { createdAt: "desc" }],
      select: expect.not.objectContaining({ password: true }),
    }));
  });

  it("validates the payload and missing users", async () => {
    expect((await PATCH(request({ enabled: "yes" }), context)).status).toBe(400);
    mocks.findUnique.mockResolvedValue(null);
    expect((await PATCH(request({ enabled: true }), context)).status).toBe(404);
  });

  it("does not change administrator access", async () => {
    mocks.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" });
    expect((await PATCH(request({ enabled: false }), context)).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("approves and revokes idempotently", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1", role: "USER" });
    const updated = { id: "user-1", accessEnabled: true };
    mocks.update.mockResolvedValue(updated);
    expect(await (await PATCH(request({ enabled: true }), context)).json()).toEqual({ success: true, user: updated });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { accessEnabled: true } }));

    mocks.update.mockResolvedValue({ ...updated, accessEnabled: false });
    expect((await PATCH(request({ enabled: false }), context)).status).toBe(200);
  });
});
