import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { syncAllJobs } from "@/lib/sync-jobs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Only admins can sync jobs" },
        { status: 403 }
      );
    }

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
