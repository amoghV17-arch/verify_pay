/**
 * SSRF-guarded HTTP fetcher for the Reviewer agent.
 * Blocks private, loopback, link-local, and metadata IP ranges.
 * Enforces: http(s) only, max 3 redirects, 200 KB body cap, 10 s timeout.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

export interface FetchResult {
  ok: boolean;
  text?: string;
  error?: string;
  statusCode?: number;
}

/** IPs/CIDRs that are off-limits for SSRF reasons. */
const BLOCKED_RANGES = [
  // Loopback
  /^127\./,
  /^::1$/,
  // Link-local / metadata
  /^169\.254\./,
  /^fe80:/i,
  // Private class A
  /^10\./,
  // Private class B
  /^172\.(1[6-9]|2\d|3[01])\./,
  // Private class C
  /^192\.168\./,
  // Unspecified
  /^0\./,
  /^::$/,
  /^0\.0\.0\.0$/,
  // AWS/GCP metadata
  /^169\.254\.169\.254$/,
  /^100\.100\.100\.200$/,
  // IPv6 ULA (fc00::/7)
  /^f[cd][0-9a-f]{2}:/i,
  // Multicast
  /^22[4-9]\.|^2[3-5]\d\./,
  /^ff[0-9a-f]{2}:/i,
];

export function isBlockedIp(ip: string): boolean {
  const normalised = ip.toLowerCase().trim();
  return BLOCKED_RANGES.some((re) => re.test(normalised));
}

export type DnsLookupFn = (hostname: string) => Promise<{ address: string }>;

let dnsResolver: DnsLookupFn = async (hostname: string) => {
  const { address } = await dns.lookup(hostname, { family: 0 });
  return { address };
};

export function setDnsResolverForTesting(fn: DnsLookupFn | null): void {
  dnsResolver = fn ?? (async (hostname) => {
    const { address } = await dns.lookup(hostname, { family: 0 });
    return { address };
  });
}

async function resolveAndCheckHost(hostname: string): Promise<string | null> {
  try {
    const { address } = await dnsResolver(hostname);
    if (isBlockedIp(address)) {
      return `Blocked: resolved IP ${address} is in a private/reserved range`;
    }
    return null; // OK
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `DNS resolution failed: ${msg}`;
  }
}

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 200 * 1024; // 200 KB
const TIMEOUT_MS = 10_000;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export async function ssrfFetch(rawUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: `Invalid URL: ${rawUrl}` };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, error: `Protocol not allowed: ${url.protocol} (only http/https)` };
  }

  let redirectsLeft = MAX_REDIRECTS;
  let currentUrl = url;

  while (true) {
    // Block based on literal hostname if it looks like an IP
    if (net.isIP(currentUrl.hostname)) {
      if (isBlockedIp(currentUrl.hostname)) {
        return { ok: false, error: `Blocked: IP ${currentUrl.hostname} is in a private/reserved range` };
      }
    } else {
      // Resolve hostname and check
      const dnsError = await resolveAndCheckHost(currentUrl.hostname);
      if (dnsError) {
        return { ok: false, error: dnsError };
      }
    }

    let response: Response;
    try {
      response = await fetch(currentUrl.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Milestone-Reviewer/1.0' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Fetch error: ${msg}` };
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    if (isRedirect) {
      if (redirectsLeft === 0) {
        return { ok: false, error: 'Too many redirects (max 3)' };
      }
      redirectsLeft--;
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, error: 'Redirect with no Location header' };
      }
      let next: URL;
      try {
        next = new URL(location, currentUrl.toString());
      } catch {
        return { ok: false, error: `Redirect to invalid URL: ${location}` };
      }
      if (!ALLOWED_PROTOCOLS.has(next.protocol)) {
        return { ok: false, error: `Redirect to disallowed protocol: ${next.protocol}` };
      }
      currentUrl = next;
      continue;
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, statusCode: response.status };
    }

    // Stream body with size cap
    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, error: 'No response body' };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        reader.cancel();
        return { ok: false, error: `Response body exceeds 200 KB cap` };
      }
      chunks.push(value);
    }

    const bodyText = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc);
        merged.set(c, acc.length);
        return merged;
      }, new Uint8Array())
    );

    return { ok: true, text: bodyText, statusCode: response.status };
  }
}

/** Strip HTML tags and collapse whitespace for text extraction. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

