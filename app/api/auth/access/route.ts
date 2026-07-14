import { NextResponse } from "next/server";

import { authorizeUser } from "@/lib/api-authorization";

export async function GET() {
  const authorization = await authorizeUser();
  if (!authorization.user) return authorization.response;
  return NextResponse.json({ accessEnabled: true });
}
