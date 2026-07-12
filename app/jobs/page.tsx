"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import BackButton from "@/app/components/back-button";
import HtmlContent from "@/app/components/html-content";
import { formatCategoryLabel } from "@/lib/job-classification";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryInterval?: string | null;
  workplaceType: string;
  category: string;
  employmentType?: string | null;
  seniority?: string | null;
  department?: string | null;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  applicationUrl?: string | null;
  jobUrl?: string | null;
  saved: boolean;
  applicationStatus?: string | null;
  status: "OPEN" | "CLOSED";
}

interface JobDetails extends Job {
  description: string;
  requirements?: string | null;
  source: string;
  externalId: string;
  externalReference?: string | null;
  externalUpdatedAt?: string | null;
  tags: string[];
  signals?: {
    keywords: string[];
    tools: string[];
    languages: string[];
    frameworks: string[];
    concepts: string[];
    normalizedTextHash?: string | null;
    analyzerVersion?: string | null;
    analyzedAt?: string | null;
  } | null;
  expiresAt?: string | null;
}

const workplaceTypeLabels: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite",
  UNSPECIFIED: "Nao informado",
};

const categoryOptions = [
  "BACKEND",
  "FRONTEND",
  "MOBILE",
  "FULLSTACK",
  "DEVOPS",
  "SITE_RELIABILITY_ENGINEER",
  "PLATFORM_ENGINEER",
  "DATASCIENCE",
  "PRODUCT",
  "QA",
  "SECURITY",
  "SUPPORT",
  "INFRA",
  "IT",
  "GENERAL",
];

const sortOptions = [
  { value: "postedAt", label: "Data de postagem" },
  { value: "title", label: "Nome" },
  { value: "salaryMin", label: "Salário" },
];

const workplaceTypeOptions = [
  { value: "UNSPECIFIED", label: "Nao informado" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "Onsite" },
];

const applicationStatusLabels: Record<string, string> = {
  APPLIED: "Aplicado",
  INTERVIEWING: "Em entrevistas",
  REJECTED: "Rejeitado",
  APPROVED: "Aprovado",
};

