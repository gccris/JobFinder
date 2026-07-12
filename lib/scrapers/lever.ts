import axios from "axios";
import { limitedAxiosGet } from "@/lib/sync-http";
import { categorizeJob } from "@/lib/job-classification";
import { buildJobSignals } from "@/lib/job-signals/persist";
import { cleanString, compactRawMetadata, formatSalaryRange, ParsedJob } from "./shared";

interface LeverCategory {
  text?: string;
}

type LeverCategoryValue = string | string[] | LeverCategory[] | undefined;

interface LeverPosting {
  id: string;
  text: string;
  description?: string;
  descriptionPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string;
  content?: {
    description?: string;
    descriptionHtml?: string;
    lists?: Array<{
      text?: string;
      content?: string;
    }>;
    closing?: string;
    closingHtml?: string;
  };
  categories?: {
    location?: LeverCategoryValue;
    allLocations?: LeverCategoryValue;
    commitment?: LeverCategoryValue;
    department?: LeverCategoryValue;
    team?: LeverCategoryValue;
    level?: LeverCategoryValue;
  };
  country?: string;
  createdAt: number;
  updatedAt: number;
  reqCode?: string | null;
  requisitionCodes?: string[];
  salaryDescription?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
  urls?: {
    list?: string;
    show?: string;
    apply?: string;
  };
}

interface LeverResponse {
  postings?: LeverPosting[];
  data?: LeverPosting[];
}

type LeverApiResponse = LeverPosting[] | LeverResponse;

export async function fetchLeverJobs(siteName: string): Promise<ParsedJob[]> {
  try {
    if (!siteName.trim()) {
      console.log("Site name Lever nao fornecido");
      return [];
    }

    const url = `https://api.lever.co/v0/postings/${siteName}?mode=json`;
    console.log(`Buscando vagas da Lever em: ${url}`);

    const response = await limitedAxiosGet<LeverApiResponse>(url, {
      headers: {
        Accept: "application/json",
      },
    });

    const postings = extractLeverPostings(response.data);
    console.log(`${postings.length} vagas encontradas na Lever`);

    return postings.map((posting) => {
      const location =
        getLeverCategoryValue(posting.categories?.location) ||
        getLeverCategoryValue(posting.categories?.allLocations) ||
        "Nao especificado";
      const employmentType =
        getLeverCategoryValue(posting.categories?.commitment) || "Full-time";
      const team = getLeverCategoryValue(posting.categories?.team);
      const department = getLeverCategoryValue(posting.categories?.department) || team;
      const seniority = getLeverCategoryValue(posting.categories?.level);
      const description =
        posting.descriptionPlain ||
        posting.content?.description ||
        stripHtml(posting.description || posting.content?.descriptionHtml || "");
      const requirements = formatLeverRequirements(posting.content?.lists);
      const postedAt = posting.createdAt
        ? new Date(posting.createdAt).toISOString()
        : new Date().toISOString();
      const externalUpdatedAt = posting.updatedAt
        ? new Date(posting.updatedAt).toISOString()
        : undefined;
      const workplaceType = normalizeWorkplaceType(posting.workplaceType);
      const workplaceTag = workplaceTypeToTag(workplaceType);
      const salary =
        formatSalaryRange(
          posting.salaryRange?.min,
          posting.salaryRange?.max,
          posting.salaryRange?.currency,
          posting.salaryRange?.interval
        ) || stripHtml(posting.salaryDescription || "");
      const applicationUrl = posting.urls?.apply || posting.applyUrl;
      const jobUrl = posting.urls?.show || posting.hostedUrl || posting.urls?.list;

      return {
        id: posting.id,
        title: posting.text,
        description,
        company: siteName.charAt(0).toUpperCase() + siteName.slice(1),
        location,
        salary: cleanString(salary),
        salaryMin: posting.salaryRange?.min,
        salaryMax: posting.salaryRange?.max,
        salaryCurrency: cleanString(posting.salaryRange?.currency),
        salaryInterval: cleanString(posting.salaryRange?.interval),
        source: "lever",
        externalId: posting.id,
        externalReference: cleanString(posting.reqCode || posting.requisitionCodes?.[0]),
        externalUpdatedAt,
        url: applicationUrl || jobUrl || `https://jobs.lever.co/${siteName}`,
        applicationUrl,
        jobUrl,
        category: categorizeJob(posting.text),
        employmentType: cleanString(employmentType),
        seniority: cleanString(seniority),
        department: cleanString(department),
        requirements,
        workplaceType,
        postedAt,
        tags: [workplaceTag, employmentType, department, team, seniority]
          .filter((tag): tag is string => Boolean(tag && tag !== "Geral")),
        rawMetadata: compactRawMetadata({
          country: posting.country,
          requisitionCodes: posting.requisitionCodes,
          closing: posting.content?.closing || stripHtml(posting.content?.closingHtml || ""),
        }),
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(`Empresa Lever nao encontrada: ${siteName}`);
    } else {
      console.error("Erro ao buscar vagas da Lever:", error);
    }
    throw error;
  }
}

function extractLeverPostings(response: LeverApiResponse): LeverPosting[] {
  if (Array.isArray(response)) return response;
  return response.postings || response.data || [];
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function normalizeWorkplaceType(value?: string): string {
  const normalized = value?.toLowerCase();

  if (normalized === "remote") return "REMOTE";
  if (normalized === "hybrid") return "HYBRID";
  if (normalized === "onsite") return "ONSITE";

  return "UNSPECIFIED";
}

function workplaceTypeToTag(workplaceType: string) {
  if (workplaceType === "REMOTE") return "Remote";
  if (workplaceType === "HYBRID") return "Hybrid";
  if (workplaceType === "ONSITE") return "Onsite";
  return "Nao informado";
}

function getLeverCategoryValue(value: LeverCategoryValue): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => {
        if (typeof item === "string") return item;
        return item.text;
      })
      .filter((item): item is string => Boolean(item?.trim()));

    return values.join(", ") || undefined;
  }

  return undefined;
}

