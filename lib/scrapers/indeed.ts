import axios from "axios";

const mapping = (category: string) => {
  const lowerCategory = category.toLowerCase();

  if (lowerCategory.includes("backend")) return "BACKEND";
  if (lowerCategory.includes("frontend")) return "FRONTEND";
  if (lowerCategory.includes("full stack") || lowerCategory.includes("fullstack")) return "FULLSTACK";
  if (lowerCategory.includes("devops") || lowerCategory.includes("sre")) return "DEVOPS";
  if (lowerCategory.includes("data") || lowerCategory.includes("ml")) return "DATASCIENCE";
  if (lowerCategory.includes("product")) return "PRODUCT";

  return "BACKEND"; // default
};

export async function scrapeIndeed() {
  try {
    // This is a placeholder. Real implementation would use:
    // - Indeed API (if available)
    // - Web scraping with puppeteer/cheerio
    // - A third-party job aggregator API

    // For now, returning empty array
    console.log("Indeed scraper - placeholder implementation");

    return [];
  } catch (error) {
    console.error("Error scraping Indeed:", error);
    return [];
  }
}

export async function getIndeedJobsViaAPI() {
  // Real implementation would use Indeed's Resumes API or similar
  // This is a reference for future implementation

  const jobs = [];

  // Example API call structure:
  // const response = await axios.get('https://api.indeed.com/...', {
  //   params: {
  //     q: 'software engineer site:br',
  //     country: 'BR',
  //     limit: 100
  //   },
  //   headers: {
  //     'Authorization': `Bearer ${process.env.INDEED_API_KEY}`
  //   }
  // });

  return jobs;
}
