import { authorizeUser } from "@/lib/api-authorization";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorization = await authorizeUser();
    if (!authorization.user) return authorization.response;
    const user = authorization.user;

    // Check if job exists
    const job = await db.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if already saved
    const existing = await db.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: params.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Job already saved" },
        { status: 400 }
      );
    }

    const savedJob = await db.savedJob.create({
      data: {
        userId: user.id,
        jobId: params.id,
      },
    });

    return NextResponse.json(savedJob);
  } catch (error) {
    console.error("Error saving job:", error);
    return NextResponse.json(
      { error: "Failed to save job" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorization = await authorizeUser();
    if (!authorization.user) return authorization.response;
    const user = authorization.user;

    await db.savedJob.deleteMany({
      where: {
        userId: user.id,
        jobId: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing saved job:", error);
    return NextResponse.json(
      { error: "Failed to remove saved job" },
      { status: 500 }
    );
  }
}
