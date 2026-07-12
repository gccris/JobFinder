import { readFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join } from "path";

type RawCompanyItem = {
  link?: string;
  title?: string;
};

export type CompanySource =
  | "lever"
  | "greenhouse"
  | "ashby"
  | "teamtailor"
  | "workable"
  | "jazzhr"
  | "smartrecruiters";

export type Company = {
  id: string;
  name: string;
  slug: string;
  url: string;
  source: CompanySource;
};

async function readJsonCompaniesFile(fileName: string): Promise<RawCompanyItem[]> {
  const candidates = [
    join(process.cwd(), "jobs_list", fileName),
    join(process.cwd(), "job_list", fileName),
  ];

  for (const filePath of candidates) {
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        return parsed as RawCompanyItem[];
      }
    } catch {
      // Try next candidate path.
    }
  }

  return [];
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function extractLeverCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/jobs\.lever\.co\/([a-zA-Z0-9-]+)/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://jobs.lever.co/${slug}`,
  };
}

function extractGreenhouseCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/job-boards\.greenhouse\.io\/([a-zA-Z0-9-]+)/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://job-boards.greenhouse.io/${slug}`,
  };
}

function extractAshbyCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/jobs\.ashbyhq\.com\/([a-zA-Z0-9.-]+)/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase().replace(/\/+$/, "");
  return {
    slug,
    url: `https://jobs.ashbyhq.com/${slug}`,
  };
}

function extractTeamtailorCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/([a-zA-Z0-9-]+)\.teamtailor\.com/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://${slug}.teamtailor.com`,
  };
}

function extractWorkableCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/apply\.workable\.com\/([a-zA-Z0-9-]+)/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://apply.workable.com/${slug}`,
  };
}

function extractJazzhrCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/([a-zA-Z0-9-]+)\.jazz\.co/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://${slug}.jazz.co`,
  };
}

function extractSmartRecruitersCompany(link: string): { slug: string; url: string } | null {
  const match = link.match(/https?:\/\/careers\.smartrecruiters\.com\/([a-zA-Z0-9-]+)/i);
  if (!match || !match[1]) return null;

  const slug = match[1].toLowerCase();
  return {
    slug,
    url: `https://careers.smartrecruiters.com/${slug}`,
  };
}

function sourceFromFileName(fileName: string): CompanySource | null {
  const normalized = fileName.replace(/_companies\.json$/i, "").toLowerCase();

  if (normalized === "jazz") return "jazzhr";
  if (normalized === "smartrecruiters") return "smartrecruiters";
  if (normalized === "teamtailor") return "teamtailor";
  if (normalized === "workable") return "workable";
  if (normalized === "ashby") return "ashby";
  if (normalized === "lever") return "lever";
  if (normalized === "greenhouse") return "greenhouse";

  return null;
}

async function readAllCompanyFiles() {
  const baseDir = join(process.cwd(), "jobs_list");
  const entries = await readdir(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /_companies\.json$/i.test(entry.name))
    .map((entry) => entry.name);
}

export async function getRegisteredCompanies(): Promise<Company[]> {
  const dedup = new Map<string, Company>();

  const fileNames = await readAllCompanyFiles();

  for (const fileName of fileNames) {
    const source = sourceFromFileName(fileName);
    if (!source) continue;

    const items = await readJsonCompaniesFile(fileName);

    for (const item of items) {
      if (!item.link) continue;

      const extracted = extractCompanyBySource(source, item.link);
      if (!extracted) continue;

      const key = `${source}:${extracted.slug}`;
      if (dedup.has(key)) continue;

      dedup.set(key, {
        id: key,
        name: normalizeCompanyName(source, item.title, extracted.slug),
        slug: extracted.slug,
        url: extracted.url,
        source,
      });
    }
  }

  return Array.from(dedup.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );
}

function extractCompanyBySource(source: CompanySource, link: string) {
  switch (source) {
    case "lever":
      return extractLeverCompany(link);
    case "greenhouse":
      return extractGreenhouseCompany(link);
    case "ashby":
      return extractAshbyCompany(link);
    case "teamtailor":
      return extractTeamtailorCompany(link);
    case "workable":
      return extractWorkableCompany(link);
    case "jazzhr":
      return extractJazzhrCompany(link);
    case "smartrecruiters":
      return extractSmartRecruitersCompany(link);
  }
}

function normalizeCompanyName(source: CompanySource, title: string | undefined, slug: string) {
  const cleanTitle = title?.trim();
  if (cleanTitle) {
    if (source === "lever") return cleanTitle.replace(/\s*-\s*Lever\s*$/i, "").trim();
    if (source === "greenhouse") return cleanTitle.replace(/^Job Openings\s*-\s*/i, "").trim();
    if (source === "jazzhr") return cleanTitle.replace(/\s*-\s*JazzHR\s*$/i, "").trim();
    if (source === "smartrecruiters") return cleanTitle.replace(/\s*-\s*SmartRecruiters\s*$/i, "").trim();
    return cleanTitle;
  }

  return titleFromSlug(slug);
}
