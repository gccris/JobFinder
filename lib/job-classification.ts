export type JobCategoryValue =
  | "BACKEND"
  | "FRONTEND"
  | "MOBILE"
  | "FULLSTACK"
  | "DEVOPS"
  | "SITE_RELIABILITY_ENGINEER"
  | "PLATFORM_ENGINEER"
  | "DATASCIENCE"
  | "PRODUCT"
  | "QA"
  | "SECURITY"
  | "SUPPORT"
  | "INFRA"
  | "IT"
  | "GENERAL";

const categoryPatterns: Array<{ category: JobCategoryValue; patterns: RegExp[] }> = [
  {
    category: "SITE_RELIABILITY_ENGINEER",
    patterns: [/\bsre\b/i, /site reliability engineer/i],
  },
  {
    category: "PLATFORM_ENGINEER",
    patterns: [/platform engineer/i, /\bplatform\b/i],
  },
  {
    category: "DEVOPS",
    patterns: [/\bdevops\b/i, /\bdev ops\b/i, /\bcloud engineer\b/i, /\binfra\b/i],
  },
  {
    category: "INFRA",
    patterns: [/infrastructure/i, /\binfra\b/i, /platform infrastructure/i],
  },
  {
    category: "BACKEND",
    patterns: [/\bbackend\b/i, /\bapi\b/i, /\bserver\b/i, /\bnode\.?js\b/i, /\bgolang\b/i],
  },
  {
    category: "FRONTEND",
    patterns: [/\bfrontend\b/i, /\bfront-end\b/i, /\breact\b/i, /\bvue\b/i, /\bangular\b/i],
  },
  {
    category: "MOBILE",
    patterns: [/\bmobile\b/i, /\bandroid\b/i, /\bios\b/i, /\bflutter\b/i, /\breact native\b/i],
  },
  {
    category: "DATASCIENCE",
    patterns: [/\bdata science\b/i, /\bdata scientist\b/i, /\bml\b/i, /machine learning/i, /\bdata\b/i, /\banalytics\b/i, /\bai\b/i],
  },
  {
    category: "PRODUCT",
    patterns: [/\bproduct\b/i, /\bpm\b/i, /\bux\b/i, /\bdesigner\b/i],
  },
  {
    category: "QA",
    patterns: [/\bqa\b/i, /\bquality assurance\b/i, /\btest(er|ing)?\b/i],
  },
  {
    category: "SECURITY",
    patterns: [/\bsecurity\b/i, /\binfosec\b/i, /\bcyber\b/i],
  },
  {
    category: "SUPPORT",
    patterns: [/\bsupport\b/i, /\bhelp desk\b/i, /\bcustomer success\b/i, /\btechnical support\b/i],
  },
  {
    category: "IT",
    patterns: [/\b(it|ti)\b/i, /information technology/i, /it & development/i, /\bit\/tech\b/i],
  },
  {
    category: "FULLSTACK",
    patterns: [/\bfullstack\b/i, /full stack/i, /\bfull-stack\b/i],
  },
];

export function categorizeJob(text: string): JobCategoryValue {
  const normalized = text || "";

  for (const entry of categoryPatterns) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.category;
    }
  }

  return "GENERAL";
}

export function formatCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    BACKEND: "Backend",
    FRONTEND: "Frontend",
    MOBILE: "Mobile",
    FULLSTACK: "Fullstack",
    DEVOPS: "DevOps",
    SITE_RELIABILITY_ENGINEER: "Site Reliability Engineer",
    PLATFORM_ENGINEER: "Platform Engineer",
    DATASCIENCE: "Data Science",
    PRODUCT: "Product",
    QA: "QA",
    SECURITY: "Security",
    SUPPORT: "Support",
    INFRA: "Infra",
    IT: "TI",
    GENERAL: "Geral",
  };

  return labels[category] || category;
}
