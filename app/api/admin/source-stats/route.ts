import { getRegisteredCompanies } from "@/lib/companies";
import { getCurrentAdmin } from "@/lib/current-user";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const [companies, jobCounts, openJobCounts, syncStats] = await Promise.all([
    getRegisteredCompanies(),
    db.job.groupBy({ by: ["source"], _count: { _all: true } }),
    db.job.groupBy({ by: ["source"], where: { status: "OPEN" }, _count: { _all: true } }),
    db.sourceSyncStat.findMany(),
  ]);

  const sources = Array.from(new Set(companies.map((company) => company.source)));
  const totalBySource = new Map(jobCounts.map((row) => [row.source, row._count._all]));
  const openBySource = new Map(openJobCounts.map((row) => [row.source, row._count._all]));
  const statBySource = new Map(syncStats.map((row) => [row.source, row]));

  return NextResponse.json({
    success: true,
    rows: sources.map((source) => {
      const stat = statBySource.get(source);
      return {
        source,
        openJobs: openBySource.get(source) ?? 0,
        totalJobs: totalBySource.get(source) ?? 0,
        successfulJobs: stat?.successfulJobs ?? 0,
        failures: stat?.failures ?? 0,
        lastSyncedAt: stat?.lastSyncedAt.toISOString() ?? null,
      };
    }),
  });
}
