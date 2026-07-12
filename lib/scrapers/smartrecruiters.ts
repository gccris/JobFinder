import axios from "axios";
import { limitedAxiosGet } from "@/lib/sync-http";
import { categorizeJob } from "@/lib/job-classification";
import {
  cleanString,
  compactRawMetadata,
  fetchJsonCandidates,
  normalizeWorkplaceTypeText,
  ParsedJob,
  stripHtml,
  uniqueTags,
  workplaceTypeTag,
} from "./shared";

const DETAIL_CONCURRENCY = 6;

type SmartRecruitersLabeledValue = {
  id?: string;
  label?: string;
  name?: string;
};

type SmartRecruitersLocation = {
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  workplaceType?: string;
  address?: string;
};

type SmartRecruitersPosting = {
  id?: string;
  uuid?: string;
  name?: string;
  title?: string;
  refNumber?: string;
  jobAdUrl?: string;
  applyUrl?: string;
  detailUrl?: string;
  jobAd?: {
    companyDescription?: string;
    jobDescription?: string;
    qualifications?: string;
    additionalInformation?: string;
    sections?: {
      requirements?: string;
      preferredQualifications?: string;
      description?: string;
    };
  };
  updatedDate?: string;
  releasedDate?: string;
  postedDate?: string;
  location?: SmartRecruitersLocation;
  department?: SmartRecruitersLabeledValue;
  category?: SmartRecruitersLabeledValue;
  function?: SmartRecruitersLabeledValue;
  industry?: SmartRecruitersLabeledValue;
  experienceLevel?: SmartRecruitersLabeledValue;
  typeOfEmployment?: SmartRecruitersLabeledValue;
  compensation?: unknown;
  company?: {
    name?: string;
    identifier?: string;
  };
};

type SmartRecruitersOffer = {
  id?: string;
  postingId?: string;
  status?: string;
  name?: string;
  title?: string;
  jobAdUrl?: string;
  applyUrl?: string;
  detailUrl?: string;
  postedDate?: string;
  updatedDate?: string;
  releasedDate?: string;
  expiresAt?: string;
  expirationDate?: string;
  validThrough?: string;
  location?: SmartRecruitersLocation;
  department?: SmartRecruitersLabeledValue;
  category?: SmartRecruitersLabeledValue;
  function?: SmartRecruitersLabeledValue;
  industry?: SmartRecruitersLabeledValue;
  experienceLevel?: SmartRecruitersLabeledValue;
  typeOfEmployment?: SmartRecruitersLabeledValue;
  compensation?: unknown;
  salary?: unknown;
  payRange?: unknown;
  jobAd?: SmartRecruitersPosting["jobAd"];
  company?: SmartRecruitersPosting["company"];
};

type SmartRecruitersResponse =
  | { jobs?: SmartRecruitersPosting[] }
  | { content?: SmartRecruitersPosting[] }
  | { postings?: SmartRecruitersPosting[] }
  | { data?: SmartRecruitersPosting[] }
  | SmartRecruitersPosting[];

type SmartRecruitersOfferResponse =
  | { content?: SmartRecruitersOffer[] }
  | { offers?: SmartRecruitersOffer[] }
  | { data?: SmartRecruitersOffer[] }
  | SmartRecruitersOffer[]
  | SmartRecruitersOffer;

export async function fetchSmartRecruitersJobs(
  boardSlug: string,
  companyName: string
): Promise<ParsedJob[]> {
  const response = await fetchSmartRecruitersPostings(boardSlug);
  const jobs = extractJobs(response).filter((job) =>
    belongsToCompany(job, boardSlug)
  );

  return mapWithConcurrency(jobs, DETAIL_CONCURRENCY, async (job) => {
    const offer = await fetchSmartRecruitersOffer(job.id || job.uuid || "");
    return normalizeSmartRecruitersJob(job, offer, boardSlug, companyName);
  });
}

async function fetchSmartRecruitersPostings(boardSlug: string) {
  const token = getSmartRecruitersToken();

  if (token) {
    try {
      const response = await limitedAxiosGet<SmartRecruitersResponse>(
        "https://api.smartrecruiters.com/feed/publications",
        {
          headers: {
            Accept: "application/json",
            "X-SmartToken": token,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erro ao buscar feed SmartRecruiters:", error);
    }
  }

  const candidates = [
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(boardSlug)}/postings`,
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(boardSlug)}/postings?limit=100`,
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(boardSlug)}/jobs`,
  ];

  return fetchJsonCandidates<SmartRecruitersResponse>(candidates);
}

async function fetchSmartRecruitersOffer(postingId: string) {
  if (!postingId.trim()) return null;

  const token = getSmartRecruitersToken();

  try {
    const response = await limitedAxiosGet<SmartRecruitersOfferResponse>(
      `https://api.smartrecruiters.com/v1/offers?postingId=${encodeURIComponent(postingId)}`,
      {
        headers: {
          Accept: "application/json",
          ...(token ? { "X-SmartToken": token } : {}),
        },
      }
    );

    return extractOffers(response.data)[0] || null;
  } catch (error) {
    console.error(`Erro ao buscar offer SmartRecruiters ${postingId}:`, error);
    return null;
  }
}

