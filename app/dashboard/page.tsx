"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DragStartEvent,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import HtmlContent from "@/app/components/html-content";

type ApplicationStatus = "APPLIED" | "INTERVIEWING" | "REJECTED" | "APPROVED";
type ColumnId = "SAVED" | ApplicationStatus;
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  status: "OPEN" | "CLOSED";
  saved: boolean;
};
type JobDetails = Job & {
  description: string;
  requirements?: string | null;
  category: string;
  workplaceType: string;
  employmentType?: string | null;
  seniority?: string | null;
  department?: string | null;
  postedAt: string;
  createdAt: string;
  applicationUrl?: string | null;
  jobUrl?: string | null;
  url: string;
  tags: string[];
  source: string;
  applicationStatus?: ApplicationStatus | null;
};
type Card = { job: Job; status: ColumnId; applicationId?: string };
type DashboardData = {
  saved: Array<{ job: Job }>;
  applications: Array<{ id: string; status: ApplicationStatus; job: Job }>;
  transitions: Array<Record<string, string | number>>;
  keywords: Array<{ name: string; value: number }>;
};

const columns: Array<{ id: ColumnId; label: string }> = [
  { id: "SAVED", label: "Salvos" },
  { id: "APPLIED", label: "Aplicado" },
  { id: "INTERVIEWING", label: "Em entrevistas" },
  { id: "REJECTED", label: "Rejeitado" },
  { id: "APPROVED", label: "Aprovado" },
];

const colors = ["#dc2626", "#2563eb", "#d97706", "#16a34a", "#7c3aed", "#0891b2", "#db2777", "#64748b", "#94a3b8"];
const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Aplicado",
  INTERVIEWING: "Em entrevistas",
  REJECTED: "Rejeitado",
  APPROVED: "Aprovado",
};

