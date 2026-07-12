import { limitedAxiosGet } from "@/lib/sync-http";

export type ParsedJob = {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryInterval?: string;
  source: string;
  externalId: string;
  externalReference?: string;
  externalUpdatedAt?: string;
  url: string;
  applicationUrl?: string;
  jobUrl?: string;
  category: string;
  employmentType?: string;
  seniority?: string;
  department?: string;
  requirements?: string;
  workplaceType: string;
  postedAt: string;
  expiresAt?: string;
  tags: string[];
  rawMetadata?: Record<string, unknown>;
};

export async function fetchJsonCandidates<T>(candidates: string[]) {
  let lastError: unknown;
  for (const url of candidates) {
    try {
      const response = await limitedAxiosGet<T>(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("Nenhum endpoint candidato foi informado");
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities((html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim());
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeWorkplaceTypeText(value?: string) {
  const normalized = value?.toLowerCase() || "";
  if (normalized.includes("remote")) return "REMOTE";
  if (normalized.includes("hybrid")) return "HYBRID";
  if (normalized.includes("onsite") || normalized.includes("on site") || normalized.includes("on-site")) {
    return "ONSITE";
  }
  return "UNSPECIFIED";
}

export function workplaceTypeTag(workplaceType: string) {
  if (workplaceType === "REMOTE") return "Remote";
  if (workplaceType === "HYBRID") return "Hybrid";
  if (workplaceType === "ONSITE") return "Onsite";
  return "Não informado";
}

export function uniqueTags(tags: Array<string | undefined | null>) {
  return Array.from(new Set(tags.filter((tag): tag is string => Boolean(tag && tag.trim()))));
}

export function cleanString(value?: string | number | null) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function compactRawMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
      return true;
    })
  );
}

export function formatSalaryRange(
  min?: number | null,
  max?: number | null,
  currency?: string | null,
  interval?: string | null,
  label?: string | null
) {
  const formattedMin = formatMoney(min, currency);
  const formattedMax = formatMoney(max, currency);
  const amount =
    formattedMin && formattedMax
      ? `${formattedMin} - ${formattedMax}`
      : formattedMin || formattedMax;
  if (!amount) return undefined;

  const intervalText = interval ? ` / ${interval}` : "";
  const labelText = label ? `${label}: ` : "";
  return `${labelText}${amount}${intervalText}`;
}

export function formatMoney(value?: number | null, currency?: string | null) {
  if (typeof value !== "number") return undefined;
  if (!currency) return String(value);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}
