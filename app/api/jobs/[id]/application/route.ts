import { ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { authorizeUser } from "@/lib/api-authorization";
import { NextRequest, NextResponse } from "next/server";

const statuses = new Set(Object.values(ApplicationStatus));

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;
  const user = authorization.user;
  const application = await db.jobApplication.findUnique({
    where: { userId_jobId: { userId: user.id, jobId: params.id } },
  });
  return NextResponse.json({ application });
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;
  const user = authorization.user;
  const job = await db.job.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  const existing = await db.jobApplication.findUnique({
    where: { userId_jobId: { userId: user.id, jobId: params.id } },
  });
  if (existing) return NextResponse.json(existing);

  const application = await db.jobApplication.create({
    data: {
      userId: user.id,
      jobId: params.id,
      status: "APPLIED",
      events: { create: { status: "APPLIED" } },
    },
  });
  return NextResponse.json(application, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;
  const user = authorization.user;
  const body = await request.json().catch(() => ({}));
  const status = body.status as ApplicationStatus;
  if (!statuses.has(status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

  const current = await db.jobApplication.findUnique({
    where: { userId_jobId: { userId: user.id, jobId: params.id } },
  });
  if (!current) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  if (current.status === status) return NextResponse.json(current);

  const application = await db.jobApplication.update({
    where: { id: current.id },
    data: { status, events: { create: { status } } },
  });
  return NextResponse.json(application);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;
  const user = authorization.user;
  await db.jobApplication.deleteMany({ where: { userId: user.id, jobId: params.id } });
  return NextResponse.json({ success: true });
}
