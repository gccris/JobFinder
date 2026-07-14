import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeUser: vi.fn(),
  update: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/lib/api-authorization", () => ({ authorizeUser: mocks.authorizeUser }));
vi.mock("@/lib/db", () => ({ db: { user: { update: mocks.update } } }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hash }));

import { PATCH as updateProfile } from "../app/api/profile/route";
import { PATCH as updatePassword } from "../app/api/profile/password/route";

function request(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("profile routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeUser.mockResolvedValue({
      user: { id: "u1", email: "ana@example.com", name: "Ana", password: "old-hash", role: "USER", accessEnabled: true },
      response: null,
    });
  });

  it("updates a normalized name without returning sensitive fields", async () => {
    mocks.update.mockResolvedValue({ id: "u1", email: "ana@example.com", name: "Ana Silva", image: null });
    const response = await updateProfile(request("/api/profile", { name: "  Ana Silva  " }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Ana Silva" },
      select: { id: true, email: true, name: true, image: true },
    });
    expect(json.user).not.toHaveProperty("password");
  });

  it("rejects an invalid name before writing", async () => {
    const response = await updateProfile(request("/api/profile", { name: "A" }));
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("verifies and replaces an existing password", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    const response = await updatePassword(request("/api/profile/password", { currentPassword: "old", newPassword: "123456", confirmPassword: "123456" }));

    expect(response.status).toBe(200);
    expect(mocks.compare).toHaveBeenCalledWith("old", "old-hash");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { password: "new-hash" } });
  });

  it("rejects an incorrect current password", async () => {
    mocks.compare.mockResolvedValue(false);
    const response = await updatePassword(request("/api/profile/password", { currentPassword: "wrong", newPassword: "123456", confirmPassword: "123456" }));
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets a Google-only account create its first password", async () => {
    mocks.authorizeUser.mockResolvedValue({
      user: { id: "u2", email: "bia@example.com", password: null, role: "USER", accessEnabled: true },
      response: null,
    });
    mocks.hash.mockResolvedValue("first-hash");
    const response = await updatePassword(request("/api/profile/password", { newPassword: "123456", confirmPassword: "123456" }));

    expect(response.status).toBe(200);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { password: "first-hash" } });
  });
});
