"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string; title: string; company: string; location: string; description: string; requirements?: string | null;
  salary?: string | null; category: string; workplaceType: string; employmentType?: string | null; seniority?: string | null;
  department?: string | null; tags: string[]; applicationUrl?: string | null; url: string; postedAt: string;
  status: "OPEN" | "CLOSED"; saved: boolean; applicationStatus?: string | null; canDelete: boolean;
};

const statusLabels: Record<string, string> = { APPLIED: "Aplicado", INTERVIEWING: "Em entrevistas", REJECTED: "Rejeitado", APPROVED: "Aprovado" };

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function load() {
    const response = await fetch(`/api/jobs/${params.id}`);
    if (response.ok) setJob(await response.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, [params.id]);

  async function toggleSaved() {
    if (!job) return; setBusy(true);
    const response = await fetch(`/api/jobs/${job.id}/save`, { method: job.saved ? "DELETE" : "POST" });
    if (response.status === 401) router.push("/login"); else if (response.ok) await load();
    setBusy(false);
  }

  async function openApplication() {
    if (!job) return;
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;
    if (!job.saved) await fetch(`/api/jobs/${job.id}/save`, { method: "POST" });
    if (popup) popup.location.href = job.applicationUrl || job.url;
    else window.open(job.applicationUrl || job.url, "_blank", "noopener,noreferrer");
    await load();
  }

  async function markApplied() {
    if (!job) return; setBusy(true);
    const response = await fetch(`/api/jobs/${job.id}/application`, { method: "POST" });
    if (response.status === 401) router.push("/login"); else if (response.ok) await load();
    setBusy(false);
  }

  async function deleteJob() {
    if (!job || !confirm("Excluir esta vaga e todos os favoritos, candidaturas e históricos associados?")) return;
    const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    if (response.ok) router.push("/jobs");
  }

  if (loading) return <div className="container" style={{ padding: "3rem 1.5rem" }}>Carregando vaga...</div>;
  if (!job) return <div className="container" style={{ padding: "3rem 1.5rem" }}>Vaga não encontrada.</div>;

  return <div style={{ background: "var(--background)", minHeight: "100vh", padding: "2rem 1rem" }}><main className="container" style={{ maxWidth: 950, margin: "0 auto" }}>
    <Link href="/jobs" style={{ color: "var(--primary)" }}>← Voltar para vagas</Link>
    <article className="card" style={{ marginTop: 20, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><h1 style={{ fontSize: "2rem", fontWeight: 700 }}>{job.title}</h1>{job.status === "CLOSED" && <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>Fechada</span>}</div><p style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>{job.company} · {job.location}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn-secondary" disabled={busy} onClick={toggleSaved}>{job.saved ? "★ Remover dos salvos" : "☆ Salvar"}</button><button className="btn-primary" disabled={busy || Boolean(job.applicationStatus)} onClick={markApplied}>{job.applicationStatus ? `✓ ${statusLabels[job.applicationStatus]}` : "Marcar como aplicado"}</button></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0" }}>{[job.category, job.workplaceType, job.employmentType, job.seniority, job.department].filter(Boolean).map((value) => <span className="tag" key={value}>{value}</span>)}</div>
      <section><h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 10 }}>Descrição</h2><p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p></section>
      {job.requirements && <section style={{ marginTop: 24 }}><h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 10 }}>Requisitos</h2><p style={{ whiteSpace: "pre-wrap" }}>{job.requirements}</p></section>}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 28, paddingTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn-primary" onClick={openApplication}>Abrir candidatura ↗</button>{job.canDelete && <button className="btn-danger" onClick={deleteJob}>Excluir vaga</button>}</div>
    </article>
  </main></div>;
}