const listTagStyles = {
  saved: { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#b45309" },
  applied: { backgroundColor: "rgba(22, 163, 74, 0.14)", color: "#15803d" },
};

function getWorkplaceTypeLabel(type: string) {
  return workplaceTypeLabels[type] || "Nao informado";
}

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatFreshLabel(value?: string | null) {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "🔥 Novidade: Hoje";
  if (days < 7) return "Novidade: Nessa Semana";
  return "";
}

function formatOptional(value?: string | null) {
  return value && value.trim() ? value : "Nao informado";
}

function formatRelativeDays(value?: string | null) {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias`;
  return "";
}

function isSameCategory(a: string, b: string) {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function getSignalsDisplayTags(signals?: JobDetails["signals"] | null) {
  if (!signals) return [];
  return Array.from(
    new Set([
      ...(signals.languages || []),
      ...(signals.frameworks || []),
      ...(signals.tools || []),
      ...(signals.concepts || []),
      ...(signals.keywords || []),
    ])
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 5h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14L19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean).map((item) => item.toUpperCase()) || []
  );
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [workplaceTypes, setWorkplaceTypes] = useState<string[]>(["UNSPECIFIED", "REMOTE", "HYBRID", "ONSITE"]);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "postedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("sortOrder") as "asc" | "desc") || "desc"
  );
  const [perPage, setPerPage] = useState(10);
  const [salaryOnly, setSalaryOnly] = useState(searchParams.get("salaryOnly") === "true");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false);
  const [jobDetailsError, setJobDetailsError] = useState("");
  const [jobActionBusy, setJobActionBusy] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
      });

      if (categories.length > 0) params.append("categories", categories.join(","));
      if (location) params.append("location", location);
      if (search) params.append("search", search);
      if (sortBy) params.append("sortBy", sortBy);
      const effectiveSortOrder = sortOrder;
      if (effectiveSortOrder) params.append("sortOrder", effectiveSortOrder);
      if (workplaceTypes.length > 0) params.append("workplaceTypes", workplaceTypes.join(","));
      if (salaryOnly) params.append("salaryOnly", "true");

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setJobs(Array.isArray(data?.data) ? data.data : []);
      setTotal(typeof data?.pagination?.total === "number" ? data.pagination.total : 0);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [categories, location, page, perPage, salaryOnly, search, sortBy, sortOrder, workplaceTypes]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleReset = () => {
    setCategories([]);
    setCategoryQuery("");
    setCategoryOpen(false);
    setLocation("");
    setSearch("");
    setWorkplaceTypes(["UNSPECIFIED", "REMOTE", "HYBRID", "ONSITE"]);
    setSortBy("postedAt");
    setSortOrder("desc");
    setPerPage(10);
    setSalaryOnly(false);
    setPage(1);
  };

  const handleWorkplaceTypeChange = (type: string) => {
    setWorkplaceTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
    setPage(1);
  };

  const handleCategoryToggle = (value: string) => {
    if (!value) return;
    const nextValue = value.toUpperCase();
    setCategories((current) =>
      current.includes(nextValue) ? current.filter((item) => item !== nextValue) : [...current, nextValue]
    );
    setPage(1);
  };

  const filteredCategoryOptions = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    return categoryOptions.filter((option) => {
      const label = formatCategoryLabel(option).toLowerCase();
      return !query || label.includes(query) || option.toLowerCase().includes(query);
    });
  }, [categoryQuery]);

  const handleOpenJob = async (jobId: string) => {
    setJobDetailsLoading(true);
    setJobDetailsError("");
    setSelectedJob(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao carregar vaga");
      }

      setSelectedJob(data);
    } catch (error) {
      setJobDetailsError(error instanceof Error ? error.message : "Erro desconhecido ao carregar vaga");
    } finally {
      setJobDetailsLoading(false);
    }
  };

  const handleCloseJob = () => {
    setSelectedJob(null);
    setJobDetailsError("");
    setJobDetailsLoading(false);
    setJobActionBusy(false);
  };

  const refreshSelectedJob = async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao atualizar vaga");
    setSelectedJob(data);
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              saved: Boolean(data.saved),
              applicationStatus: data.applicationStatus ?? null,
              status: data.status,
            }
          : job
      )
    );
  };

  const handleToggleSaved = async () => {
    if (!selectedJob) return;
    setJobActionBusy(true);
    setJobDetailsError("");

    try {
      const response = await fetch(`/api/jobs/${selectedJob.id}/save`, {
        method: selectedJob.saved ? "DELETE" : "POST",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok && response.status !== 400) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao atualizar vaga salva");
      }
      await refreshSelectedJob(selectedJob.id);
    } catch (error) {
      setJobDetailsError(error instanceof Error ? error.message : "Erro ao salvar vaga");
    } finally {
      setJobActionBusy(false);
    }
  };

  const handleOpenApplication = async () => {
    if (!selectedJob) return;
    setJobActionBusy(true);
    setJobDetailsError("");

    try {
      const popup = window.open("", "_blank");
      if (popup) popup.opener = null;

      if (!selectedJob.saved) {
        const saveResponse = await fetch(`/api/jobs/${selectedJob.id}/save`, { method: "POST" });
        if (saveResponse.status === 401) {
          popup?.close();
          router.push("/login");
          return;
        }
        if (!saveResponse.ok && saveResponse.status !== 400) {
          const data = await saveResponse.json().catch(() => ({}));
          throw new Error(data.error || "Falha ao salvar vaga");
        }
      }

      const externalUrl = selectedJob.jobUrl || selectedJob.applicationUrl || selectedJob.url;
      if (popup) popup.location.href = externalUrl;
      else window.open(externalUrl, "_blank", "noopener,noreferrer");

      await refreshSelectedJob(selectedJob.id);
    } catch (error) {
      setJobDetailsError(error instanceof Error ? error.message : "Erro ao abrir candidatura");
    } finally {
      setJobActionBusy(false);
    }
  };

  const handleMarkApplied = async () => {
    if (!selectedJob || selectedJob.applicationStatus) return;
    setJobActionBusy(true);
    setJobDetailsError("");

    try {
      const response = await fetch(`/api/jobs/${selectedJob.id}/application`, { method: "POST" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao marcar candidatura");
      }
      await refreshSelectedJob(selectedJob.id);
    } catch (error) {
      setJobDetailsError(error instanceof Error ? error.message : "Erro ao aplicar para a vaga");
    } finally {
      setJobActionBusy(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const visiblePages = useMemo(() => {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    if (pageCount <= 5) return pages;
    if (page <= 3) return pages.slice(0, 5);
    if (page >= pageCount - 2) return pages.slice(pageCount - 5);
    return pages.slice(page - 3, page + 2);
  }, [page, pageCount]);

  const sortOrderLabel = sortBy === "postedAt" ? "Mais recentes" : "Ascendente";
  const sortOrderOppositeLabel = sortBy === "postedAt" ? "Mais antigas" : "Descendente";

  return (
    <div className="workspace-page jobs-page">
      <div className="workspace-container workspace-container-wide">
        <BackButton label="Voltar" />
        <div className="workspace-heading"><div><span className="workspace-eyebrow">Oportunidades</span><h1>Vagas de emprego</h1><p>Use os filtros para encontrar vagas alinhadas ao que você procura.</p></div></div>

        <div className="jobs-layout" style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "1.5rem", alignItems: "start" }}>
          <aside
            className="card jobs-filter"
            style={{
              position: "sticky",
              top: "1.5rem",
              alignSelf: "start",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem" }}>Filtros</h2>
                <p style={{ marginBottom: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>Refine a busca sem perder velocidade.</p>
              </div>
              <button onClick={handleReset} className="btn-secondary" style={{ height: "fit-content" }}>
                Limpar
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Buscar</label>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titulo, empresa..." />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Localização</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cidade, pais..." />
              </div>

              <div ref={categoryMenuRef} style={{ position: "relative" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Categoria</label>
                <button
                  type="button"
                  onClick={() => setCategoryOpen((current) => !current)}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {categories.length > 0 ? `${categories.length} selecionada(s)` : "Selecionar categorias"}
                </button>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem", minHeight: "2rem" }}>
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="tag"
                      onClick={() => handleCategoryToggle(item)}
                      style={{ border: "none" }}
                    >
                      <span style={{ whiteSpace: "nowrap" }}>{formatCategoryLabel(item)} x</span>
                    </button>
                  ))}
                </div>
                {categoryOpen && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      background: "var(--surface)",
                      boxShadow: "var(--shadow-md)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                      <input
                        type="text"
                        value={categoryQuery}
                        onChange={(e) => setCategoryQuery(e.target.value)}
                        placeholder="Buscar categoria..."
                        aria-label="Buscar categoria"
                      />
                    </div>
                    <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                      {filteredCategoryOptions.length > 0 ? (
                        filteredCategoryOptions.map((option) => {
                          const isSelected = categories.some((item) => isSameCategory(item, option));
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleCategoryToggle(option)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                                color: "var(--text-primary)",
                                borderBottom: "1px solid var(--border)",
                                padding: "0.85rem 1rem",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  borderRadius: "0.25rem",
                                  border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                                  background: isSelected ? "var(--primary)" : "transparent",
                                  boxShadow: isSelected ? "inset 0 0 0 2px var(--surface)" : "none",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ flex: 1 }}>{formatCategoryLabel(option)}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>Nenhuma categoria encontrada</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Modelo de trabalho</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                  {workplaceTypeOptions.map((option) => {
                    const isActive = workplaceTypes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleWorkplaceTypeChange(option.value)}
                        style={{
                          width: "100%",
                          minHeight: "46px",
                          padding: "0.75rem 0.9rem",
                          borderRadius: "0.85rem",
                          border: `1px solid ${isActive ? "rgba(37, 99, 235, 0.35)" : "var(--border)"}`,
                          background: isActive ? "rgba(37, 99, 235, 0.08)" : "var(--background)",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: "1rem",
                              height: "1rem",
                              borderRadius: "9999px",
                              border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                              background: isActive ? "var(--primary)" : "transparent",
                              boxShadow: isActive ? "inset 0 0 0 3px var(--background)" : "none",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ whiteSpace: "nowrap" }}>{option.label}</span>
                        </span>
                        <span style={{ color: isActive ? "var(--primary)" : "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {isActive ? "Selecionado" : "Clique para marcar"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={salaryOnly}
                  onChange={(e) => setSalaryOnly(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Somente com salários indicados
              </label>
            </div>
          </aside>

          <main className="jobs-results">
            <div
              className="jobs-toolbar"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                flexWrap: "wrap",
                alignItems: "end",
                marginBottom: "0.5rem",
              }}
            >
              <div style={{ width: "min(180px, 100%)" }}>
                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  Ordenar por
                </label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: "min(160px, 100%)" }}>
                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  Direção
                </label>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}>
                  <option value="desc">{sortOrderLabel}</option>
                  <option value="asc">{sortOrderOppositeLabel}</option>
                </select>
              </div>

              <div style={{ width: "min(170px, 100%)" }}>
                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  Itens por página
                </label>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 20, 30, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <div className="loading" style={{ margin: "0 auto", marginBottom: "1rem" }} />
                <p style={{ color: "var(--text-secondary)" }}>Carregando vagas...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>Nenhuma vaga encontrada</p>
                <button onClick={handleReset} className="btn-primary">
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <div className="jobs-list" style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
                  {jobs.map((job) => {
                    const freshLabel = formatFreshLabel(job.postedAt);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => handleOpenJob(job.id)}
                        className="job-card"
                        style={{ display: "block", textDecoration: "none", textAlign: "left", width: "100%" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                          <div style={{ flex: 1 }}>
                            <h3 className="job-title">{job.title}</h3>
                            <p className="job-company">{job.company}</p>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                                {job.employmentType && <span className="tag" style={{ whiteSpace: "nowrap" }}>{job.employmentType}</span>}
                              {job.seniority && <span className="tag" style={{ whiteSpace: "nowrap" }}>{job.seniority}</span>}
                              {job.department && <span className="tag" style={{ whiteSpace: "nowrap" }}>{job.department}</span>}
                            </div>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 0 }}>
                              Localização: {job.location}
                            </p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", flexWrap: "wrap", marginBottom: 6 }}>
                              {job.saved && (
                                <span className="badge" style={listTagStyles.saved}>
                                  Salva
                                </span>
                              )}
                              {job.applicationStatus && (
                                <span className="badge" style={listTagStyles.applied}>
                                  Aplicada
                                </span>
                              )}
                            </div>
                            {job.salary && (
                              <p className="job-salary" style={{ marginBottom: "0.5rem" }}>
                                {job.salary}
                              </p>
                            )}
                            <span className="badge badge-primary" style={{ backgroundColor: "rgba(165, 9, 237, 0.12)", color: "#A509ED" }}>
                              {job.category}
                            </span>
                            <span className="badge" style={{ marginLeft: "0.5rem", backgroundColor: "rgba(220, 38, 38, 0.14)", color: "#b91c1c" }}>
                              {getWorkplaceTypeLabel(job.workplaceType)}
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "0.5rem",
                          }}
                        >
                          <span>Publicado {formatRelativeDays(job.postedAt) || formatDate(job.postedAt)}</span>
                          {freshLabel && (
                            <span className="badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#b45309" }}>
                              {freshLabel}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <p style={{ color: "var(--text-secondary)" }}>
                    Mostrando {jobs.length} de {total} vagas
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => setPage(1)} disabled={page === 1} className="btn-secondary">
                      Primeira
                    </button>
                    {visiblePages.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        onClick={() => setPage(pageNumber)}
                        disabled={pageNumber === page}
                        className={pageNumber === page ? "btn-primary" : "btn-secondary"}
                        style={{ minWidth: "2.5rem" }}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button onClick={() => setPage(pageCount)} disabled={page === pageCount} className="btn-secondary">
                      Última
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {(jobDetailsLoading || jobDetailsError || selectedJob) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1.5rem",
          }}
          onClick={handleCloseJob}
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
                <h2 style={{ fontSize: "1.5rem", marginBottom: 0 }}>{selectedJob?.title || "Carregando..."}</h2>
              </div>
              <button type="button" onClick={handleCloseJob} className="btn-secondary" style={{ padding: "0.5rem 0.75rem" }}>
                Fechar
              </button>
            </div>

            {jobDetailsLoading && (
              <div style={{ padding: "3rem 0", textAlign: "center" }}>
                <div className="loading" style={{ marginBottom: "1rem" }} />
                <p>Carregando detalhes...</p>
              </div>
            )}

            {jobDetailsError && <div className="alert alert-danger">{jobDetailsError}</div>}

            {selectedJob && !jobDetailsLoading && (
              <div style={{ display: "grid", gap: "1.25rem" }}>
                <section style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem", backgroundColor: "var(--surface)" }}>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "0.25rem" }}>{selectedJob.company}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    <span className="badge badge-primary">{selectedJob.category}</span>
                    <span className="badge badge-success">{selectedJob.source}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Tipo da vaga</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                        {getWorkplaceTypeLabel(selectedJob.workplaceType)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Localização</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>{selectedJob.location}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Publicada em</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>{formatDate(selectedJob.postedAt)}</p>
                    </div>
                    {selectedJob.salary && (
                      <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Salario</p>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>{selectedJob.salary}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Contrato</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                        {formatOptional(selectedJob.employmentType)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Senioridade</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                        {formatOptional(selectedJob.seniority)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Area</p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                        {formatOptional(selectedJob.department)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                        Adicionada na ferramenta
                      </p>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                        {formatDate(selectedJob.createdAt)}
                      </p>
                    </div>
                    {selectedJob.expiresAt && (
                      <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Expira em</p>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                          {formatDate(selectedJob.expiresAt)}
                        </p>
                      </div>
                    )}
                    {selectedJob.externalUpdatedAt && (
                      <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                          Atualizada na fonte
                        </p>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 0 }}>
                          {formatDate(selectedJob.externalUpdatedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {getSignalsDisplayTags(selectedJob.signals).length > 0 && (
                  <section>
                    <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Requerimentos da vaga</h3>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {getSignalsDisplayTags(selectedJob.signals).map((signal) => (
                        <span key={signal} className="tag" style={{ whiteSpace: "nowrap" }}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "-0.25rem" }}>
                  <button type="button" className="btn-secondary" disabled={jobActionBusy} onClick={handleToggleSaved}>
                    {selectedJob.saved ? "★ Remover dos salvos" : "☆ Salvar"}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={jobActionBusy}
                    onClick={handleOpenApplication}
                    style={{
                      justifyContent: "center",
                      textDecoration: "none",
                      marginTop: 0,
                      padding: "0.85rem 1rem",
                      borderRadius: "0.75rem",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <ExternalLinkIcon />
                    Abrir candidatura
                  </button>
                  <button type="button" className="btn-primary" disabled={jobActionBusy || Boolean(selectedJob.applicationStatus)} onClick={handleMarkApplied}>
                    {selectedJob.applicationStatus ? `✓ ${applicationStatusLabels[selectedJob.applicationStatus] || selectedJob.applicationStatus}` : "Marcar como aplicado"}
                  </button>
                </div>

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

                <section>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Descrição</h3>
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

                <section style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
                  {selectedJob.externalReference && (
                    <p style={{ marginBottom: 0 }}>
                      <strong>Codigo da vaga:</strong> {selectedJob.externalReference}
                    </p>
                  )}
                  <p style={{ marginBottom: 0 }}>
                    <strong>Fonte:</strong> {selectedJob.source}
                  </p>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
