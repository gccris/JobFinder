import { describe, expect, it } from "vitest";
import {
  createSession,
  originalRequestUri,
  parseCookies,
  secretsMatch,
  verifySession,
  wakingResponse,
} from "../infra/modules/auto-wake/lambda/controller.mjs";

describe("auto-wake controller", () => {
  it("creates and verifies an expiring signed session", () => {
    const session = createSession("signing-key", 60, 1_000_000);
    expect(verifySession(session, "signing-key", 1_030_000)).toBe(true);
    expect(verifySession(session, "wrong-key", 1_030_000)).toBe(false);
    expect(verifySession(session, "signing-key", 1_061_000)).toBe(false);
  });

  it("parses cookies without truncating encoded values", () => {
    expect(parseCookies("one=first; session=a.b-c_1; empty=")).toEqual({
      one: "first",
      session: "a.b-c_1",
      empty: "",
    });
  });

  it("preserves path and query string", () => {
    expect(originalRequestUri({ rawPath: "/jobs/123", rawQueryString: "status=saved" })).toBe(
      "/jobs/123?status=saved"
    );
  });

  it("returns an auto-refresh page only for safe methods", () => {
    const page = wakingResponse({ value: "WAKING", method: "GET" }, "/jobs/123");
    expect(page.statusCode).toBe(202);
    expect(page.body).toContain("/jobs/123");

    const mutation = wakingResponse({ value: "WAKING", method: "POST" }, "/api/jobs");
    expect(mutation.statusCode).toBe(503);
    expect(mutation.headers["retry-after"]).toBe("10");
  });

  it("compares access tokens without accepting partial values", () => {
    expect(secretsMatch("complete-token", "complete-token")).toBe(true);
    expect(secretsMatch("complete", "complete-token")).toBe(false);
  });
});
