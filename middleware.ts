import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { isApiPath, isAuthPage, isPublicPath, requiresAdmin } from "./lib/access-policy";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export const middleware = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const apiRequest = isApiPath(pathname);

  if (isPublicPath(pathname)) {
    if (request.auth && isAuthPage(pathname)) {
      return NextResponse.redirect(new URL("/", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (!request.auth) {
    if (apiRequest) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (requiresAdmin(pathname, request.method)) {
    const role = (request.auth.user as { role?: string } | undefined)?.role;
    if (role !== "ADMIN") {
      if (apiRequest) {
        return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
