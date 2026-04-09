import { auth } from "./lib/auth";
import { NextResponse } from "next/server";

const protectedRoutes = ["/admin", "/jobs", "/dashboard"];

export const middleware = auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Check if route needs protection
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  // If no session, redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check for admin routes
  if (pathname.startsWith("/admin")) {
    const userRole = (req.auth.user as any)?.role;
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
