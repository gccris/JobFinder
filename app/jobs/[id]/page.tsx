"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Job {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  salary?: string;
  category: string;
  tags: string[];
  postedAt: string;
  url: string;
  source: string;
}

export default function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/jobs/${params.id}`);
      const data = await res.json();
      setJob(data);

      // Check if saved
      if (session?.user) {
        checkIfSaved();
      }
    } catch (error) {
      console.error("Error fetching job:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/saved`);
      if (res.ok) {
        setSaved(true);
      }
    } catch (error) {
      console.error("Error checking saved status:", error);
    }
  };

  const handleSaveJob = async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    try {
      setSavingJob(true);

      if (saved) {
        await fetch(`/api/jobs/${params.id}/save`, {
          method: "DELETE",
        });
        setSaved(false);
      } else {
        await fetch(`/api/jobs/${params.id}/save`, {
          method: "POST",
        });
        setSaved(true);
      }
    } catch (error) {
      console.error("Error toggling saved job:", error);
    } finally {
      setSavingJob(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Carregando vaga...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Vaga não encontrada</p>
          <Link href="/jobs" className="text-blue-600 hover:underline">
            Voltar para vagas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/jobs" className="text-blue-600 hover:underline mb-6 inline-block">
          ← Voltar
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {job.title}
              </h1>
              <p className="text-xl text-gray-600">{job.company}</p>
            </div>
            <button
              onClick={handleSaveJob}
              disabled={savingJob}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                saved
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {saved ? "Remover dos Favoritos" : "Salvar"}
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Localização</p>
              <p className="font-semibold text-gray-900">{job.location}</p>
            </div>
            {job.salary && (
              <div>
                <p className="text-sm text-gray-600">Salário</p>
                <p className="font-semibold text-gray-900">{job.salary}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">Categoria</p>
              <p className="font-semibold text-gray-900">{job.category}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Descrição
            </h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
          </div>

          {job.tags && job.tags.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-4 text-gray-900">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-8">
            <p className="text-sm text-gray-600 mb-4">
              Postado em: {new Date(job.postedAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Fonte: <strong>{job.source}</strong>
            </p>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Candidatar-se →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
