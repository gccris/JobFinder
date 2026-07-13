import { describe, expect, it } from "vitest";

import { extractJobSignals, getJobSignalFingerprint } from "../lib/job-signals/extractor";
import { buildJobSignals, buildJobSignalsUpdate, signalsToTags } from "../lib/job-signals/persist";

describe("job signals", () => {
  it("normalizes accents and separators and groups matched aliases", () => {
    const signals = extractJobSignals("TypeScript, React.js e Docker_Compose em produção");

    expect(signals.languages).toContain("TypeScript");
    expect(signals.frameworks).toContain("React");
    expect(signals.tools).toContain("Docker");
    expect(signals.keywords).toEqual([...signals.keywords].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("honors boundaries for short and punctuation-heavy technologies", () => {
    const signals = extractJobSignals("C++ and ASP.NET Core, not a reactivate task");

    expect(signals.languages).toContain("C++");
    expect(signals.frameworks).toEqual(expect.arrayContaining(["ASP.NET", "ASP.NET Core"]));
    expect(signals.frameworks).not.toContain("React");
  });

  it("deduplicates aliases and returns empty groups for empty input", () => {
    expect(extractJobSignals("typescript TS TypeScript").languages).toEqual(["TypeScript"]);
    expect(extractJobSignals(undefined)).toMatchObject({
      keywords: [], tools: [], languages: [], frameworks: [], concepts: [],
    });
    expect(extractJobSignals("c r").languages).not.toContain("C");
  });

  it("creates stable fingerprints from equivalent normalized text", () => {
    expect(getJobSignalFingerprint("  AUTOMAÇÃO_de   dados ")).toEqual(
      getJobSignalFingerprint("automacao de dados")
    );
    expect(getJobSignalFingerprint("React").normalizedTextHash).not.toBe(
      getJobSignalFingerprint("Vue").normalizedTextHash
    );
    expect(getJobSignalFingerprint(null)).toEqual(getJobSignalFingerprint(undefined));
  });

  it("builds Prisma create and update payloads from all job text", () => {
    const create = buildJobSignals({
      jobId: "job-1",
      title: "TypeScript developer",
      description: "React application",
      tags: ["Docker"],
    });
    const update = buildJobSignalsUpdate({
      title: "TypeScript developer",
      description: "React application",
      tags: ["Docker"],
    });

    expect(create.job).toEqual({ connect: { id: "job-1" } });
    expect(create).toMatchObject({ languages: ["TypeScript"], frameworks: ["React"], tools: ["Docker"] });
    expect(create.analyzedAt).toBeInstanceOf(Date);
    expect(update).toMatchObject({
      languages: create.languages,
      frameworks: create.frameworks,
      normalizedTextHash: create.normalizedTextHash,
    });

    expect(buildJobSignals({ jobId: "job-2", title: "Go", description: "" }).languages).toContain("Go");
    expect(buildJobSignalsUpdate({ title: "Go", description: "" }).languages).toContain("Go");
  });

  it("flattens signal groups into unique tags", () => {
    const signals = extractJobSignals("TypeScript React Docker");
    expect(signalsToTags(signals)).toEqual(expect.arrayContaining(["TypeScript", "React", "Docker"]));
    expect(new Set(signalsToTags(signals)).size).toBe(signalsToTags(signals).length);
    expect(signalsToTags(null)).toEqual([]);
  });
});
