"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BriefcaseBusiness, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "./ui/button";
import { AppNavLinks } from "./app-nav-links";

export function MobileSidebar({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-[101] w-[min(86vw,290px)] border-r border-border bg-card p-5 shadow-2xl">
          <Dialog.Title className="sr-only">Navegação</Dialog.Title>
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 font-bold text-foreground hover:no-underline">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BriefcaseBusiness className="h-5 w-5" /></span>
              JobHub
            </Link>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar navegação"><X className="h-5 w-5" /></Button></Dialog.Close>
          </div>
          <AppNavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
