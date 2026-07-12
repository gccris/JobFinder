import { BriefcaseBusiness, LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "./ui/button";
import { AppNavLinks } from "./app-nav-links";
import { MobileSidebar } from "./mobile-sidebar";
import { ThemeToggle } from "./theme-toggle";

export function AuthenticatedShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 font-bold tracking-tight text-foreground hover:no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><BriefcaseBusiness className="h-5 w-5" /></span>
          <span className="text-lg">JobHub</span>
        </Link>
        <AppNavLinks isAdmin={isAdmin} />
        <div className="mt-auto rounded-xl border border-border bg-muted/60 p-3">
          <p className="truncate text-sm font-semibold text-foreground">{user.name || "Sua conta"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-card/90 px-4 backdrop-blur-xl sm:px-6">
          <MobileSidebar isAdmin={isAdmin} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">{user.name || user.email}</span>
            <form action={async () => { "use server"; const { signOut } = await import("@/lib/auth"); await signOut(); }}>
              <Button type="submit" variant="secondary" size="sm"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></Button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
