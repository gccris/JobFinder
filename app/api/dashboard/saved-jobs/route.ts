import { authorizeUser } from "@/lib/api-authorization";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeUser();
    if (!authorization.user) return authorization.response;
    const user = authorization.user;

    const savedJobs = await db.savedJob.findMany({
      where: { userId: user.id },
      include: {
        job: true,
      },
      orderBy: {
        savedAt: "desc",
      },
    });

    return NextResponse.json({
      data: savedJobs,
    });
  } catch (error) {
    console.error("Error fetching saved jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved jobs" },
      { status: 500 }
    );
  }
}
