import { categorizeJob } from "@/lib/job-classification";
import { limitedFetch } from "@/lib/sync-http";
import {
  cleanString,
  compactRawMetadata,
  normalizeWorkplaceTypeText,
  ParsedJob,
  stripHtml,
  uniqueTags,
  workplaceTypeTag,
} from "./shared";

type JazzJob = {
  id?: string | number;
  title?: string;
  description?: string;
  snippet?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalcode?: string;
  office?: string;
  category?: string;
  department?: string;
  type?: string;
  experience?: string;
  published?: string;
  posted?: string;
  created?: string;
  updated?: string;
  url?: string;
  apply_url?: string;
  remote?: boolean;
  status?: string;
};

type JazzResponse =
  | { jobs?: JazzJob[] }
  | { data?: JazzJob[] }
  | JazzJob[];

export async function fetchJazzhrJobs(boardSlug: string, companyName: string): Promise<ParsedJob[]> {
  const feedUrl = `https://app.jazz.co/feeds/export/jobs/${encodeURIComponent(boardSlug)}`;
  const response = await limitedFetch(feedUrl, {
    headers: {
      Accept: "application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter feed JazzHR (${response.status} ${response.statusText})`);
  }

  const xml = await response.text();
  const jobs = parseJazzFeed(xml);

  return jobs.map((job) => {
    const title = job.title || "Sem titulo";
    const location = formatLocation(job);
    const workplaceType = inferWorkplaceType(job.remote, [job.type, location, job.description, job.snippet].join(" "));
    const department = cleanString(job.department);
    const seniority = cleanString(job.experience) || inferSeniority([title, department || "", job.description || ""].join(" "));
    const employmentType = cleanString(job.type) || inferEmploymentType([job.description || "", job.snippet || ""].join(" "));
    const descriptionHtml = normalizeJazzText(job.description || job.snippet || "");
    const description = stripHtml(descriptionHtml);
    const requirements = extractRequirements(description);
    const salary = extractSalary(description);
    const expiresAt = extractDeadline(description);
    const categorySeed = [title, department || "", job.category || "", seniority || ""].join(" ");
    const externalId = cleanString(job.id) || `${boardSlug}-${title}-${location}`;
    const postedAt = parseDate(job.published) || parseDate(job.posted) || parseDate(job.created) || parseDate(job.updated) || new Date().toISOString();
    const externalUpdatedAt = parseDate(job.updated);

    return {
      id: String(externalId),
      title,
      description,
      company: companyName,
      location,
      salary: salary.display,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryInterval: salary.interval,
      source: "jazzhr",
      externalId: String(externalId),
      externalUpdatedAt,
      url: job.apply_url || job.url || `https://${boardSlug}.jazz.co`,
      applicationUrl: job.apply_url || job.url,
      jobUrl: job.url,
      category: categorizeJob(categorySeed),
      employmentType,
      seniority,
      department,
      requirements,
      workplaceType,
      postedAt,
      expiresAt,
      tags: uniqueTags([
        workplaceTypeTag(workplaceType),
        department,
        seniority,
        employmentType,
        job.category,
        job.experience,
        ...extractKeywords(`${title} ${description}`),
      ]),
      rawMetadata: compactRawMetadata({
        category: job.category,
        office: job.office,
        remote: job.remote,
        status: job.status,
        city: job.city,
        state: job.state,
        country: job.country,
        postalcode: job.postalcode,
        type: job.type,
        experience: job.experience,
      }),
    };
  });
}

function parseJazzFeed(xml: string): JazzJob[] {
  return [...xml.matchAll(/<job\b[^>]*>([\s\S]*?)<\/job>/gi)].map((match) => parseJazzJob(match[1] || ""));
}

function parseJazzJob(xml: string): JazzJob {
  return {
    id: normalizeJazzText(getTagValue(xml, "id")),
    title: normalizeJazzText(getTagValue(xml, "title")),
    description: normalizeJazzText(getTagValue(xml, "description")),
    snippet: normalizeJazzText(getTagValue(xml, "snippet")),
    location: cleanString(getTagValue(xml, "location")) || undefined,
    city: cleanString(getTagValue(xml, "city")) || undefined,
    state: cleanString(getTagValue(xml, "state")) || undefined,
    country: cleanString(getTagValue(xml, "country")) || undefined,
    postalcode: cleanString(getTagValue(xml, "postalcode")) || undefined,
    office: cleanString(getTagValue(xml, "office")) || undefined,
    category: cleanString(getTagValue(xml, "category")) || undefined,
    department: cleanString(getTagValue(xml, "department")) || undefined,
    type: cleanString(getTagValue(xml, "type")) || undefined,
    experience: cleanString(getTagValue(xml, "experience")) || undefined,
    published: cleanString(getTagValue(xml, "published")) || undefined,
    posted: cleanString(getTagValue(xml, "posted")) || undefined,
    created: cleanString(getTagValue(xml, "created")) || undefined,
    updated: cleanString(getTagValue(xml, "updated")) || undefined,
    url: cleanString(getTagValue(xml, "url")) || undefined,
    apply_url: cleanString(getTagValue(xml, "apply_url")) || undefined,
    remote: parseBoolean(getTagValue(xml, "remote")),
    status: cleanString(getTagValue(xml, "status")) || undefined,
  };
}

function getTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "i"));
  return normalizeJazzText(match?.[1] || "");
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseBoolean(value?: string) {
  const normalized = (value || "").toLowerCase().trim();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function formatLocation(job: JazzJob) {
  const parts = [job.location, job.city, job.state, job.country].filter(Boolean) as string[];
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return "Nao especificado";
}

function inferWorkplaceType(remote?: boolean, text?: string) {
  if (remote) return "REMOTE";
  return normalizeWorkplaceTypeText(text);
}

function inferEmploymentType(text?: string) {
  const normalized = (text || "").toLowerCase();
  if (normalized.includes("full time") || normalized.includes("full-time")) return "Full-time";
  if (normalized.includes("part time") || normalized.includes("part-time")) return "Part-time";
  if (normalized.includes("contract") || normalized.includes("temporary")) return "Contract";
  if (normalized.includes("intern")) return "Internship";
  return undefined;
}

function inferSeniority(text?: string) {
  const normalized = (text || "").toLowerCase();
  if (/\bintern\b|internship|trainee/.test(normalized)) return "Intern";
  if (/\bjunior\b|\bjr\b/.test(normalized)) return "Junior";
  if (/\bmid\b|\bmid-level\b/.test(normalized)) return "Mid";
  if (/\bsenior\b|\bsr\b/.test(normalized)) return "Senior";
  if (/\blead\b|\bprincipal\b|\bmanager\b|\bdirector\b/.test(normalized)) return "Lead";
  return undefined;
}

function extractRequirements(description: string) {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const markers = [
    /qualifications?/i,
    /requirements?/i,
    /what you bring/i,
    /what we need/i,
    /experience/i,
    /skills/i,
    /responsibilities/i,
  ];

  const sections = paragraphs.filter((paragraph) => markers.some((marker) => marker.test(paragraph)));
  if (sections.length > 0) return sections.join("\n\n");
  return undefined;
}

function extractSalary(description: string) {
  const currencyPatterns = [
    /\$[\s]*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?:\s*[-–]\s*\$?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)?\s*(?:per\s*(hour|year|month|week|day))?/i,
    /\bUSD\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?:\s*[-–]\s*USD\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)?/i,
    /\b(?:\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:to|[-–])\s*(?:\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)(?:\s*(?:per\s*(hour|year|month|week|day)|hourly|salary))?/i,
  ];

  for (const pattern of currencyPatterns) {
    const match = description.match(pattern);
    if (match?.[0]) {
      return {
        display: match[0].trim(),
        min: undefined,
        max: undefined,
        currency: undefined,
        interval: cleanString(match[1]),
      };
    }
  }

  return { display: undefined, min: undefined, max: undefined, currency: undefined, interval: undefined };
}

