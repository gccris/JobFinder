import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div style={{ backgroundColor: "var(--background)" }}>
      {/* Hero Section */}
      <div className="hero" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "4rem 1.5rem"
      }}>
        <h1 style={{ color: "white", marginBottom: "1rem" }}>
          🚀 Encontre sua próxima oportunidade em Tech
        </h1>
        <p style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: "1.1rem", marginBottom: "2rem" }}>
          Agregamos os melhores anúncios de emprego em tecnologia de múltiplas plataformas
        </p>

        {session?.user ? (
          <Link href="/jobs" className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
            ✨ Explorar Vagas
          </Link>
        ) : (
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
              🎯 Começar Agora
            </Link>
            <Link href="/register" className="btn-secondary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
              📝 Cadastro
            </Link>
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{
        backgroundColor: "var(--surface)",
        padding: "4rem 1.5rem"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", marginBottom: "3rem" }}>
            Por que usar JobHub?
          </h2>
          <div className="grid-3" style={{ display: "grid", gap: "2rem" }}>
            <div className="card" style={{
              textAlign: "center"
            }}>
              <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>📦 Agregação</h3>
              <p>Vagas de LinkedIn, Indeed e muito mais em um único lugar.</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>🔍 Filtros</h3>
              <p>Encontre exatamente o que procura com filtros avançados.</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>⭐ Salve Vagas</h3>
              <p>Guarde suas vagas favoritas para consultar depois.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {!session?.user && (
        <div style={{
          backgroundColor: "var(--primary)",
          color: "white",
          padding: "3rem 1.5rem",
          textAlign: "center"
        }}>
          <h2 style={{ color: "white", marginBottom: "1rem" }}>Comece agora!</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", marginBottom: "2rem", fontSize: "1.1rem" }}>
            Junte-se a milhares de profissionais em busca de oportunidades
          </p>
          <Link href="/register" className="btn-secondary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
            Criar Conta Gratuitamente
          </Link>
        </div>
      )}
    </div>
  );
}
