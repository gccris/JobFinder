import { NextResponse } from "next/server";

import { getCurrentUser, hasToolAccess } from "./current-user";

export async function authorizeUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  if (!hasToolAccess(user)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Seu acesso ainda não foi liberado pelo administrador.", code: "ACCESS_PENDING" },
        { status: 403 }
      ),
    };
  }
  return { user, response: null };
}

export async function authorizeAdmin() {
  const result = await authorizeUser();
  if (!result.user) return result;
  if (result.user.role !== "ADMIN") {
    return {
      user: null,
      response: NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 }),
    };
  }
  return result;
}
