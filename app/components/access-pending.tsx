import { Clock3, LogOut } from "lucide-react";

import { Button } from "./ui/button";

export function AccessPending() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
          <Clock3 className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-foreground">Acesso aguardando liberação</h1>
        <p className="mt-3 text-muted-foreground">
          Seu acesso ainda não foi liberado pelo administrador. Tente novamente mais tarde.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="secondary">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </form>
      </section>
    </main>
  );
}
