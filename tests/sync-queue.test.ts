import { afterEach, describe, expect, it } from "vitest";

import { buildSyncSourceJobId, getRedisConnection } from "../lib/sync-queue";

describe("sync queue primitives", () => {
  const original = process.env.REDIS_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it("builds stable source job IDs", () => {
    expect(buildSyncSourceJobId("run-1", "lever")).toBe("run-1__lever");
  });

  it("uses Redis defaults", () => {
    delete process.env.REDIS_URL;
    expect(getRedisConnection()).toMatchObject({ host: "localhost", port: 6379, maxRetriesPerRequest: null });
  });

  it("parses credentials, database and port", () => {
    process.env.REDIS_URL = "redis://user:secret@redis.internal:6380/4";
    expect(getRedisConnection()).toEqual({
      host: "redis.internal", port: 6380, username: "user", password: "secret", db: 4, maxRetriesPerRequest: null,
    });
  });

  it("enables TLS for rediss URLs", () => {
    process.env.REDIS_URL = "rediss://redis.internal:6379";
    expect(getRedisConnection()).toMatchObject({ host: "redis.internal", port: 6379, tls: {} });
  });
});
