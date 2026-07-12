import { BriefcaseBusiness, Building2, LayoutDashboard, LogOut, Search, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/jobs", label: "Vagas", icon: Search },
  { href: "/companies", label: "Empresas", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default async function Navbar() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 shadow-none backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground hover:no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="text-lg">JobHub</span>
        </Link>

        {session?.user && (
          <nav aria-label="Navegação principal" className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}><Icon className="h-4 w-4" />{item.label}</Link>
                </Button>
              );
            })}
            {role === "ADMIN" && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin"><Settings className="h-4 w-4" />Admin</Link>
              </Button>
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {session?.user ? (
            <>
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
                {session.user.name || session.user.email}
              </span>
              <form action={async () => { "use server"; const { signOut } = await import("@/lib/auth"); await signOut(); }}>
                <Button type="submit" variant="secondary" size="sm"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Entrar</Link></Button>
              <Button asChild size="sm"><Link href="/register">Criar conta</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
