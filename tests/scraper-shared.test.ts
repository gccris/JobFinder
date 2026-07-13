import { beforeEach, describe, expect, it, vi } from "vitest";

const { limitedAxiosGet } = vi.hoisted(() => ({ limitedAxiosGet: vi.fn() }));
vi.mock("../lib/sync-http", () => ({ limitedAxiosGet }));

import {
  cleanString,
  compactRawMetadata,
  decodeHtmlEntities,
  fetchJsonCandidates,
  formatMoney,
  formatSalaryRange,
  normalizeWorkplaceTypeText,
  stripHtml,
  uniqueTags,
  workplaceTypeTag,
} from "../lib/scrapers/shared";

describe("shared scraper utilities", () => {
  beforeEach(() => limitedAxiosGet.mockReset());

  it("tries candidate endpoints in order and returns the first success", async () => {
    limitedAxiosGet.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { jobs: [1] } });
    await expect(fetchJsonCandidates(["first", "second"])).resolves.toEqual({ jobs: [1] });
    expect(limitedAxiosGet).toHaveBeenNthCalledWith(2, "second", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("throws the last candidate error and rejects an empty list", async () => {
    const last = new Error("last");
    limitedAxiosGet.mockRejectedValueOnce(new Error("first")).mockRejectedValueOnce(last);
    await expect(fetchJsonCandidates(["first", "second"])).rejects.toBe(last);
    await expect(fetchJsonCandidates([])).rejects.toThrow("Nenhum endpoint candidato");
  });

  it("strips HTML and decodes named, decimal and hexadecimal entities", () => {
    expect(stripHtml(" <p>A&nbsp;&amp; B &#67; &#x44;</p> ")).toBe("A & B C D");
    expect(decodeHtmlEntities("&lt;x&gt;&quot;y&quot;&#39;&amp;")).toBe("<x>\"y\"'&");
  });

  it.each([
    ["Remote - Brazil", "REMOTE"],
    ["hybrid schedule", "HYBRID"],
    ["on-site", "ONSITE"],
    [undefined, "UNSPECIFIED"],
  ])("normalizes workplace %s", (input, expected) => {
    expect(normalizeWorkplaceTypeText(input)).toBe(expected);
  });

  it("formats workplace labels, unique tags and optional strings", () => {
    expect(workplaceTypeTag("REMOTE")).toBe("Remote");
    expect(workplaceTypeTag("HYBRID")).toBe("Hybrid");
    expect(workplaceTypeTag("ONSITE")).toBe("Onsite");
    expect(workplaceTypeTag("UNSPECIFIED")).toBeTruthy();
    expect(uniqueTags(["React", "React", "", null, "Docker"])).toEqual(["React", "Docker"]);
    expect(cleanString("  value ")).toBe("value");
    expect(cleanString(42)).toBe("42");
    expect(cleanString(" ")).toBeUndefined();
    expect(cleanString(null)).toBeUndefined();
  });

  it("removes empty raw metadata but keeps false and zero", () => {
    expect(compactRawMetadata({ empty: " ", nil: null, list: [], object: {}, zero: 0, flag: false, text: "x" }))
      .toEqual({ zero: 0, flag: false, text: "x" });
  });

  it("formats complete, partial and invalid salary ranges", () => {
    expect(formatSalaryRange(1000, 2000, "USD", "year", "Base")).toBe("Base: $1,000 - $2,000 / year");
    expect(formatSalaryRange(null, 10.5, undefined)).toBe("10.5");
    expect(formatSalaryRange()).toBeUndefined();
    expect(formatMoney(10, "INVALID")).toBe("INVALID 10");
    expect(formatMoney(null, "USD")).toBeUndefined();
  });
});
