/**
 * The one HTTP client for the R-NLAM API. Sends the session's Bearer token,
 * turns error responses into ApiError (with lifecycle `blockers` when a guard
 * refused a transition), and signals the session on 401.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'rnlam.session.token';

export interface Blocker {
  code: string;
  message: string;
  citation?: string;
  overridable: boolean;
  unblockedBy?: string[];
  evidence?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly blockers: Blocker[] = [],
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    if (typeof window === 'undefined') return;
    try {
      if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode: session lives in memory only */
    }
  },
};

type Json = Record<string, unknown> | unknown[];

async function request<T>(method: string, path: string, body?: Json | FormData, base = API_BASE_URL): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the R-NLAM server. Is the backend running on port 4000?', 'NETWORK');
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rnlam:unauthorized'));
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string | string[]; error?: string; blockers?: Blocker[] };
    const message = Array.isArray(d.message) ? d.message.join('; ') : d.message || res.statusText || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, d.error, d.blockers ?? [], data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Json) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: Json) => request<T>('PATCH', path, body ?? {}),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  ai: {
    get: <T>(path: string) => request<T>('GET', path, undefined, AI_BASE_URL),
    post: <T>(path: string, body: Json) => request<T>('POST', path, body, AI_BASE_URL),
  },
};

/** Build a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
