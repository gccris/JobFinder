import { CompanySource } from "./companies";

export const SYNC_SOURCES: CompanySource[] = [
  "lever",
  "greenhouse",
  "ashby",
  "teamtailor",
  "workable",
  "jazzhr",
  "smartrecruiters",
];

export function normalizeSelectedSources(value: unknown): CompanySource[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(SYNC_SOURCES);
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase().trim())
    .filter((item): item is CompanySource => allowed.has(item))));
}
