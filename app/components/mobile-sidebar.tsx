"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BriefcaseBusiness, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "./ui/button";
import { AppNavLinks } from "./app-nav-links";
import { UserAvatar } from "./user-avatar";

export function MobileSidebar({ user }: { user: { name?: string | null; email?: string | null; image?: string | null; role?: string } }) {
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "ADMIN";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-[101] flex w-[min(86vw,290px)] flex-col border-r border-border bg-card p-5 shadow-2xl">
          <Dialog.Title className="sr-only">Navegação</Dialog.Title>
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 font-bold text-foreground hover:no-underline">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BriefcaseBusiness className="h-5 w-5" /></span>
              JobHub
            </Link>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar navegação"><X className="h-5 w-5" /></Button></Dialog.Close>
          </div>
          <AppNavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
          <Link href="/profile" onClick={() => setOpen(false)} className="mt-auto flex items-center gap-3 rounded-xl border border-border bg-muted/60 p-3 text-foreground hover:bg-muted hover:no-underline">
            <UserAvatar image={user.image} name={user.name} />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name || "Sua conta"}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span></span>
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
