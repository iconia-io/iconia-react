import type { IconiaConfig } from "./config";
import { ac } from "./abort";

export type RemoteIcon = {
  id: string;
  name: string;
  slug: string;
  svgContent: string;
  fingerprint: string;
  collectionSlug: string;
  collectionId: string;
  tags: string[];
};

export type RemoteCollection = {
  id: string;
  slug: string;
  name: string;
  type: "branded" | "private" | "public";
};

function authHeaders(config: IconiaConfig) {
  return {
    Authorization: `ApiKey ${config.apiKey}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithRetry(
  fn: (signal: AbortSignal) => Promise<Response>,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fn(ac.signal);
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    process.stderr.write(
      `\n⏳ Rate limited — waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}...\n`,
    );
    await new Promise<void>((resolve) => {
      const onSignal = () => {
        clearTimeout(timer);
        process.exit(130);
      };
      const timer = setTimeout(() => {
        process.removeListener("SIGINT", onSignal);
        resolve();
      }, retryAfter * 1000);
      process.once("SIGINT", onSignal);
      ac.signal.addEventListener("abort", onSignal, { once: true });
    });
  }
  return fn(ac.signal);
}

export async function apiGetCollections(
  config: IconiaConfig,
): Promise<RemoteCollection[]> {
  const res = await fetchWithRetry((signal) =>
    fetch(new URL("/v1/collections", config.apiUrl).toString(), {
      headers: authHeaders(config),
      signal,
    }),
  );
  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = (await res.json()) as { error?: string };
    } catch {}
    throw new Error(`API error ${res.status}: ${body.error ?? res.statusText}`);
  }
  const data = (await res.json()) as { collections: RemoteCollection[] };
  return data.collections;
}

export async function apiGetIcons(
  config: IconiaConfig,
  slugs: string[],
): Promise<RemoteIcon[]> {
  const url = new URL("/v1/collections/icons", config.apiUrl);
  url.searchParams.set("collections", slugs.join(","));
  const res = await fetchWithRetry((signal) =>
    fetch(url.toString(), { headers: authHeaders(config), signal }),
  );
  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = (await res.json()) as { error?: string };
    } catch {}
    throw new Error(`API error ${res.status}: ${body.error ?? res.statusText}`);
  }
  const data = (await res.json()) as { icons: RemoteIcon[] };
  return data.icons;
}

export type BatchIconInput = {
  name: string;
  slug: string;
  svgContent: string;
  tags?: string[];
};

export type BatchResult = {
  slug: string;
  status: "uploaded" | "duplicate" | "error";
  error?: string;
};

export async function apiUploadBatch(
  config: IconiaConfig,
  collectionSlug: string,
  items: BatchIconInput[],
): Promise<BatchResult[]> {
  const res = await fetchWithRetry((signal) =>
    fetch(new URL("/v1/icons", config.apiUrl).toString(), {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify({ collectionSlug, icons: items }),
      signal,
    }),
  );
  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = (await res.json()) as { error?: string };
    } catch {}
    throw new Error(`API error ${res.status}: ${body.error ?? res.statusText}`);
  }
  const data = (await res.json()) as { results: BatchResult[] };
  return data.results;
}
