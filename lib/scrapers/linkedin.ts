const mapping = (title: string) => {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("backend")) return "BACKEND";
  if (lowerTitle.includes("frontend")) return "FRONTEND";
  if (
    lowerTitle.includes("full stack") ||
    lowerTitle.includes("fullstack")
  )
    return "FULLSTACK";
  if (lowerTitle.includes("devops") || lowerTitle.includes("sre"))
    return "DEVOPS";
  if (lowerTitle.includes("data") || lowerTitle.includes("ml") || lowerTitle.includes("ai"))
    return "DATASCIENCE";
  if (lowerTitle.includes("product")) return "PRODUCT";

  return "BACKEND"; // default
};

export async function scrapeLinkedIn() {
  try {
    // This is a placeholder. Real implementation would use:
    // - LinkedIn API (limited access)
    // - Web scraping with puppeteer/browserless
    // - A third-party job aggregator API

    // For now, returning empty array
    console.log("LinkedIn scraper - placeholder implementation");

    return [];
  } catch (error) {
    console.error("Error scraping LinkedIn:", error);
    return [];
  }
}

// Placeholder for future LinkedIn API integration
export async function getLinkedInJobsViaAPI() {
  const jobs = [];

  // Example: using Bright Data or similar proxied scraping service
  // const response = await axios.post('https://api.brightdata.com/...', {
  //   urls: ['linkedin.com/jobs/search/?keywords=software%20engineer'],
  // });

  return jobs;
}
