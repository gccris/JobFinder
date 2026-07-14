import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: null as any,
  findFirst: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error { code = "credentials"; },
  default: (config: unknown) => {
    mocks.config = config;
    return { auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));
vi.mock("next-auth/providers/google", () => ({ default: (config: unknown) => ({ id: "google", ...config as object }) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ db: { user: { findFirst: mocks.findFirst } } }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));

await import("../lib/auth");

const authorize = (credentials: { email?: string; password?: string }) =>
  mocks.config.providers.find((provider: { authorize?: unknown }) => provider.authorize).authorize(credentials);

describe("credential access approval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps invalid credentials generic", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(authorize({ email: "missing@example.com", password: "secret" })).resolves.toBeNull();

    mocks.findFirst.mockResolvedValue({ password: "hash", role: "USER", accessEnabled: true });
    mocks.compare.mockResolvedValue(false);
    await expect(authorize({ email: "ana@example.com", password: "wrong" })).resolves.toBeNull();
  });

  it("does not attempt password login for a Google-only account", async () => {
    mocks.findFirst.mockResolvedValue({ password: null, role: "USER", accessEnabled: true });
    await expect(authorize({ email: "ana@example.com", password: "secret" })).resolves.toBeNull();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("returns an approved user", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u1", email: "ana@example.com", name: "Ana", password: "hash", role: "USER", accessEnabled: true });
    mocks.compare.mockResolvedValue(true);
    await expect(authorize({ email: "ANA@example.com", password: "secret" })).resolves.toMatchObject({ id: "u1", role: "USER" });
  });

  it("uses access_pending after validating the password", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u1", email: "ana@example.com", name: "Ana", password: "hash", role: "USER", accessEnabled: false });
    mocks.compare.mockResolvedValue(true);
    await expect(authorize({ email: "ana@example.com", password: "secret" })).rejects.toMatchObject({ code: "access_pending" });
    expect(mocks.compare).toHaveBeenCalled();
  });

  it("always allows administrators with valid credentials", async () => {
    mocks.findFirst.mockResolvedValue({ id: "a1", email: "admin@example.com", name: "Admin", password: "hash", role: "ADMIN", accessEnabled: false });
    mocks.compare.mockResolvedValue(true);
    await expect(authorize({ email: "admin@example.com", password: "secret" })).resolves.toMatchObject({ id: "a1", role: "ADMIN" });
  });
});
