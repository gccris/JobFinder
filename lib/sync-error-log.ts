import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "sync-errors.log");

export async function appendSyncErrorLog(entry: {
  scope: "company" | "job" | "sync";
  source?: string;
  company?: string;
  slug?: string;
  error: string;
  details?: unknown;
}) {
  const line = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(LOG_FILE, `${JSON.stringify(line)}\n`, "utf8");
}
