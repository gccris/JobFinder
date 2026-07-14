import { authorizeAdmin } from "@/lib/api-authorization";
import { NextRequest, NextResponse } from "next/server";
import { syncAllJobs } from "@/lib/sync-jobs";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdmin();
    if (!authorization.user) return authorization.response;

    // Start sync in background
    await syncAllJobs();

    return NextResponse.json({
      success: true,
      message: "Job sync started"
    });
  } catch (error) {
    console.error("Error syncing jobs:", error);
    return NextResponse.json(
      { error: "Failed to sync jobs" },
      { status: 500 }
    );
  }
}
