import { describe, expect, it } from "vitest";

import { categorizeJob, formatCategoryLabel } from "../lib/job-classification";

describe("job classification", () => {
  it.each([
    ["Site Reliability Engineer", "SITE_RELIABILITY_ENGINEER"],
    ["Platform Engineer", "PLATFORM_ENGINEER"],
    ["Cloud Engineer", "DEVOPS"],
    ["Infrastructure specialist", "INFRA"],
    ["Node.js API engineer", "BACKEND"],
    ["React front-end engineer", "FRONTEND"],
    ["Android mobile developer", "MOBILE"],
    ["Machine Learning scientist", "DATASCIENCE"],
    ["Product Designer", "PRODUCT"],
    ["Quality Assurance tester", "QA"],
    ["Cyber Security analyst", "SECURITY"],
    ["Technical Support", "SUPPORT"],
    ["Information Technology specialist", "IT"],
    ["Full-stack developer", "FULLSTACK"],
  ])("classifies %s", (title, category) => {
    expect(categorizeJob(title)).toBe(category);
  });

  it("uses declared precedence when multiple categories match", () => {
    expect(categorizeJob("SRE platform backend engineer")).toBe("SITE_RELIABILITY_ENGINEER");
    expect(categorizeJob("Platform infrastructure engineer")).toBe("PLATFORM_ENGINEER");
  });

  it("does not match fragments and falls back to GENERAL", () => {
    expect(categorizeJob("Reactivate a serverless process")).toBe("GENERAL");
    expect(categorizeJob("")).toBe("GENERAL");
  });

  it("formats known labels and preserves unknown values", () => {
    expect(formatCategoryLabel("SITE_RELIABILITY_ENGINEER")).toBe("Site Reliability Engineer");
    expect(formatCategoryLabel("IT")).toBe("TI");
    expect(formatCategoryLabel("CUSTOM")).toBe("CUSTOM");
  });
});
