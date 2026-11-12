export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    opts: { status: number; code?: string; details?: unknown; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code || 'Error';
    this.details = opts.details;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiFetchOptions extends RequestInit {
  slot?: 'client' | 'freelancer';
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCookie('ms_csrf');
  if (existing) return existing;
  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { csrfToken?: string };
      return getCookie('ms_csrf') || data.csrfToken || null;
    }
  } catch {
    // Ignore offline error
  }
  return getCookie('ms_csrf');
}

export async function apiRawFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { slot, headers: rawHeaders, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();
  const headers = new Headers(rawHeaders);

  if (rest.body && typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (slot) {
    headers.set('X-Session-Slot', slot);
  }

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  return fetch(url, {
    ...rest,
    method,
    headers,
    credentials: 'include',
  });
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiRawFetch(url, options);
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!res.ok) {
    const body = (parsed && typeof parsed === 'object' ? parsed : {}) as {
      message?: string;
      error?: string;
      details?: unknown;
      retryAfterSeconds?: number;
    };
    throw new ApiError(body.message || body.error || `Request failed (${res.status})`, {
      status: res.status,
      code: body.error,
      details: body.details,
      retryAfterSeconds: body.retryAfterSeconds,
    });
  }

  return parsed as T;
}

