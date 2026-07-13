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

type WorkableJob = {
  id?: string | number;
  code?: string;
  shortcode?: string;
  title?: string;
  description?: string;
  short_description?: string;
  country?: string;
  state?: string;
  city?: string;
  location?: { location_str?: string; city?: string; state?: string; country?: string };
  locations?: Array<{ location_str?: string; city?: string; state?: string; country?: string }>;
  department?: string;
  departments?: Array<{ name?: string }>;
  telecommuting?: boolean;
  remote?: boolean;
  workplace_type?: string;
  employment_type?: string;
  industry?: string;
  function?: string;
  experience?: string;
  education?: string;
  created_at?: string;
  published_at?: string;
  published_on?: string;
  updated_at?: string;
  application_url?: string;
  shortlink?: string;
  url?: string;
};

type WorkableResponse =
  | {
      name?: string;
      description?: string;
      jobs?: WorkableJob[];
    }
  | { results?: WorkableJob[] }
  | { data?: WorkableJob[] }
  | WorkableJob[];

export async function fetchWorkableJobs(
  boardSlug: string,
  companyName: string
): Promise<ParsedJob[]> {
  const candidates = [
    `https://www.workable.com/api/accounts/${encodeURIComponent(boardSlug)}?details=true`,
    `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(boardSlug)}/jobs`,
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(boardSlug)}/jobs`,
    `https://apply.workable.com/api/v1/accounts/${encodeURIComponent(boardSlug)}/jobs`,
  ];

  const response = await fetchJsonCandidates<WorkableResponse>(candidates);
  const jobs = extractJobs(response);
  const accountName =
    response && !Array.isArray(response) && "name" in response
      ? response.name
      : undefined;

  return jobs.map((job) => normalizeWorkableJob(job, boardSlug, accountName || companyName));
}

function normalizeWorkableJob(
  job: WorkableJob,
  boardSlug: string,
  companyName: string
): ParsedJob {
  const labels = getLabels(job);
  const location = getLocation(job);
  const workplaceType = normalizeWorkplaceTypeText(
    job.workplace_type ||
      (job.telecommuting || job.remote ? "remote" : "") ||
      job.employment_type ||
      location
  );
  const externalId = String(
    job.code || job.shortcode || job.id || job.title || `${boardSlug}-${location}`
  );
  const applicationUrl = job.application_url;
  const jobUrl = job.url || job.shortlink;

  return {
    id: externalId,
    title: job.title || "Sem titulo",
    description: stripHtml(job.description || job.short_description || ""),
    company: companyName,
    location,
    salary: undefined,
    source: "workable",
    externalId,
    externalUpdatedAt: job.updated_at ? new Date(job.updated_at).toISOString() : undefined,
    url: applicationUrl || jobUrl || `https://apply.workable.com/${boardSlug}`,
    applicationUrl,
    jobUrl,
    category: categorizeJob([job.title || "", ...labels].join(" ")),
    employmentType: cleanString(job.employment_type),
    seniority: cleanString(job.experience),
    department: cleanString(job.department || job.departments?.[0]?.name),
    workplaceType,
    postedAt:
      job.published_on ||
      job.published_at ||
      job.created_at ||
      job.updated_at ||
      new Date().toISOString(),
    tags: uniqueTags([workplaceTypeTag(workplaceType), ...labels]),
    rawMetadata: compactRawMetadata({
      accountSlug: boardSlug,
      education: job.education,
      industry: job.industry,
      function: job.function,
      locations: job.locations,
      location: job.location,
      alternateIds: {
        id: job.id,
        code: job.code,
        shortcode: job.shortcode,
      },
    }),
  };
}

function extractJobs(response: WorkableResponse | null): WorkableJob[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray((response as { jobs?: WorkableJob[] }).jobs)) {
    return (response as { jobs?: WorkableJob[] }).jobs || [];
  }
  if (Array.isArray((response as { results?: WorkableJob[] }).results)) {
    return (response as { results?: WorkableJob[] }).results || [];
  }
  if (Array.isArray((response as { data?: WorkableJob[] }).data)) {
    return (response as { data?: WorkableJob[] }).data || [];
  }
  return [];
}

function getLabels(job: WorkableJob) {
  const values = [
    job.department,
    ...(job.departments || []).map((item) => item.name),
    job.employment_type,
    job.industry,
    job.function,
    job.experience,
    job.education,
  ];

  return values.filter((value): value is string => Boolean(value?.trim()));
}

function getLocation(job: WorkableJob) {
  const candidates = [
    [job.city, job.state, job.country].filter(Boolean).join(", "),
    job.location?.location_str,
    [job.location?.city, job.location?.state, job.location?.country].filter(Boolean).join(", "),
    job.locations?.[0]?.location_str,
    [job.locations?.[0]?.city, job.locations?.[0]?.state, job.locations?.[0]?.country]
      .filter(Boolean)
      .join(", "),
  ];

  const location = candidates.find((value) => value && value.trim());
  return location?.trim() || "Nao especificado";
}
