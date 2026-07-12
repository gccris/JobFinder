import { authorizeAdmin } from "@/lib/api-authorization";
import { getSyncRunProgress } from "@/lib/sync-run-service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  const runId = request.nextUrl.searchParams.get("runId") || undefined;
  const run = await getSyncRunProgress(runId);
  if (!run) return NextResponse.json({ success: false, error: "Sincronização não encontrada" }, { status: 404 });

  const live = run.sourceRuns.reduce((sum, source) => ({
    processedCompanies: sum.processedCompanies + source.processedCompanies,
    totalJobs: sum.totalJobs + source.totalJobs,
    createdJobs: sum.createdJobs + source.jobsCreated,
    jobsUpdated: sum.jobsUpdated + source.jobsUpdated,
    jobsClosed: sum.jobsClosed + source.jobsClosed,
    failures: sum.failures + source.failures,
  }), { processedCompanies: 0, totalJobs: 0, createdJobs: 0, jobsUpdated: 0, jobsClosed: 0, failures: 0 });

  return NextResponse.json({
    success: true,
    progress: {
      runId: run.id,
      status: run.status,
      running: run.status === "QUEUED" || run.status === "RUNNING",
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      totalCompanies: run.totalCompanies,
      ...live,
      bySource: Object.fromEntries(run.sourceRuns.map((source) => [source.source, {
        status: source.status,
        totalCompanies: source.totalCompanies,
        processedCompanies: source.processedCompanies,
        totalJobs: source.totalJobs,
        createdJobs: source.jobsCreated,
        jobsUpdated: source.jobsUpdated,
        jobsClosed: source.jobsClosed,
        failures: source.failures,
        currentCompany: source.currentCompany,
        error: source.error,
      }])),
    },
  });
}