function normalizeSmartRecruitersJob(
  job: SmartRecruitersPosting,
  offer: SmartRecruitersOffer | null,
  boardSlug: string,
  companyName: string
): ParsedJob {
  const merged = mergePostingWithOffer(job, offer);
  const location = getLocation(merged);
  const title = merged.title || merged.name || "Sem titulo";
  const workplaceType = normalizeWorkplaceTypeText(
    merged.location?.workplaceType ||
      (merged.location?.remote ? "remote" : "") ||
      location
  );
  const jobBody = getJobBody(merged);
  const requirements = getRequirements(merged);
  const labels = getLabels([
    merged.department,
    merged.category,
    merged.function,
    merged.industry,
    merged.experienceLevel,
    merged.typeOfEmployment,
  ]);
  const department = getLabel(merged.department) || getLabel(merged.function);
  const externalId = job.id || job.uuid || `${boardSlug}-${title}-${location}`;
  const compensation = getCompensationDetails(
    offer?.salary || offer?.payRange || offer?.compensation || job.compensation
  );

  return {
    id: externalId,
    title,
    description: stripHtml(jobBody),
    company: merged.company?.name || companyName,
    location,
    salary: compensation.display,
    salaryMin: compensation.min,
    salaryMax: compensation.max,
    salaryCurrency: compensation.currency,
    salaryInterval: compensation.interval,
    source: "smartrecruiters",
    externalId,
    externalReference: cleanString(merged.refNumber),
    externalUpdatedAt: merged.updatedDate ? new Date(merged.updatedDate).toISOString() : undefined,
    url:
      merged.applyUrl ||
      merged.jobAdUrl ||
      merged.detailUrl ||
      `https://careers.smartrecruiters.com/${boardSlug}`,
    applicationUrl: merged.applyUrl,
    jobUrl: merged.jobAdUrl || merged.detailUrl,
    category: categorizeJob([title, ...labels].join(" ")),
    employmentType: getLabel(merged.typeOfEmployment),
    seniority: getLabel(merged.experienceLevel),
    department: cleanString(department),
    requirements,
    workplaceType,
    postedAt:
      merged.postedDate ||
      merged.releasedDate ||
      merged.updatedDate ||
      new Date().toISOString(),
    expiresAt: offer?.expiresAt || offer?.expirationDate || offer?.validThrough,
    tags: uniqueTags([workplaceTypeTag(workplaceType), ...labels]),
    rawMetadata: compactRawMetadata({
      alternateId: job.id && job.uuid ? (externalId === job.id ? job.uuid : job.id) : undefined,
      companyIdentifier: merged.company?.identifier,
      companyId: (merged.company as { cid?: string } | undefined)?.cid,
      status: (merged as { status?: string }).status,
      location: merged.location,
      companyDescription: merged.jobAd?.companyDescription,
    }),
  };
}

function mergePostingWithOffer(
  job: SmartRecruitersPosting,
  offer: SmartRecruitersOffer | null
): SmartRecruitersPosting & SmartRecruitersOffer {
  if (!offer) return job;

  return {
    ...job,
    ...offer,
    jobAd: offer.jobAd || job.jobAd,
    location: offer.location || job.location,
    company: offer.company || job.company,
    department: offer.department || job.department,
    category: offer.category || job.category,
    function: offer.function || job.function,
    industry: offer.industry || job.industry,
    experienceLevel: offer.experienceLevel || job.experienceLevel,
    typeOfEmployment: offer.typeOfEmployment || job.typeOfEmployment,
  };
}

function extractJobs(response: SmartRecruitersResponse | null): SmartRecruitersPosting[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray((response as { jobs?: SmartRecruitersPosting[] }).jobs)) {
    return (response as { jobs?: SmartRecruitersPosting[] }).jobs || [];
  }
  if (Array.isArray((response as { content?: SmartRecruitersPosting[] }).content)) {
    return (response as { content?: SmartRecruitersPosting[] }).content || [];
  }
  if (Array.isArray((response as { postings?: SmartRecruitersPosting[] }).postings)) {
    return (response as { postings?: SmartRecruitersPosting[] }).postings || [];
  }
  if (Array.isArray((response as { data?: SmartRecruitersPosting[] }).data)) {
    return (response as { data?: SmartRecruitersPosting[] }).data || [];
  }
  return [];
}

