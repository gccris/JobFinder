"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackButton from "@/app/components/back-button";

type SyncSource = "lever" | "greenhouse" | "ashby" | "teamtailor" | "workable" | "jazzhr" | "smartrecruiters";
type SyncStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED" | "INTERRUPTED";

interface SyncProgressState {
  runId: string;
  status: SyncStatus;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  totalCompanies: number;
  processedCompanies: number;
  totalJobs: number;
  createdJobs: number;
  jobsUpdated: number;
  jobsClosed: number;
  failures: number;
  bySource: Record<
    string,
    {
      totalCompanies: number;
      processedCompanies: number;
      totalJobs: number;
      createdJobs: number;
      jobsUpdated: number;
      jobsClosed: number;
      failures: number;
      status: SyncStatus;
      currentCompany: string | null;
      error: string | null;
    }
  >;
}

interface SourceStatRow {
  source: string;
  openJobs: number;
  totalJobs: number;
  successfulJobs: number;
  failures: number;
  lastSyncedAt: string | null;
}

const SOURCE_OPTIONS: Array<{ value: SyncSource; label: string }> = [
  { value: "lever", label: "Lever" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "ashby", label: "Ashby" },
  { value: "teamtailor", label: "Teamtailor" },
  { value: "workable", label: "Workable" },
  { value: "jazzhr", label: "JazzHR" },
  { value: "smartrecruiters", label: "SmartRecruiters" },
];

