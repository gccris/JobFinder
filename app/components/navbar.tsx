import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Navbar() {
  const session = await auth();

  return (
    <nav style={{
      backgroundColor: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding: "0",
      boxShadow: "var(--shadow)"
    }}>
      <style>{`
        .nav-link {
          color: var(--text-primary);
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--primary);
        }
        .nav-admin {
          color: var(--text-primary);
        }
        .nav-admin:hover {
          color: var(--danger);
        }
      `}</style>
      <div className="container">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 0",
          gap: "2rem"
        }}>
          {/* Logo */}
          <Link href="/" style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            💼 JobHub
          </Link>

          {/* Menu */}
          <div style={{
            display: "flex",
            gap: "2rem",
            alignItems: "center",
            listStyle: "none"
          }}>
            {session?.user ? (
              <>
                <Link href="/jobs" className="nav-link">
                  🔍 Vagas
                </Link>

                <Link href="/dashboard" className="nav-link">
                  ⭐ Salvas
                </Link>

                {(session.user as any)?.role === "ADMIN" && (
                  <Link href="/admin" className="nav-admin" style={{
                    fontWeight: "500",
                    transition: "color 0.2s"
                  }}>
                    ⚙️ Admin
                  </Link>
                )}

                <span style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem"
                }}>
                  👤 {session.user.name || session.user.email}
                </span>

                <form action={async () => {
                  "use server";
                  const { signOut } = await import("@/lib/auth");
                  await signOut();
                }} style={{ margin: 0 }}>
                  <button type="submit" className="btn-secondary" style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem"
                  }}>
                    🚪 Sair
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary" style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem"
                }}>
                  🔐 Login
                </Link>
                <Link href="/register" className="btn-primary" style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem"
                }}>
                  📝 Cadastro
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