function extractDeadline(description: string) {
  const patterns = [
    /(?:deadline|application deadline|apply by|closing date|closing on|applications? close(?:s|d)?(?: on)?)[^0-9]{0,40}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(?:deadline|application deadline|apply by|closing date|closing on|applications? close(?:s|d)?(?: on)?)[^0-9]{0,40}([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(?:deadline|application deadline|apply by|closing date|closing on|applications? close(?:s|d)?(?: on)?)[^0-9]{0,40}(\d{1,2}(?:st|nd|rd|th)?\s+of\s+[A-Za-z]{3,9}(?:\s+\d{4})?)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match?.[1]) continue;

    const parsed = new Date(match[1].replace(/(\d{1,2})(st|nd|rd|th)/i, "$1"));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

function extractKeywords(text: string) {
  const candidates = [
    "operations",
    "office",
    "customer service",
    "dental",
    "clinical",
    "assistant",
    "manager",
    "supervisor",
    "billing",
    "administrative",
    "patient care",
    "support",
    "finance",
    "recruitment",
    "hr",
  ];

  const normalized = text.toLowerCase();
  return candidates.filter((keyword) => normalized.includes(keyword));
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeJazzText(value: string) {
  return decodeXmlEntities(
    value
      .replace(/^<!\[CDATA\[/i, "")
      .replace(/\]\]>$/i, "")
      .trim()
  ).trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