const tagStyles = {
  saved: { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#b45309" },
  applied: { backgroundColor: "rgba(22, 163, 74, 0.14)", color: "#15803d" },
  closed: { backgroundColor: "#fee2e2", color: "#991b1b" },
};

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [recentDraggedId, setRecentDraggedId] = useState<string | null>(null);
  const [lastDragEndedAt, setLastDragEndedAt] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    const response = await fetch(`/api/dashboard?period=${period}`);
    if (!response.ok) throw new Error("Nao foi possivel carregar o dashboard");
    setData(await response.json());
  }, [period]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const cards = useMemo<Card[]>(
    () =>
      data
        ? [
            ...data.saved.map((item) => ({ job: item.job, status: "SAVED" as const })),
            ...data.applications.map((item) => ({ job: item.job, status: item.status, applicationId: item.id })),
          ]
        : [],
    [data]
  );

  const openDetails = useCallback(async (card: Card) => {
    setSelectedCard(card);
    setDetailsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${card.job.id}`);
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.error || "Nao foi possivel carregar a vaga");
      setSelectedJob(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  async function refreshAll(focusCard?: Card) {
    await load();
    if (focusCard) await openDetails(focusCard);
  }

  async function move(card: Card, target: ColumnId) {
    if (target === "SAVED" || card.status === target) return;
    setBusy(card.job.id);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${card.job.id}/application`, {
        method: card.status === "SAVED" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(card.status === "SAVED" ? {} : { body: JSON.stringify({ status: target }) }),
      });
      if (!response.ok) throw new Error("Nao foi possivel atualizar a candidatura");
      await refreshAll({ ...card, status: target });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function removeApplication(card: Card) {
    if (!confirm("Excluir definitivamente esta candidatura e todo o historico?")) return;
    setBusy(card.job.id);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${card.job.id}/application`, { method: "DELETE" });
      if (!response.ok) throw new Error("Nao foi possivel excluir a candidatura");
      await load();
      const responseDetail = await fetch(`/api/jobs/${card.job.id}`);
      const detail = await responseDetail.json();
      if (responseDetail.ok) {
        if (detail.applicationStatus) {
          setSelectedJob(detail);
          setSelectedCard({ job: detail, status: detail.applicationStatus });
        } else {
          setSelectedCard(null);
          setSelectedJob(null);
        }
      } else {
        setSelectedCard(null);
        setSelectedJob(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSaved(card: Card) {
    setBusy(card.job.id);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${card.job.id}/save`, {
        method: card.job.saved ? "DELETE" : "POST",
      });
      if (!response.ok && response.status !== 400) {
        throw new Error("Nao foi possivel atualizar o salvo");
      }
      const responseDetail = await fetch(`/api/jobs/${card.job.id}`);
      const detail = await responseDetail.json();
      await load();
      if (responseDetail.ok) {
        setSelectedJob(detail);
        setSelectedCard({
          job: detail,
          status: detail.applicationStatus ?? "SAVED",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setBusy(null);
    }
  }

  function onDragStart(event: DragStartEvent) {
    setRecentDraggedId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const card = cards.find((item) => item.job.id === event.active.id);
    if (card && event.over) move(card, event.over.id as ColumnId);
    setLastDragEndedAt(Date.now());
    setTimeout(() => setRecentDraggedId(null), 250);
  }

  if (!data) {
    return <div className="container" style={{ padding: "3rem 1.5rem" }}>{error || "Carregando dashboard..."}</div>;
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 1500, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Minhas vagas</h1>
            <p style={{ color: "var(--text-secondary)" }}>Acompanhe suas candidaturas em um so lugar.</p>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", gap: 12, overflowX: "auto", alignItems: "start", paddingBottom: 12 }}>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards.filter((card) => card.status === column.id)}
                busy={busy}
                onOpen={openDetails}
                recentDraggedId={recentDraggedId}
                lastDragEndedAt={lastDragEndedAt}
              />
            ))}
          </div>
        </DndContext>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "2rem 0 1rem", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Atividade</h2>
          <span className="badge" style={{ backgroundColor: "rgba(37, 99, 235, 0.12)", color: "#1d4ed8" }}>
            Ultimos 30 dias
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)", gap: 16 }}>
          <section className="card" style={{ minHeight: 360 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Mudanças de status por dia</h3>
            {data.transitions.length ? (
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={data.transitions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="APPLIED" name="Aplicado" stroke="#2563eb" />
                  <Line dataKey="INTERVIEWING" name="Entrevistas" stroke="#d97706" />
                  <Line dataKey="REJECTED" name="Rejeitado" stroke="#dc2626" />
                  <Line dataKey="APPROVED" name="Aprovado" stroke="#16a34a" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="Nenhuma transicao no periodo." />
            )}
          </section>
          <section className="card" style={{ minHeight: 360 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Keywords das candidaturas</h3>
            {data.keywords.length ? (
              <ResponsiveContainer width="100%" height={290}>
                <PieChart>
                  <Pie data={data.keywords} dataKey="value" nameKey="name" outerRadius={95} label>
                    {data.keywords.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="Nenhuma keyword disponivel." />
            )}
          </section>
        </div>
      </div>

      {(selectedCard || detailsLoading) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1.5rem",
          }}
          onClick={() => {
            setSelectedCard(null);
            setSelectedJob(null);
            setDetailsLoading(false);
          }}
        >
          <aside
            style={{
              width: "min(760px, 100%)",
              maxHeight: "min(88vh, 920px)",
              backgroundColor: "var(--background)",
              boxShadow: "var(--shadow-lg)",
              padding: "1.5rem",
              overflowY: "auto",
              borderRadius: "1rem",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Detalhes da vaga</p>
                <h2 style={{ fontSize: "1.5rem", marginBottom: 0 }}>{selectedJob?.title || selectedCard?.job.title || "Carregando..."}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCard(null);
                  setSelectedJob(null);
                  setDetailsLoading(false);
                }}
                className="btn-secondary"
                style={{ padding: "0.5rem 0.75rem" }}
              >
                Fechar
              </button>
            </div>

            {detailsLoading && (
              <div style={{ padding: "3rem 0", textAlign: "center" }}>
                <div className="loading" style={{ marginBottom: "1rem" }} />
                <p>Carregando detalhes...</p>
              </div>
            )}

            {selectedJob && !detailsLoading && (
              <div style={{ display: "grid", gap: "1.25rem" }}>
                <section className="card" style={{ padding: "1rem" }}>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "0.25rem" }}>{selectedJob.company}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    <span className="badge badge-primary">{selectedJob.category}</span>
                    <span className="badge badge-success">{selectedJob.workplaceType}</span>
                    {selectedJob.status === "CLOSED" && <span className="badge" style={tagStyles.closed}>Fechada</span>}
                  </div>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>{selectedJob.location}</p>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>Publicada em {formatDate(selectedJob.postedAt)}</p>
                </section>

                <section>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Descricao</h3>
                  <HtmlContent
                    content={selectedJob.description || "Sem descricao gravada."}
                    style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}
                  />
                </section>

                {selectedJob.requirements && (
                  <section>
                    <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Requisitos</h3>
                    <HtmlContent content={selectedJob.requirements} style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }} />
                  </section>
                )}

                {selectedJob.tags.length > 0 && (
                  <section>
                    <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Tags</h3>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {selectedJob.tags.map((tag) => (
                        <span key={tag} className="tag" style={{ whiteSpace: "nowrap" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {selectedCard && (
                  <section style={{ display: "grid", gap: "0.75rem" }}>
                    <button className="btn-secondary" disabled={busy === selectedCard.job.id} onClick={() => toggleSaved(selectedCard)}>
                      {selectedJob?.saved ? "★ Remover dos salvos" : "☆ Salvar"}
                    </button>
                    {selectedCard.status !== "SAVED" && (
                    <button className="btn-danger" disabled={busy === selectedCard.job.id} onClick={() => removeApplication(selectedCard)}>
                      Excluir candidatura
                    </button>
                    )}
                  </section>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  cards,
  busy,
  onOpen,
  recentDraggedId,
  lastDragEndedAt,
}: {
  column: { id: ColumnId; label: string };
  cards: Card[];
  busy: string | null;
  onOpen: (card: Card) => void;
  recentDraggedId: string | null;
  lastDragEndedAt: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      style={{ background: isOver ? "rgba(37,99,235,.08)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, minHeight: 180 }}
    >
      <h2 style={{ fontWeight: 700, marginBottom: 12 }}>
        {column.label} <span style={{ color: "var(--text-secondary)" }}>({cards.length})</span>
      </h2>
      <div style={{ display: "grid", gap: 10 }}>
        {cards.map((card) => (
          <KanbanCard key={card.job.id} card={card} disabled={busy === card.job.id} onOpen={onOpen} recentDraggedId={recentDraggedId} lastDragEndedAt={lastDragEndedAt} />
        ))}
        {!cards.length && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Arraste uma vaga para ca.</p>}
      </div>
    </section>
  );
}

function KanbanCard({
  card,
  disabled,
  onOpen,
  recentDraggedId,
  lastDragEndedAt,
}: {
  card: Card;
  disabled: boolean;
  onOpen: (card: Card) => void;
  recentDraggedId: string | null;
  lastDragEndedAt: number;
}) {
  const drag = useDraggable({ id: card.job.id, disabled });

  return (
    <article
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...drag.attributes}
      onClick={() => {
        const justDropped = Date.now() - lastDragEndedAt < 400;
        if (!justDropped && recentDraggedId !== card.job.id && !drag.isDragging) onOpen(card);
      }}
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        opacity: disabled ? 0.55 : 1,
        transform: drag.transform ? `translate3d(${drag.transform.x}px,${drag.transform.y}px,0)` : undefined,
        zIndex: drag.isDragging ? 10 : undefined,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <strong style={{ fontWeight: 700 }}>{card.job.title}</strong>
        {card.status !== "SAVED" && card.job.saved && (
          <span className="badge" style={tagStyles.saved}>
            ⭐
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
        {card.job.company} · {card.job.location}
      </p>
      {card.job.status === "CLOSED" && <span className="badge" style={tagStyles.closed}>Fechada</span>}
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ height: 280, display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>{text}</div>;
}