export default function AdminPage() {
  const [selectedSources, setSelectedSources] = useState<SyncSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingJobs, setDeletingJobs] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [progress, setProgress] = useState<SyncProgressState | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStatRow[]>([]);
  const intervalRef = useRef<number | null>(null);

  const loadSourceStats = useCallback(async () => {
    const response = await fetch("/api/admin/source-stats");
    const data = await safeJsonResponse(response);
    if (response.ok && data?.success) setSourceStats(data.rows);
  }, []);

  useEffect(() => {
    loadSourceStats();
  }, [loadSourceStats]);

  useEffect(() => {
    const resumeActiveRun = async () => {
      const response = await fetch("/api/jobs/sync/all/progress");
      const data = await safeJsonResponse(response);
      if (!response.ok || !data?.success || !data.progress?.running) return;
      setProgress(data.progress);
      setActiveRunId(data.progress.runId);
      setSelectedSources(Object.keys(data.progress.bySource) as SyncSource[]);
      setLoading(true);
    };
    resumeActiveRun();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading || !activeRunId) return;

    const loadProgress = async () => {
      const response = await fetch(`/api/jobs/sync/all/progress?runId=${encodeURIComponent(activeRunId)}`);
      const data = await safeJsonResponse(response);
      if (!data?.success) return;
      const next = data.progress as SyncProgressState;
      setProgress(next);
      setSelectedSources(Object.keys(next.bySource) as SyncSource[]);
      if (!next.running) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setLoading(false);
        setActiveRunId(null);
        setMessage(
          `Sincronização finalizada. Criadas: ${next.createdJobs} | Atualizadas: ${next.jobsUpdated} | Fechadas: ${next.jobsClosed} | Falhas: ${next.failures}`
        );
        setMessageType(next.status === "COMPLETED" ? "success" : "error");
        await loadSourceStats();
      }
    };

    loadProgress();
    intervalRef.current = window.setInterval(loadProgress, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeRunId, loadSourceStats, loading]);

  const selectedSet = useMemo(() => new Set(selectedSources), [selectedSources]);

  const toggleSource = (source: SyncSource) => {
    setSelectedSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source]
    );
  };

  const handleSync = async () => {
    if (selectedSources.length === 0) {
      setMessage("❌ Selecione ao menos uma fonte para sincronizar");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");
    setProgress(null);

    try {
      const response = await fetch("/api/jobs/sync/all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sources: selectedSources }),
      });
      const data = await safeJsonResponse(response);

      if (!response.ok || !data?.success) {
        if (response.status === 409 && data?.runId) {
          setActiveRunId(data.runId);
          setMessage("Já existe uma sincronização em andamento; acompanhando a execução atual.");
          setMessageType("error");
          return;
        }
        throw new Error(data?.error || `Falha ao sincronizar (${response.status})`);
      }

      setActiveRunId(data.runId);
      setMessage("Sincronização enfileirada; as fontes selecionadas iniciarão em paralelo.");
      setMessageType("success");
    } catch (error) {
      setMessage(`❌ Erro ao sincronizar: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      setMessageType("error");
      setLoading(false);
    }
  };

  const handleDeleteAllJobs = async () => {
    if (!confirm("Tem certeza que deseja apagar todas as vagas e favoritos relacionados?")) {
      return;
    }

    setDeletingJobs(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/jobs", {
        method: "DELETE",
      });
      const data = await safeJsonResponse(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Falha ao apagar vagas (${response.status})`);
      }

      setMessage(`✅ Vagas removidas. Total apagado: ${data.deleted.jobs}`);
      setMessageType("success");
      await loadSourceStats();
    } catch (error) {
      setMessage(`❌ Erro ao apagar vagas: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      setMessageType("error");
    } finally {
      setDeletingJobs(false);
    }
  };

  const sourceRows = useMemo(
    () => SOURCE_OPTIONS.map((option) => [option.value, progress?.bySource?.[option.value]] as const),
    [progress]
  );

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <BackButton label="← Voltar" />

        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Sincronia</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          Escolha as fontes que deseja sincronizar e acompanhe o andamento em tempo real.
        </p>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Fontes</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
            {SOURCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  border: selectedSet.has(option.value) ? "1px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  padding: "0.9rem 1rem",
                  backgroundColor: selectedSet.has(option.value) ? "rgba(37, 99, 235, 0.08)" : "var(--surface)",
                  boxShadow: selectedSet.has(option.value) ? "0 0 0 1px rgba(37, 99, 235, 0.08)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => toggleSource(option.value)}
                  style={{ marginTop: "0.2rem", width: "1rem", height: "1rem", accentColor: "var(--primary)" }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{option.label}</div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                    {selectedSet.has(option.value) ? "Incluída na sincronia" : "Clique para incluir"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={handleSync} disabled={loading || selectedSources.length === 0}>
              {loading ? "Sincronizando..." : "Sincronizar fontes selecionadas"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setSelectedSources(SOURCE_OPTIONS.map((option) => option.value))}
              disabled={loading}
              >
              Selecionar todas
            </button>
            <button className="btn-danger" onClick={handleDeleteAllJobs} disabled={loading || deletingJobs}>
              {deletingJobs ? "Apagando..." : "Deletar todas as vagas"}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <strong>Progresso</strong>
            <span style={{ color: "var(--text-secondary)" }}>
              {progress?.status === "QUEUED" ? "Na fila" : progress?.running ? "Em andamento" : "Aguardando"}
            </span>
          </div>
          <p style={{ marginBottom: "0.75rem" }}>
            {progress?.createdJobs || 0}/{progress?.totalJobs || 0} jobs feitos
          </p>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            {progress?.running ? "As fontes são processadas em paralelo" : "Nenhuma execução em andamento"}
          </p>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            {sourceRows.map(([source, sourceProgress]) => {
              if (!selectedSet.has(source as SyncSource)) return null;
              return (
                <div
                  key={source}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "0.75rem",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <strong>{source}</strong>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {sourceProgress?.status || "QUEUED"} • {sourceProgress?.currentCompany || "aguardando"} •{" "}
                    {sourceProgress?.processedCompanies || 0}/{sourceProgress?.totalCompanies || 0} empresas •{" "}
                    {sourceProgress?.createdJobs || 0}/{sourceProgress?.totalJobs || 0} jobs • falhas: {sourceProgress?.failures || 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem", overflowX: "auto" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
            Jobs por fonte
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={tableCellStyle}>Fonte</th>
                <th style={tableCellStyle}>Jobs abertos</th>
                <th style={tableCellStyle}>Total de jobs</th>
                <th style={tableCellStyle}>Sucessos na última sync</th>
                <th style={tableCellStyle}>Falhas</th>
                <th style={tableCellStyle}>Última sync</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_OPTIONS.map((option) => {
                const row = sourceStats.find((item) => item.source === option.value);
                return (
                  <tr key={option.value} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tableCellStyle}><strong>{option.label}</strong></td>
                    <td style={tableCellStyle}>{row?.openJobs ?? 0}</td>
                    <td style={tableCellStyle}>{row?.totalJobs ?? 0}</td>
                    <td style={tableCellStyle}>{row?.successfulJobs ?? 0}</td>
                    <td style={tableCellStyle}>{row?.failures ?? 0}</td>
                    <td style={{ ...tableCellStyle, color: "var(--text-secondary)" }}>
                      {row?.lastSyncedAt
                        ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                            new Date(row.lastSyncedAt)
                          )
                        : "Nunca"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {message && (
          <div className={`alert alert-${messageType}`} style={{ padding: "1rem", borderRadius: "0.5rem" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

const tableCellStyle = {
  padding: "0.75rem",
  whiteSpace: "nowrap" as const,
};

async function safeJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      success: false,
      error: `Resposta inválida do servidor (${response.status}): ${text.slice(0, 180)}`,
    };
  }
}
