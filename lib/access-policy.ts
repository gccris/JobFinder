const PUBLIC_PAGES = new Set(["/", "/login", "/register"]);

export function isPublicPath(pathname: string) {
  return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/api/auth/");
}

export function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function requiresAdmin(pathname: string, method = "GET") {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) return true;
  if (pathname === "/api/jobs/sync" || pathname.startsWith("/api/jobs/sync/")) return true;
  if (pathname === "/api/lever/companies" || pathname.startsWith("/api/lever/companies/")) return true;
  if (method === "DELETE" && pathname === "/api/jobs") return true;
  if (method === "DELETE" && /^\/api\/jobs\/[^/]+$/.test(pathname)) return true;
  return false;
}
