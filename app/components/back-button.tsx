"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "← Voltar" }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="btn-secondary"
      style={{
        marginBottom: "1.5rem",
        padding: "0.625rem 1.25rem",
      }}
    >
      {label}
    </button>
  );
}
