import { NextRequest, NextResponse } from "next/server";

import { authorizeAdmin } from "@/lib/api-authorization";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await authorizeAdmin();
  if (!authorization.user) return authorization.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "O campo enabled deve ser booleano" }, { status: 400 });
  }

  const existing = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  if (existing.role === "ADMIN") {
    return NextResponse.json(
      { error: "O acesso de administradores não pode ser alterado" },
      { status: 409 }
    );
  }

  const user = await db.user.update({
    where: { id: existing.id },
    data: { accessEnabled: body.enabled },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessEnabled: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, user });
}
