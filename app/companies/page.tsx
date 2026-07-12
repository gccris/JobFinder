"use client";

import { useEffect, useMemo, useState } from "react";
import BackButton from "@/app/components/back-button";

interface Company {
  id: string;
  name: string;
  slug: string;
  url: string;
  source: string;
}

const pageSize = 25;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError("");
      setActionMessage("");

      const res = await fetch("/api/companies");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao carregar empresas");
      }

      setCompanies(data.companies || []);
      setPage(1);
      setSourceFilter("");
    } catch (error) {
      console.error("Error fetching companies:", error);
      setError(error instanceof Error ? error.message : "Erro desconhecido ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  const handleExtractAgain = async () => {
    await fetchCompanies();
    setActionMessage("✅ Empresas extraídas novamente de todos os arquivos JSON");
  };

  const handleDeleteAll = () => {
    if (!confirm("Tem certeza que deseja remover todas as empresas da lista atual?")) {
      return;
    }

    setCompanies([]);
    setActionMessage("✅ Todas as empresas foram removidas da lista atual");
  };

  const filteredCompanies = useMemo(
    () => (sourceFilter ? companies.filter((company) => company.source === sourceFilter) : companies),
    [companies, sourceFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const visibleCompanies = useMemo(
    () => filteredCompanies.slice((page - 1) * pageSize, page * pageSize),
    [filteredCompanies, page]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <BackButton label="← Voltar" />
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "2rem" }}>
          🏢 Empresas
        </h1>

        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button onClick={handleExtractAgain} className="btn-primary" disabled={loading}>
            {loading ? "⏳ Extraindo..." : "🔄 Extrair Todas Novamente"}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={loading || companies.length === 0}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "var(--danger)",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: loading || companies.length === 0 ? "not-allowed" : "pointer",
              opacity: loading || companies.length === 0 ? 0.5 : 1,
            }}
          >
            🗑️ Deletar Todas
          </button>
        </div>

        {actionMessage && (
          <div className="alert alert-success" style={{ marginBottom: "1.5rem", padding: "0.75rem", borderRadius: "0.5rem" }}>
            {actionMessage}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="loading" style={{ margin: "0 auto", marginBottom: "1rem" }} />
            <p style={{ color: "var(--text-secondary)" }}>Carregando empresas...</p>
          </div>
        ) : error ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>❌ {error}</p>
            <button onClick={fetchCompanies} className="btn-primary">
              Tentar novamente
            </button>
          </div>
        ) : companies.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>❌ Nenhuma empresa encontrada</p>
            <button onClick={fetchCompanies} className="btn-primary">
              Recarregar
            </button>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Filtrar por site</label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                style={{ maxWidth: "320px" }}
              >
                <option value="">Todos os sites</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
                <option value="ashby">Ashby</option>
                <option value="teamtailor">Teamtailor</option>
                <option value="workable">Workable</option>
                <option value="jazzhr">JazzHR</option>
                <option value="smartrecruiters">SmartRecruiters</option>
              </select>
            </div>

            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", backgroundColor: "var(--background-secondary)" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Nome da Empresa</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Nome da Busca</th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Plataforma</th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "var(--text)" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCompanies.map((company, index) => (
                    <tr
                      key={company.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: index % 2 === 0 ? "transparent" : "rgba(0, 0, 0, 0.02)",
                      }}
                    >
                      <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        <strong>{company.slug}</strong>
                      </td>
                      <td style={{ padding: "1rem", color: "var(--text)" }}>{company.name}</td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{formatSource(company.source)}</td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <a
                          href={company.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            textDecoration: "none",
                            display: "inline-block",
                            color: "var(--text)",
                          }}
                        >
                          🔍 Ver Vagas
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Mostrando {visibleCompanies.length} de {filteredCompanies.length} empresas
              </p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary">
                  ← Anterior
                </button>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  Página {page} de {totalPages}
                </span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="btn-secondary">
                  Próxima →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatSource(source: string) {
  const labels: Record<string, string> = {
    lever: "Lever",
    greenhouse: "Greenhouse",
    ashby: "Ashby",
    teamtailor: "Teamtailor",
    workable: "Workable",
    jazzhr: "JazzHR",
    smartrecruiters: "SmartRecruiters",
  };

  return labels[source] || source;
}
