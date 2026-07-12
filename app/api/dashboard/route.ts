import { ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { NextRequest, NextResponse } from "next/server";

const validPeriods = new Set(["7", "30", "90", "all"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const period = validPeriods.has(request.nextUrl.searchParams.get("period") || "")
    ? request.nextUrl.searchParams.get("period")!
    : "30";
  const since = period === "all" ? undefined : new Date(Date.now() - Number(period) * 86400000);

  const [saved, applications, events] = await Promise.all([
    db.savedJob.findMany({
      where: { userId: user.id, job: { applications: { none: { userId: user.id } } } },
      include: { job: true },
      orderBy: { savedAt: "desc" },
    }),
    db.jobApplication.findMany({
      where: { userId: user.id },
      include: { job: { include: { signals: true, savedByUsers: { where: { userId: user.id }, select: { id: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.jobApplicationEvent.findMany({
      where: { application: { userId: user.id }, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const chartMap = new Map<string, Record<ApplicationStatus, number>>();
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const row = chartMap.get(day) || { APPLIED: 0, INTERVIEWING: 0, REJECTED: 0, APPROVED: 0 };
    row[event.status]++;
    chartMap.set(day, row);
  }
  if (period !== "all") {
    for (let offset = Number(period) - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const day = date.toISOString().slice(0, 10);
      if (!chartMap.has(day)) chartMap.set(day, { APPLIED: 0, INTERVIEWING: 0, REJECTED: 0, APPROVED: 0 });
    }
  }

  const keywordCounts = new Map<string, number>();
  for (const application of applications) {
    for (const raw of application.job.signals?.keywords || []) {
      const keyword = raw.trim().toLocaleLowerCase("pt-BR");
      if (keyword) keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }
  }
  const ranked = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]);
  const keywords = ranked.slice(0, 8).map(([name, value]) => ({ name, value }));
  const other = ranked.slice(8).reduce((sum, [, value]) => sum + value, 0);
  if (other) keywords.push({ name: "Outros", value: other });

  return NextResponse.json({
    saved: saved.map(({ job, savedAt }) => ({ job: { ...job, saved: true }, savedAt })),
    applications: applications.map(({ job, ...application }) => ({
      ...application,
      job: { ...job, saved: job.savedByUsers.length > 0, savedByUsers: undefined },
    })),
    transitions: [...chartMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({ date, ...counts })),
    keywords,
  });
}
