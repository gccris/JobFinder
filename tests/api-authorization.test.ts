import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasToolAccess: (user: { role: string; accessEnabled: boolean }) => user.role === "ADMIN" || user.accessEnabled,
}));

import { authorizeAdmin, authorizeUser } from "../lib/api-authorization";

describe("API authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const result = await authorizeUser();
    expect(result.response?.status).toBe(401);
  });

  it("returns ACCESS_PENDING for a revoked user", async () => {
    mocks.getCurrentUser.mockResolvedValue({ role: "USER", accessEnabled: false });
    const result = await authorizeUser();
    expect(result.response?.status).toBe(403);
    expect(await result.response?.json()).toMatchObject({ code: "ACCESS_PENDING" });
  });

  it("allows enabled users and administrators", async () => {
    const user = { role: "USER", accessEnabled: true };
    mocks.getCurrentUser.mockResolvedValue(user);
    expect((await authorizeUser()).user).toBe(user);

    const admin = { role: "ADMIN", accessEnabled: false };
    mocks.getCurrentUser.mockResolvedValue(admin);
    expect((await authorizeAdmin()).user).toBe(admin);
  });

  it("rejects a non-admin from admin operations", async () => {
    mocks.getCurrentUser.mockResolvedValue({ role: "USER", accessEnabled: true });
    expect((await authorizeAdmin()).response?.status).toBe(403);
  });
});
