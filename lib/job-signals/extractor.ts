import crypto from "crypto";
import { analyzerVersion, keywordDictionary, KeywordEntry, SignalCategory } from "./dictionary";

export type JobSignals = {
  keywords: string[];
  tools: string[];
  languages: string[];
  frameworks: string[];
  concepts: string[];
  normalizedTextHash: string;
  analyzerVersion: string;
};

const stopwords = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "to",
  "of",
  "for",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "para",
  "com",
]);

export function extractJobSignals(input: string | null | undefined): JobSignals {
  const normalizedText = normalizeText(input || "");
  const matched = new Map<SignalCategory, Set<string>>([
    ["tools", new Set<string>()],
    ["languages", new Set<string>()],
    ["frameworks", new Set<string>()],
    ["concepts", new Set<string>()],
  ]);
  const keywords = new Set<string>();

  const ordered = [...keywordDictionary].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const entry of ordered) {
    if (matchesEntry(normalizedText, entry)) {
      matched.get(entry.category)?.add(entry.label);
      keywords.add(entry.label);
    }
  }

  return {
    keywords: sortValues(Array.from(keywords)),
    tools: sortValues(Array.from(matched.get("tools") || [])),
    languages: sortValues(Array.from(matched.get("languages") || [])),
    frameworks: sortValues(Array.from(matched.get("frameworks") || [])),
    concepts: sortValues(Array.from(matched.get("concepts") || [])),
    normalizedTextHash: crypto.createHash("sha1").update(normalizedText).digest("hex"),
    analyzerVersion,
  };
}

export function getJobSignalFingerprint(input: string | null | undefined) {
  const normalizedText = normalizeText(input || "");
  return {
    normalizedTextHash: crypto.createHash("sha1").update(normalizedText).digest("hex"),
    analyzerVersion,
  };
}

function matchesEntry(normalizedText: string, entry: KeywordEntry) {
  return entry.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias || stopwords.has(normalizedAlias)) return false;
    if (normalizedAlias.length < 2) return false;
    const escaped = escapeRegExp(normalizedAlias);
    const boundaryPattern = new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i");
    return boundaryPattern.test(normalizedText);
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "en"));
}
