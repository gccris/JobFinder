import type { Metadata } from "next";

import "./globals.css";
import { AuthenticatedShell } from "./components/authenticated-shell";
import Navbar from "./components/navbar";
import AuthSessionProvider from "./components/session-provider";
import { ThemeProvider } from "./components/theme-provider";
import { auth } from "@/lib/auth";
import { getCurrentUser, hasToolAccess } from "@/lib/current-user";
import { AccessPending } from "./components/access-pending";

export const metadata: Metadata = {
  title: "JobHub - Agregador de Vagas",
  description: "Encontre, salve e acompanhe oportunidades de diferentes plataformas em um só lugar.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const currentUser = session?.user ? await getCurrentUser() : null;
  const user = currentUser
    ? { name: currentUser.name, email: currentUser.email, image: currentUser.image, role: currentUser.role }
    : undefined;
  const accessPending = currentUser ? !hasToolAccess(currentUser) : false;

  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full min-w-0 flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthSessionProvider>
            {accessPending ? (
              <AccessPending />
            ) : user ? (
              <AuthenticatedShell user={user}>{children}</AuthenticatedShell>
            ) : (
              <>
                <Navbar />
                <main className="min-w-0 flex-1">{children}</main>
                <footer className="mt-auto border-t border-border bg-card px-6 py-7 text-center text-sm text-muted-foreground">
                  <p className="m-0">© 2026 JobHub. Oportunidades reunidas em um só lugar.</p>
                </footer>
              </>
            )}
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
