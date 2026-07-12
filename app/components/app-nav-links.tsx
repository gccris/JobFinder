"use client";

import { Building2, Home, LayoutDashboard, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Visão geral", icon: Home },
  { href: "/jobs", label: "Vagas", icon: Search },
  { href: "/companies", label: "Empresas", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppNavLinks({ isAdmin = false, onNavigate }: { isAdmin?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visibleItems = isAdmin ? [...items, { href: "/admin", label: "Administração", icon: Settings }] : items;

  return (
    <nav aria-label="Navegação principal" className="grid gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground hover:no-underline",
              active && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
