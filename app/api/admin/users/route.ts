import { NextResponse } from "next/server";

import { authorizeAdmin } from "@/lib/api-authorization";
import { db } from "@/lib/db";

export async function GET() {
  const authorization = await authorizeAdmin();
  if (!authorization.user) return authorization.response;

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessEnabled: true,
      createdAt: true,
    },
    orderBy: [{ accessEnabled: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ success: true, users });
}
