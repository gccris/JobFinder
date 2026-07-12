import axios from "axios";
import { limitedAxiosGet } from "@/lib/sync-http";
import { categorizeJob } from "@/lib/job-classification";
import { cleanString, compactRawMetadata, ParsedJob } from "./shared";

const DETAIL_CONCURRENCY = 6;

type GreenhouseNamedItem = {
  id?: number;
  name?: string;
  location?: string | null;
};

type GreenhouseMetadata = {
  id?: number;
  name?: string;
  value_type?: string;
  value?: unknown;
};

type GreenhousePayRange = {
  min_cents?: number | null;
  max_cents?: number | null;
  currency_type?: string | null;
  title?: string | null;
  blurb?: string | null;
};

type GreenhouseJob = {
  id: number;
  title: string;
  content?: string;
  company_name?: string;
  absolute_url?: string;
  location?: {
    name?: string;
  };
  departments?: GreenhouseNamedItem[];
  offices?: GreenhouseNamedItem[];
  first_published?: string;
  updated_at?: string;
  application_deadline?: string | null;
  requisition_id?: string | number | null;
  internal_job_id?: string | number | null;
  language?: string | null;
  metadata?: GreenhouseMetadata[] | null;
  pay_input_ranges?: GreenhousePayRange[];
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

export async function fetchGreenhouseJobs(siteName: string, companyName: string) {
  try {
    if (!siteName.trim()) {
      console.log("Site name Greenhouse nao fornecido");
      return [];
    }

    const url = `https://boards-api.greenhouse.io/v1/boards/${siteName}/jobs`;
    console.log(`Buscando vagas da Greenhouse em: ${url}`);

    const response = await limitedAxiosGet<GreenhouseResponse>(url, {
      headers: {
        Accept: "application/json",
      },
    });

    const jobs = response.data.jobs || [];
    console.log(`${jobs.length} vagas encontradas na Greenhouse para ${siteName}`);

    return mapWithConcurrency(jobs, DETAIL_CONCURRENCY, async (job) => {
      const detail = await fetchGreenhouseJobDetail(siteName, job.id);
      return normalizeGreenhouseJob(detail || job, companyName, siteName);
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(`Empresa Greenhouse nao encontrada: ${siteName}`);
    } else {
      console.error("Erro ao buscar vagas da Greenhouse:", error);
    }
    throw error;
  }
}

async function fetchGreenhouseJobDetail(siteName: string, jobId: number) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${siteName}/jobs/${jobId}?pay_transparency=true`;

  try {
    const response = await limitedAxiosGet<GreenhouseJob>(url, {
      headers: {
        Accept: "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar detalhe Greenhouse ${siteName}/${jobId}:`, error);
    return null;
  }
}

function normalizeGreenhouseJob(
  job: GreenhouseJob,
  companyName: string,
  siteName: string
): ParsedJob {
  const departmentNames = getNames(job.departments);
  const officeNames = getNames(job.offices);
  const officeLocations = (job.offices || [])
    .map((office) => office.location)
    .filter((location): location is string => Boolean(location?.trim()));
  const location =
    job.location?.name ||
    officeLocations[0] ||
    officeNames[0] ||
    "Nao especificado";
  const postedAt = job.first_published || job.updated_at || new Date().toISOString();
  const workplaceType = inferWorkplaceType([
    job.title,
    location,
    ...officeNames,
    ...officeLocations,
  ]);
  const workplaceTag = workplaceTypeToTag(workplaceType);
  const metadataTags = metadataToTags(job.metadata);
  const payRange = getPrimaryPayRange(job.pay_input_ranges);
  const department = departmentNames[0];

  return {
    id: String(job.id),
    title: job.title,
    description: stripHtml(job.content || ""),
    company: job.company_name || companyName,
    location,
    salary: formatPayRanges(job.pay_input_ranges),
    salaryMin: centsToAmount(payRange?.min_cents),
    salaryMax: centsToAmount(payRange?.max_cents),
    salaryCurrency: cleanString(payRange?.currency_type),
    salaryInterval: cleanString(payRange?.title),
    source: "greenhouse",
    externalId: String(job.id),
    externalReference: cleanString(job.requisition_id),
    externalUpdatedAt: job.updated_at ? new Date(job.updated_at).toISOString() : undefined,
    url: job.absolute_url || `https://job-boards.greenhouse.io/${siteName}`,
    jobUrl: job.absolute_url,
    category: categorizeJob([job.title, ...departmentNames, ...metadataTags].join(" ")),
    department: cleanString(department),
    workplaceType,
    postedAt: new Date(postedAt).toISOString(),
    expiresAt: job.application_deadline
      ? new Date(job.application_deadline).toISOString()
      : undefined,
    tags: [workplaceTag, ...departmentNames, ...officeNames, ...metadataTags].filter(Boolean),
    rawMetadata: compactRawMetadata({
      internalJobId: job.internal_job_id,
      language: job.language,
      offices: job.offices,
      metadata: job.metadata,
      payRangeBlurb: payRange?.blurb,
    }),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function inferWorkplaceType(values: string[]): string {
  const text = values.join(" ").toLowerCase();

  if (text.includes("hybrid")) return "HYBRID";
  if (text.includes("remote")) return "REMOTE";
  if (
    text.includes("onsite") ||
    text.includes("on-site") ||
    text.includes("on site")
  ) {
    return "ONSITE";
  }

  return "UNSPECIFIED";
}

function workplaceTypeToTag(workplaceType: string) {
  if (workplaceType === "REMOTE") return "Remote";
  if (workplaceType === "HYBRID") return "Hybrid";
  if (workplaceType === "ONSITE") return "Onsite";
  return "Nao informado";
}

function getNames(items?: GreenhouseNamedItem[]) {
  return (items || [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));
}

function metadataToTags(metadata?: GreenhouseMetadata[] | null) {
  return (metadata || [])
    .map((item) => {
      const name = item.name?.trim();
      const value = formatMetadataValue(item.value);

      if (!name && !value) return null;
      if (!name) return value;
      if (!value) return name;

      return `${name}: ${value}`;
    })
    .filter((tag): tag is string => Boolean(tag));
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => formatMetadataValue(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") return "";
  return String(value).trim();
}

function formatPayRanges(ranges?: GreenhousePayRange[]) {
  const formatted = (ranges || [])
    .map((range) => {
      const currency = range.currency_type || "";
      const min = formatMoney(range.min_cents, currency);
      const max = formatMoney(range.max_cents, currency);
      const amount = min && max ? `${min} - ${max}` : min || max;

      if (!amount) return null;
      return range.title ? `${range.title}: ${amount}` : amount;
    })
    .filter((range): range is string => Boolean(range));

  return formatted.length > 0 ? formatted.join("; ") : undefined;
}

function formatMoney(cents?: number | null, currency?: string) {
  if (typeof cents !== "number") return "";

  const amount = cents / 100;
  if (!currency) return String(amount);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function getPrimaryPayRange(ranges?: GreenhousePayRange[]) {
  return (ranges || []).find((range) => range.min_cents || range.max_cents);
}

function centsToAmount(cents?: number | null) {
  if (typeof cents !== "number") return undefined;
  return Math.round(cents / 100);
}

function stripHtml(html: string): string {
  if (!html) return "";

  return decodeHtmlEntities(html)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
