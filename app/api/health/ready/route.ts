import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSyncQueue } from "@/lib/sync-queue";

export const dynamic = "force-dynamic";

type DependencyStatus = {
  ok: boolean;
  message?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export async function GET() {
  const checks: Record<string, DependencyStatus> = {
    database: { ok: false },
    redis: { ok: false },
  };

  await Promise.allSettled([
    db.$queryRaw`SELECT 1`
      .then(() => {
        checks.database = { ok: true };
      })
      .catch((error) => {
        checks.database = { ok: false, message: getErrorMessage(error) };
      }),
    getSyncQueue()
      .waitUntilReady()
      .then(() => {
        checks.redis = { ok: true };
      })
      .catch((error) => {
        checks.redis = { ok: false, message: getErrorMessage(error) };
      }),
  ]);

  const ready = Object.values(checks).every((check) => check.ok);

  return NextResponse.json(
    {
      status: ready ? "ok" : "error",
      check: "readiness",
      timestamp: new Date().toISOString(),
      dependencies: checks,
    },
    { status: ready ? 200 : 503 },
  );
}
