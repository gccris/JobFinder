"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BackButton from "@/app/components/back-button";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  category: string;
  postedAt: string;
  url: string;
}

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 20;

  useEffect(() => {
    fetchJobs();
  }, [page, category, location, search]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (category) params.append("category", category);
      if (location) params.append("location", location);
      if (search) params.append("search", search);

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();

      setJobs(data.data);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCategory("");
    setLocation("");
    setSearch("");
    setPage(1);
  };

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <BackButton label="← Voltar" />
        <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "2rem" }}>
          🔍 Vagas de Emprego
        </h1>

        {/* Filters */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "1rem" }}>Filtros</h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem"
          }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Buscar
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Título, empresa..."
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="BACKEND">Backend</option>
                <option value="FRONTEND">Frontend</option>
                <option value="FULLSTACK">Fullstack</option>
                <option value="DEVOPS">DevOps</option>
                <option value="DATASCIENCE">Data Science</option>
                <option value="PRODUCT">Product</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Localização
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Cidade, remoto..."
              />
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              <button
                onClick={() => setPage(1)}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                🔎 Buscar
              </button>
              <button
                onClick={handleReset}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                ✕ Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="loading" style={{ margin: "0 auto", marginBottom: "1rem" }} />
            <p style={{ color: "var(--text-secondary)" }}>Carregando vagas...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
              ❌ Nenhuma vaga encontrada
            </p>
            <button
              onClick={handleReset}
              className="btn-primary"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="job-card"
                  style={{ display: "block", textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem"
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 className="job-title">{job.title}</h3>
                      <p className="job-company">{job.company}</p>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        📍 {job.location}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {job.salary && (
                        <p className="job-salary" style={{ marginBottom: "0.5rem" }}>
                          💰 {job.salary}
                        </p>
                      )}
                      <span className="badge badge-primary">{job.category}</span>
                    </div>
                  </div>
                  <p style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    marginTop: "0.5rem"
                  }}>
                    📅 {new Date(job.postedAt).toLocaleDateString("pt-BR")}
                  </p>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap"
            }}>
              <p style={{ color: "var(--text-secondary)" }}>
                Mostrando {jobs.length} de {total} vagas
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * limit >= total}
                  className="btn-secondary"
                >
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
