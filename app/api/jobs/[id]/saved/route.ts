import { authorizeUser } from "@/lib/api-authorization";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorization = await authorizeUser();
    if (!authorization.user) return authorization.response;
    const user = authorization.user;

    const savedJob = await db.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: params.id,
        },
      },
    });

    return NextResponse.json({
      saved: !!savedJob,
    });
  } catch (error) {
    console.error("Error checking saved status:", error);
    return NextResponse.json(
      { error: "Failed to check saved status" },
      { status: 500 }
    );
  }
}
