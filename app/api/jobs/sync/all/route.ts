import { authorizeAdmin } from "@/lib/api-authorization";
import { ActiveSyncRunError, enqueueSyncRun } from "@/lib/sync-run-service";
import { normalizeSelectedSources } from "@/lib/sync-sources";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;

  const body = await request.json().catch(() => ({}));
  const sources = normalizeSelectedSources(body?.sources);
  if (sources.length === 0) {
    return NextResponse.json({ success: false, error: "Selecione ao menos uma fonte válida" }, { status: 400 });
  }

  try {
    const run = await enqueueSyncRun({ sources, trigger: "MANUAL" });
    return NextResponse.json({ success: true, runId: run.id, status: run.status }, { status: 202 });
  } catch (error) {
    if (error instanceof ActiveSyncRunError) {
      return NextResponse.json({ success: false, error: error.message, runId: error.runId }, { status: 409 });
    }
    console.error("Erro ao criar sincronização:", error);
    return NextResponse.json({ success: false, error: "Falha ao enfileirar sincronização" }, { status: 500 });
  }
}
