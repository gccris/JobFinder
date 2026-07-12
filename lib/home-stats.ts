import { db } from "./db";
import { SYNC_SOURCES } from "./sync-sources";

export const SOURCE_LABELS: Record<(typeof SYNC_SOURCES)[number], string> = {
  lever: "Lever",
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  teamtailor: "Teamtailor",
  workable: "Workable",
  jazzhr: "JazzHR",
  smartrecruiters: "SmartRecruiters",
};

export async function getHomeStats() {
  const counts = await db.job.groupBy({
    by: ["source"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });

  const countBySource = new Map(counts.map((row) => [row.source, row._count._all]));
  const sources = SYNC_SOURCES.map((source) => ({
    source,
    label: SOURCE_LABELS[source],
    openJobs: countBySource.get(source) ?? 0,
  }));

  return {
    sources,
    totalOpenJobs: sources.reduce((total, source) => total + source.openJobs, 0),
    activeSources: sources.filter((source) => source.openJobs > 0).length,
  };
}
