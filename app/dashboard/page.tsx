"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SavedJob {
  id: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    category: string;
    postedAt: string;
    url: string;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchSavedJobs();
    }
  }, [status, router]);

  const fetchSavedJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/saved-jobs");
      const data = await res.json();
      setSavedJobs(data.data || []);
    } catch (error) {
      console.error("Error fetching saved jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/save`, {
        method: "DELETE",
      });
      setSavedJobs(savedJobs.filter((item) => item.job.id !== jobId));
    } catch (error) {
      console.error("Error removing job:", error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Minhas Vagas Salvas</h1>
          <Link href="/jobs" className="text-blue-600 hover:underline">
            Buscar mais vagas
          </Link>
        </div>

        {savedJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 mb-4">Você ainda não salvou nenhuma vaga</p>
            <Link
              href="/jobs"
              className="inline-block text-blue-600 hover:underline"
            >
              Explorar vagas
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {savedJobs.map(({ id, job }) => (
              <div
                key={id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex-1 hover:text-blue-600"
                  >
                    <h3 className="text-lg font-bold text-gray-900">
                      {job.title}
                    </h3>
                    <p className="text-sm text-gray-600">{job.company}</p>
                    <p className="text-sm text-gray-500">{job.location}</p>
                  </Link>

                  <div className="text-right ml-4">
                    {job.salary && (
                      <p className="text-lg font-semibold text-green-600">
                        {job.salary}
                      </p>
                    )}
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mb-4">
                      {job.category}
                    </span>
                    <button
                      onClick={() => handleRemove(job.id)}
                      className="block w-full bg-red-100 text-red-800 px-4 py-2 rounded hover:bg-red-200 text-sm font-semibold"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  Salvo em:{" "}
                  {new Date(job.postedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
