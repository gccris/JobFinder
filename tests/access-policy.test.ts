import { describe, expect, it } from "vitest";

import { isApiPath, isAuthPage, isPublicPath, requiresAdmin } from "../lib/access-policy";

describe("access policy", () => {
  it("keeps only the intended pages and auth handlers public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/api/auth/session")).toBe(true);
    expect(isPublicPath("/api/auth/register")).toBe(true);
    expect(isPublicPath("/jobs")).toBe(false);
    expect(isPublicPath("/companies")).toBe(false);
    expect(isPublicPath("/api/jobs")).toBe(false);
  });

  it("identifies auth pages and APIs", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/")).toBe(false);
    expect(isApiPath("/api/jobs")).toBe(true);
    expect(isApiPath("/jobs")).toBe(false);
  });

  it("restricts admin pages, sync handlers and destructive job methods", () => {
    expect(requiresAdmin("/admin")).toBe(true);
    expect(requiresAdmin("/api/admin/source-stats")).toBe(true);
    expect(requiresAdmin("/api/jobs/sync/all", "POST")).toBe(true);
    expect(requiresAdmin("/api/lever/companies", "GET")).toBe(true);
    expect(requiresAdmin("/api/jobs", "DELETE")).toBe(true);
    expect(requiresAdmin("/api/jobs/job-1", "DELETE")).toBe(true);
    expect(requiresAdmin("/api/jobs", "GET")).toBe(false);
    expect(requiresAdmin("/api/jobs/job-1", "GET")).toBe(false);
  });
});
