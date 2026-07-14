import { NextRequest, NextResponse } from "next/server";

import { authorizeUser } from "@/lib/api-authorization";
import { db } from "@/lib/db";
import { normalizeProfileName, validateProfileName } from "@/lib/profile";

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;

  const name = normalizeProfileName(await request.json().catch(() => null));
  const validationError = validateProfileName(name);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const user = await db.user.update({
    where: { id: authorization.user.id },
    data: { name },
    select: { id: true, email: true, name: true, image: true },
  });

  return NextResponse.json({ success: true, user });
}