function extractOffers(response: SmartRecruitersOfferResponse | null): SmartRecruitersOffer[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray((response as { content?: SmartRecruitersOffer[] }).content)) {
    return (response as { content?: SmartRecruitersOffer[] }).content || [];
  }
  if (Array.isArray((response as { offers?: SmartRecruitersOffer[] }).offers)) {
    return (response as { offers?: SmartRecruitersOffer[] }).offers || [];
  }
  if (Array.isArray((response as { data?: SmartRecruitersOffer[] }).data)) {
    return (response as { data?: SmartRecruitersOffer[] }).data || [];
  }
  return [response as SmartRecruitersOffer];
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

function belongsToCompany(job: SmartRecruitersPosting, boardSlug: string) {
  const companyIdentifier = job.company?.identifier?.toLowerCase();
  if (!companyIdentifier) return true;
  return companyIdentifier === boardSlug.toLowerCase();
}

function getSmartRecruitersToken() {
  return (
    process.env.SMARTRECRUITERS_TOKEN ||
    process.env.SMARTRECRUITERS_API_KEY ||
    ""
  ).trim();
}

function getLocation(job: SmartRecruitersPosting | SmartRecruitersOffer) {
  const parts = [job.location?.city, job.location?.region, job.location?.country]
    .map((part) => part?.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return job.location?.address?.trim() || "Nao especificado";
}

function getJobBody(job: SmartRecruitersPosting | SmartRecruitersOffer) {
  return [
    job.jobAd?.sections?.description,
    job.jobAd?.jobDescription,
    job.jobAd?.additionalInformation,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getRequirements(job: SmartRecruitersPosting | SmartRecruitersOffer) {
  const requirements = [
    job.jobAd?.sections?.requirements,
    job.jobAd?.qualifications,
    job.jobAd?.sections?.preferredQualifications,
  ]
    .filter(Boolean)
    .join("\n\n");

  return cleanString(stripHtml(requirements));
}

function getLabels(values: Array<SmartRecruitersLabeledValue | undefined>) {
  return values
    .map((value) => value?.label || value?.name)
    .filter((label): label is string => Boolean(label?.trim()));
}

function getLabel(value?: SmartRecruitersLabeledValue) {
  return cleanString(value?.label || value?.name);
}

function getCompensationDetails(value: unknown) {
  const display = formatCompensation(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { display };
  }

  const record = value as Record<string, unknown>;
  const currency = stringValue(
    record.currency ||
      record.currencyCode ||
      record.currencyType ||
      record.currency_type
  );
  const minRaw =
    record.min ||
    record.minimum ||
    record.minAmount ||
    record.minValue ||
    record.from ||
    record.min_cents;
  const maxRaw =
    record.max ||
    record.maximum ||
    record.maxAmount ||
    record.maxValue ||
    record.to ||
    record.max_cents;

  return {
    display,
    min: numberAmount(minRaw, Boolean(record.min_cents)),
    max: numberAmount(maxRaw, Boolean(record.max_cents)),
    currency: cleanString(currency),
    interval: cleanString(stringValue(record.period || record.interval || record.unit)),
  };
}

function numberAmount(value: unknown, inCents: boolean) {
  if (typeof value !== "number") return undefined;
  return inCents ? Math.round(value / 100) : value;
}

function formatCompensation(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const values = value
      .map((item) => formatCompensation(item))
      .filter(Boolean);
    return values.length > 0 ? values.join("; ") : undefined;
  }
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const currency = stringValue(
    record.currency ||
      record.currencyCode ||
      record.currencyType ||
      record.currency_type
  );
  const min = moneyValue(
    record.min ||
      record.minimum ||
      record.minAmount ||
      record.minValue ||
      record.from ||
      record.min_cents,
    currency,
    Boolean(record.min_cents)
  );
  const max = moneyValue(
    record.max ||
      record.maximum ||
      record.maxAmount ||
      record.maxValue ||
      record.to ||
      record.max_cents,
    currency,
    Boolean(record.max_cents)
  );
  const single = moneyValue(
    record.amount || record.value || record.salary,
    currency,
    false
  );
  const label = stringValue(record.label || record.title || record.name);
  const period = stringValue(record.period || record.interval || record.unit);
  const amount = min && max ? `${min} - ${max}` : min || max || single;
  const suffix = period ? ` / ${period}` : "";

  if (amount) return label ? `${label}: ${amount}${suffix}` : `${amount}${suffix}`;

  return Object.entries(record)
    .filter(([, item]) => typeof item === "string" || typeof item === "number")
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(", ") || undefined;
}

function moneyValue(value: unknown, currency: string, inCents: boolean) {
  if (typeof value !== "number") return stringValue(value);

  const amount = inCents ? value / 100 : value;
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

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}
