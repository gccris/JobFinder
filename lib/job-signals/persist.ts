import { Prisma } from "@prisma/client";
import { JobSignals, extractJobSignals } from "./extractor";

type SignalInput = {
  jobId: string;
  title: string;
  description: string;
  tags?: string[];
};

export function buildJobSignals(input: SignalInput): Prisma.JobSignalsCreateInput {
  const signals = extractJobSignals([input.title, input.description, ...(input.tags || [])].filter(Boolean).join(" "));

  return {
    job: {
      connect: {
        id: input.jobId,
      },
    },
    keywords: signals.keywords,
    tools: signals.tools,
    languages: signals.languages,
    frameworks: signals.frameworks,
    concepts: signals.concepts,
    normalizedTextHash: signals.normalizedTextHash,
    analyzerVersion: signals.analyzerVersion,
    analyzedAt: new Date(),
  };
}

export function buildJobSignalsUpdate(input: Omit<SignalInput, "jobId">) {
  const signals = extractJobSignals([input.title, input.description, ...(input.tags || [])].filter(Boolean).join(" "));

  return {
    keywords: signals.keywords,
    tools: signals.tools,
    languages: signals.languages,
    frameworks: signals.frameworks,
    concepts: signals.concepts,
    normalizedTextHash: signals.normalizedTextHash,
    analyzerVersion: signals.analyzerVersion,
    analyzedAt: new Date(),
  };
}

export function signalsToTags(signals?: JobSignals | null) {
  if (!signals) return [];
  return Array.from(
    new Set([
      ...signals.languages,
      ...signals.frameworks,
      ...signals.tools,
      ...signals.concepts,
      ...signals.keywords,
    ])
  );
}
