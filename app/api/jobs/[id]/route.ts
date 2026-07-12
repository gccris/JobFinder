import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin, getCurrentUser } from "@/lib/current-user";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    const job = await db.job.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        company: true,
        location: true,
        salary: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryInterval: true,
        workplaceType: true,
        source: true,
        externalId: true,
        externalReference: true,
        externalUpdatedAt: true,
        url: true,
        applicationUrl: true,
        jobUrl: true,
        category: true,
        employmentType: true,
        seniority: true,
        department: true,
        requirements: true,
        tags: true,
        signals: {
          select: {
            keywords: true,
            tools: true,
            languages: true,
            frameworks: true,
            concepts: true,
            normalizedTextHash: true,
            analyzerVersion: true,
            analyzedAt: true,
          },
        },
        postedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        closedAt: true,
        savedByUsers: user ? { where: { userId: user.id }, select: { id: true } } : false,
        applications: user ? { where: { userId: user.id }, select: { status: true } } : false,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...job,
      saved: Array.isArray(job.savedByUsers) && job.savedByUsers.length > 0,
      applicationStatus: Array.isArray(job.applications) ? job.applications[0]?.status ?? null : null,
      savedByUsers: undefined,
      applications: undefined,
      canDelete: user?.role === "ADMIN",
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  try {
    await db.job.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }
}
