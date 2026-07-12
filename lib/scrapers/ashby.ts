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

type AshbyCompensationComponent = {
  compensationType?: string;
  interval?: string;
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  summary?: string;
};

type AshbyCompensation = {
  compensationTierSummary?: string;
  scrapeableCompensationSalarySummary?: string;
  compensationTiers?: Array<{
    title?: string;
    tierSummary?: string;
    components?: AshbyCompensationComponent[];
  }>;
  summaryComponents?: AshbyCompensationComponent[];
};

type AshbyJob = {
  id?: string;
  title?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  location?: string;
  secondaryLocations?: Array<{
    location?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  }>;
  address?: {
    postalAddress?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  employmentType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: "OnSite" | "Remote" | "Hybrid" | string;
  compensation?: AshbyCompensation;
};

type AshbyResponse =
  | {
      apiVersion?: string;
      jobs?: AshbyJob[];
      compensation?: AshbyCompensation;
    }
  | AshbyJob[];

export async function fetchAshbyJobs(boardSlug: string, companyName: string): Promise<ParsedJob[]> {
  const response = await fetchJsonCandidates<AshbyResponse>([
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardSlug)}?includeCompensation=true`,
  ]);

  const jobs = extractJobs(response);
  const boardCompensation = !Array.isArray(response) ? response?.compensation : undefined;

  return jobs.map((job) => {
    const location = getLocation(job);
    const workplaceType = normalizeAshbyWorkplaceType(job);
    const department = cleanString(job.department);
    const team = cleanString(job.team);
    const title = job.title || "Sem titulo";
    const compensation = job.compensation || boardCompensation;
    const salary = getAshbySalary(compensation);
    const applicationUrl = job.applyUrl;
    const jobUrl = job.jobUrl;

    return {
      id: job.id || `${boardSlug}-${title}-${location}`,
      title,
      description: stripHtml(job.descriptionHtml || job.descriptionPlain || ""),
      company: companyName,
      location,
      salary: salary.display,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryInterval: salary.interval,
      source: "ashby",
      externalId: job.id || `${boardSlug}-${title}-${location}`,
      url: applicationUrl || jobUrl || `https://jobs.ashbyhq.com/${boardSlug}`,
      applicationUrl,
      jobUrl,
      category: categorizeJob([title, department, team].filter(Boolean).join(" ")),
      employmentType: cleanString(job.employmentType),
      department: cleanString([department, team].filter(Boolean).join(" / ")),
      workplaceType,
      postedAt: job.publishedAt || new Date().toISOString(),
      tags: uniqueTags([workplaceTypeTag(workplaceType), department, team]),
      rawMetadata: compactRawMetadata({
        isListed: job.isListed,
        secondaryLocations: job.secondaryLocations,
        address: job.address,
        compensation,
      }),
    };
  });
}

function extractJobs(response: AshbyResponse | null): AshbyJob[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return Array.isArray(response.jobs) ? response.jobs : [];
}

function normalizeAshbyWorkplaceType(job: AshbyJob) {
  const raw = job.workplaceType?.toLowerCase();
  if (raw === "remote" || job.isRemote) return "REMOTE";
  if (raw === "hybrid") return "HYBRID";
  if (raw === "onsite" || raw === "on-site" || raw === "on site") return "ONSITE";
  return normalizeWorkplaceTypeText(job.employmentType || job.location);
}

function getLocation(job: AshbyJob) {
  if (job.location?.trim()) return job.location.trim();

  const fromSecondary = job.secondaryLocations?.[0];
  const secondaryParts = [
    fromSecondary?.location,
    fromSecondary?.address?.addressLocality,
    fromSecondary?.address?.addressRegion,
    fromSecondary?.address?.addressCountry,
  ].filter(Boolean) as string[];

  if (secondaryParts.length > 0) {
    return secondaryParts.join(", ").trim();
  }

  const postal = job.address?.postalAddress;
  const postalParts = [
    postal?.addressLocality,
    postal?.addressRegion,
    postal?.addressCountry,
  ].filter(Boolean) as string[];

  if (postalParts.length > 0) {
    return postalParts.join(", ").trim();
  }

  return "Nao especificado";
}

function getAshbySalary(compensation?: AshbyCompensation) {
  const salaryComponent =
    compensation?.summaryComponents?.find(isSalaryComponent) ||
    compensation?.compensationTiers
      ?.flatMap((tier) => tier.components || [])
      .find(isSalaryComponent);

  return {
    display:
      cleanString(compensation?.scrapeableCompensationSalarySummary) ||
      cleanString(compensation?.compensationTierSummary) ||
      cleanString(salaryComponent?.summary),
    min: typeof salaryComponent?.minValue === "number" ? salaryComponent.minValue : undefined,
    max: typeof salaryComponent?.maxValue === "number" ? salaryComponent.maxValue : undefined,
    currency: cleanString(salaryComponent?.currencyCode),
    interval: cleanString(salaryComponent?.interval),
  };
}

function isSalaryComponent(component: AshbyCompensationComponent) {
  return component.compensationType?.toLowerCase() === "salary";
}
