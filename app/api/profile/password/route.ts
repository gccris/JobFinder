import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { authorizeUser } from "@/lib/api-authorization";
import { db } from "@/lib/db";
import { normalizePasswordInput, validatePasswordInput } from "@/lib/profile";

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;

  const input = normalizePasswordInput(await request.json().catch(() => null));
  const validationError = validatePasswordInput(input, Boolean(authorization.user.password));
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  if (authorization.user.password) {
    const validCurrentPassword = await compare(input.currentPassword, authorization.user.password);
    if (!validCurrentPassword) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
    }
  }

  const password = await hash(input.newPassword, 10);
  await db.user.update({ where: { id: authorization.user.id }, data: { password } });

  return NextResponse.json({ success: true });
}
