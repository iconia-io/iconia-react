import type { IconiaConfig } from './config';

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
  type: 'branded' | 'private' | 'public';
};

function authHeaders(config: IconiaConfig) {
  return { Authorization: `ApiKey ${config.apiKey}`, 'Content-Type': 'application/json' };
}

async function fetchWithRetry(fn: () => Promise<Response>, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fn();
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
    process.stderr.write(`\n⏳ Rate limited — waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}...\n`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
  }
  return fn();
}

export async function apiGetCollections(config: IconiaConfig): Promise<RemoteCollection[]> {
  const res = await fetchWithRetry(() =>
    fetch(new URL('/v1/collections', config.apiUrl).toString(), {
      headers: authHeaders(config),
    }),
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(`API error ${res.status}: ${body.error ?? res.statusText}`);
  }
  const data = await res.json() as { collections: RemoteCollection[] };
  return data.collections;
}

export async function apiGetIcons(config: IconiaConfig, slugs: string[]): Promise<RemoteIcon[]> {
  const url = new URL('/v1/collections/icons', config.apiUrl);
  url.searchParams.set('collections', slugs.join(','));
  const res = await fetchWithRetry(() => fetch(url.toString(), { headers: authHeaders(config) }));
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(`API error ${res.status}: ${body.error ?? res.statusText}`);
  }
  const data = await res.json() as { icons: RemoteIcon[] };
  return data.icons;
}

export async function apiUploadIcon(
  config: IconiaConfig,
  payload: { collectionSlug: string; name: string; slug: string; svgContent: string; tags?: string[] },
): Promise<RemoteIcon> {
  const res = await fetchWithRetry(() =>
    fetch(new URL('/v1/icons', config.apiUrl).toString(), {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify(payload),
    }),
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  const data = await res.json() as { icon: RemoteIcon };
  return data.icon;
}