function formatLeverRequirements(lists?: Array<{ text?: string; content?: string }>) {
  const sections = (lists || [])
    .map((item) => {
      const title = cleanString(item.text);
      const content = stripHtml(item.content || "");
      if (!title && !content) return null;
      return [title, content].filter(Boolean).join("\n");
    })
    .filter((item): item is string => Boolean(item));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export async function syncLeverJobs(
  dbClient: any,
  siteName: string
): Promise<number> {
  try {
    const leverJobs = await fetchLeverJobs(siteName);

    if (leverJobs.length === 0) {
      console.log("Nenhuma vaga Lever para sincronizar");
      return 0;
    }

    let created = 0;

    for (const job of leverJobs) {
      try {
        const existing = await dbClient.job.findFirst({
          where: {
            source: "lever",
            externalId: job.externalId,
          },
        });

        if (!existing) {
          const createdJob = await dbClient.job.create({
            data: {
              title: job.title,
              description: job.description,
              company: job.company,
              location: job.location,
              salary: job.salary,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              salaryCurrency: job.salaryCurrency,
              salaryInterval: job.salaryInterval,
              workplaceType: job.workplaceType as any,
              source: "lever",
              externalId: job.externalId,
              externalReference: job.externalReference,
              externalUpdatedAt: job.externalUpdatedAt ? new Date(job.externalUpdatedAt) : undefined,
              url: job.url,
              applicationUrl: job.applicationUrl,
              jobUrl: job.jobUrl,
              category: job.category,
              employmentType: job.employmentType,
              seniority: job.seniority,
              department: job.department,
              requirements: job.requirements,
              postedAt: new Date(job.postedAt),
              expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
              tags: job.tags,
              rawMetadata: job.rawMetadata,
            },
          });
          await dbClient.jobSignals.create({
            data: buildJobSignals({
              jobId: createdJob.id,
              title: job.title,
              description: job.description,
              tags: job.tags,
            }),
          });
          created++;
        }
      } catch (err) {
        console.error(`Erro ao inserir vaga Lever ${job.id}:`, err);
      }
    }

    console.log(`${created} vagas Lever sincronizadas com sucesso`);
    return created;
  } catch (error) {
    console.error("Erro na sincronizacao Lever:", error);
    return 0;
  }
}
