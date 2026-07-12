import { scrapeIndeed } from "./scrapers/indeed";
import { scrapeLinkedIn } from "./scrapers/linkedin";
import { db } from "./db";
import { buildJobSignals, buildJobSignalsUpdate } from "./job-signals/persist";

export async function syncAllJobs() {
  try {
    console.log("Starting job sync...");

    const jobs: any[] = [];

    // Scrape Indeed
    try {
      console.log("Scraping Indeed...");
      const indeedJobs = await scrapeIndeed();
      jobs.push(...indeedJobs);
      console.log(`Found ${indeedJobs.length} jobs from Indeed`);
    } catch (error) {
      console.error("Error scraping Indeed:", error);
    }

    // Scrape LinkedIn
    try {
      console.log("Scraping LinkedIn...");
      const linkedInJobs = await scrapeLinkedIn();
      jobs.push(...linkedInJobs);
      console.log(`Found ${linkedInJobs.length} jobs from LinkedIn`);
    } catch (error) {
      console.error("Error scraping LinkedIn:", error);
    }

    // Insert or update jobs in database
    let created = 0;
    let updated = 0;

    for (const job of jobs) {
      try {
        const existing = await db.job.findUnique({
          where: {
            source_externalId: {
              source: job.source,
              externalId: job.externalId,
            },
          },
        });

        if (existing) {
          await db.job.update({
            where: { id: existing.id },
            data: {
              updatedAt: new Date(),
            },
          });
          await db.jobSignals.upsert({
            where: { jobId: existing.id },
            update: buildJobSignalsUpdate({
              title: job.title,
              description: job.description,
              tags: job.tags ?? [],
            }),
            create: buildJobSignals({
              jobId: existing.id,
              title: job.title,
              description: job.description,
              tags: job.tags ?? [],
            }),
          });
          updated++;
        } else {
          const createdJob = await db.job.create({
            data: job,
          });
          await db.jobSignals.create({
            data: buildJobSignals({
              jobId: createdJob.id,
              title: job.title,
              description: job.description,
              tags: job.tags ?? [],
            }),
          });
          created++;
        }
      } catch (error) {
        console.error("Error inserting/updating job:", error, job);
      }
    }

    console.log(
      `Sync completed: ${created} created, ${updated} updated`
    );

    return { created, updated };
  } catch (error) {
    console.error("Error in syncAllJobs:", error);
    throw error;
  }
}
