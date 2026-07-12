import { positiveInteger, Semaphore } from "./concurrency";

export const SOURCE_CONCURRENCY = positiveInteger(process.env.SYNC_SOURCE_CONCURRENCY, 7);
export const COMPANY_CONCURRENCY = positiveInteger(process.env.SYNC_COMPANY_CONCURRENCY, 2);
export const HTTP_CONCURRENCY = positiveInteger(process.env.SYNC_HTTP_CONCURRENCY, 20);
export const DB_WRITE_CONCURRENCY = positiveInteger(process.env.SYNC_DB_WRITE_CONCURRENCY, 4);
export const HTTP_TIMEOUT_MS = positiveInteger(process.env.SYNC_HTTP_TIMEOUT_MS, 20_000);
export const HTTP_RETRIES = positiveInteger(process.env.SYNC_HTTP_RETRIES, 2);

export const httpSemaphore = new Semaphore(HTTP_CONCURRENCY);
export const dbWriteSemaphore = new Semaphore(DB_WRITE_CONCURRENCY);
