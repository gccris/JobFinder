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

type TeamtailorFeed = {
  items: TeamtailorFeedItem[];
};

type TeamtailorFeedItem = {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate?: string;
  remoteStatus?: string;
  locations: TeamtailorLocation[];
  department?: string;
  role?: string;
};

type TeamtailorLocation = {
  name?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
};

export async function fetchTeamtailorJobs(boardSlug: string, companyName: string): Promise<ParsedJob[]> {
  const feedUrl = `https://${boardSlug}.teamtailor.com/jobs.rss`;
  const response = await limitedFetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter feed Teamtailor (${response.status} ${response.statusText})`);
  }

  const xml = await response.text();
  const jobs = parseTeamtailorFeed(xml).items;

  return jobs.map((item) => {
    const location = formatLocation(item.locations);
    const department = cleanString(item.department);
    const role = cleanString(item.role);
    const workplaceType = normalizeWorkplaceTypeText(item.remoteStatus || location || role);
    const externalId = cleanString(item.guid) || cleanString(item.link) || `${boardSlug}-${item.title}`;
    const postedAt = parseDate(item.pubDate) || new Date().toISOString();
    const description = stripHtml(decodeXmlEntities(item.description || ""));
    const semanticText = [item.title || "", department || "", role || "", description].join(" ");
    const category = categorizeJob(semanticText);
    const requirements = extractRequirements(description);
    const seniority = inferSeniority(semanticText);
    const employmentType = inferEmploymentType(item.remoteStatus, semanticText);
    const salary = extractSalary(description);
    const expiresAt = extractDeadline(description);
    const tags = uniqueTags([
      workplaceTypeTag(workplaceType),
      department,
      role,
      seniority,
      ...extractKeywords(semanticText),
    ]);

    return {
      id: externalId,
      title: item.title || "Sem titulo",
      description,
      company: companyName,
      location,
      salary: salary.display,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryInterval: salary.interval,
      source: "teamtailor",
      externalId,
      externalUpdatedAt: postedAt,
      externalReference: cleanString(item.guid),
      url: item.link,
      applicationUrl: item.link,
      jobUrl: item.link,
      category,
      employmentType,
      seniority,
      department,
      requirements,
      workplaceType,
      postedAt,
      expiresAt,
      tags,
      rawMetadata: compactRawMetadata({
        remoteStatus: item.remoteStatus,
        locations: item.locations,
        role: item.role,
        title: item.title,
        keywords: extractKeywords(semanticText),
      }),
    };
  });
}

function parseTeamtailorFeed(xml: string): TeamtailorFeed {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) =>
    parseTeamtailorItem(match[1] || "")
  );

  return { items };
}

function parseTeamtailorItem(xml: string): TeamtailorFeedItem {
  const description = getTagValue(xml, "description");
  const locations = [...xml.matchAll(/<tt:location\b[^>]*>([\s\S]*?)<\/tt:location>/gi)].map((match) =>
    parseTeamtailorLocation(match[1] || "")
  );

  return {
    title: decodeXmlEntities(getTagValue(xml, "title")),
    description: decodeXmlEntities(description),
    link: decodeXmlEntities(getTagValue(xml, "link")),
    guid: decodeXmlEntities(getTagValue(xml, "guid")),
    pubDate: cleanString(getTagValue(xml, "pubDate")) || undefined,
    remoteStatus: cleanString(getTagValue(xml, "remoteStatus")) || undefined,
    locations,
    department: cleanString(getTagValue(xml, "tt:department")) || undefined,
    role: cleanString(getTagValue(xml, "tt:role")) || undefined,
  };
}

function parseTeamtailorLocation(xml: string): TeamtailorLocation {
  return {
    name: cleanString(getTagValue(xml, "tt:name")) || undefined,
    address: cleanString(getTagValue(xml, "tt:address")) || undefined,
    zip: cleanString(getTagValue(xml, "tt:zip")) || undefined,
    city: cleanString(getTagValue(xml, "tt:city")) || undefined,
    country: cleanString(getTagValue(xml, "tt:country")) || undefined,
  };
}

function getTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "i"));
  return match?.[1]?.trim() || "";
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function formatLocation(locations: TeamtailorLocation[]) {
  const first = locations[0];
  const pieces = [first?.name, first?.city, first?.country].filter(Boolean) as string[];
  if (pieces.length > 0) {
    return pieces.join(", ");
  }
  return "Nao especificado";
}

function extractRequirements(description: string) {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const requirementMarkers = [
    /what you bring/i,
    /requirements?/i,
    /qualifications?/i,
    /you bring/i,
    /what you need/i,
    /what we expect/i,
    /desired/i,
    /must have/i,
  ];

  const matchedSections = paragraphs.filter((paragraph) =>
    requirementMarkers.some((marker) => marker.test(paragraph))
  );

  if (matchedSections.length > 0) {
    return matchedSections.join("\n\n");
  }

  return undefined;
}

function inferSeniority(text: string) {
  const normalized = text.toLowerCase();
  if (/\bintern\b|internship|trainee/.test(normalized)) return "Intern";
  if (/\bjunior\b|\bjr\b/.test(normalized)) return "Junior";
  if (/\bmid\b|\bmid-level\b|\bpleno\b/.test(normalized)) return "Mid";
  if (/\bsenior\b|\bsr\b/.test(normalized)) return "Senior";
  if (/\blead\b|\bprincipal\b|\bhead of\b|\bdirector\b/.test(normalized)) return "Lead";
  if (/\bmanager\b|\bmanagerial\b/.test(normalized)) return "Manager";
  return undefined;
}

function inferEmploymentType(remoteStatus?: string, text?: string) {
  const normalized = `${remoteStatus || ""} ${text || ""}`.toLowerCase();
  if (normalized.includes("full time") || normalized.includes("full-time")) return "Full-time";
  if (normalized.includes("part time") || normalized.includes("part-time")) return "Part-time";
  if (normalized.includes("contract") || normalized.includes("temporary")) return "Contract";
  if (normalized.includes("intern")) return "Internship";
  return cleanString(remoteStatus);
}

function extractKeywords(text: string) {
  const candidates = [
    "data",
    "analytics",
    "engineering",
    "engineering manager",
    "product",
    "operations",
    "marketing",
    "finance",
    "sales",
    "people",
    "people operations",
    "culture",
    "leadership",
    "software",
    "devops",
    "security",
    "support",
    "design",
    "hr",
    "recruitment",
    "strategy",
  ];

  const lower = text.toLowerCase();
  return candidates.filter((keyword) => lower.includes(keyword));
}

function extractSalary(description: string) {
  const patterns = [
    /\$[\s]*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?:\s*[-–]\s*\$?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)?\s*(?:per\s*(hour|year|month|week|day))?/i,
    /\bUSD\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?:\s*[-–]\s*USD\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)?/i,
    /\b(?:\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:to|[-–])\s*(?:\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)(?:\s*(?:per\s*(hour|year|month|week|day)|hourly|salary))?/i,
  ];

  for (const pattern of patterns) {
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

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
