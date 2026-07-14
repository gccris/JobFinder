import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findFirst: mocks.findFirst, create: mocks.create } } }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));

import { POST } from "../app/api/auth/register/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid input before querying the database", async () => {
    const response = await POST(request({ email: "invalid" }));
    expect(response.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("detects an existing email case-insensitively", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing" });
    const response = await POST(request({ name: "Ana", email: " ANA@EXAMPLE.COM ", password: "123456", confirmPassword: "123456" }));
    expect(response.status).toBe(409);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { email: { equals: "ana@example.com", mode: "insensitive" } } });
  });

  it("hashes the password and never returns it", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.hash.mockResolvedValue("hashed");
    mocks.create.mockResolvedValue({ id: "user-1", email: "ana@example.com", name: "Ana", password: "hashed" });
    const response = await POST(request({ name: " Ana ", email: "ANA@example.com", password: "123456", confirmPassword: "123456" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.hash).toHaveBeenCalledWith("123456", 10);
    expect(mocks.create).toHaveBeenCalledWith({ data: { email: "ana@example.com", name: "Ana", password: "hashed", role: "USER", accessEnabled: false } });
    expect(json).toEqual({ success: true, user: { id: "user-1", email: "ana@example.com", name: "Ana" } });
  });

  it("returns 500 for an unexpected persistence error", async () => {
    mocks.findFirst.mockRejectedValue(new Error("database offline"));
    const response = await POST(request({ name: "Ana", email: "ana@example.com", password: "123456", confirmPassword: "123456" }));
    expect(response.status).toBe(500);
  });
});
