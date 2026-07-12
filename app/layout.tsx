import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/navbar";
import AuthSessionProvider from "./components/session-provider";

export const metadata: Metadata = {
  title: "JobHub - Agregador de Vagas",
  description: "Agregador de vagas de emprego em tecnologia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AuthSessionProvider>
          <Navbar />
          <main style={{ flex: 1 }}>
            {children}
          </main>
        </AuthSessionProvider>
        <footer style={{
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "2rem 1.5rem",
          marginTop: "auto",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "0.875rem"
        }}>
          <p>© 2026 JobHub - Agregador de Vagas de Emprego. Todos os direitos reservados.</p>
        </footer>
      </body>
    </html>
  );
}
