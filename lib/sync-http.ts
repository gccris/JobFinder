import axios, { AxiosRequestConfig } from "axios";
import { HTTP_RETRIES, HTTP_TIMEOUT_MS, httpSemaphore } from "./sync-config";

export async function limitedAxiosGet<T>(url: string, config: AxiosRequestConfig = {}) {
  return retry(async () => httpSemaphore.run(() => axios.get<T>(url, {
    ...config,
    timeout: HTTP_TIMEOUT_MS,
  })));
}

export async function limitedFetch(input: string | URL, init: RequestInit = {}) {
  return retry(async () => httpSemaphore.run(async () => {
    const response = await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (response.status === 429 || response.status >= 500) {
      const error = new Error(`HTTP ${response.status}`) as Error & { status?: number; retryAfter?: string | null };
      error.status = response.status;
      error.retryAfter = response.headers.get("retry-after");
      await response.body?.cancel();
      throw error;
    }
    return response;
  }));
}

async function retry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === HTTP_RETRIES || !isRetryable(error)) throw error;
      await delay(retryDelay(error, attempt));
    }
  }
  throw lastError;
}

function isRetryable(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return !status || status === 429 || status >= 500;
  }
  const status = (error as { status?: number })?.status;
  return !status || status === 429 || status >= 500;
}

function retryDelay(error: unknown, attempt: number) {
  const retryAfter = axios.isAxiosError(error)
    ? error.response?.headers?.["retry-after"]
    : (error as { retryAfter?: string | null })?.retryAfter;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
