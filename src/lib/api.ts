/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from './lang';
import type { Meta } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

export class ApiError extends Error {
  status: number;
  code: string;
  details?: any;
  constructor(status: number, message: string, code = 'ERROR', details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** fetch() itself failed: no internet / server down. */
  get isNetwork() {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
interface Opts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** multipart: JSON goes in the `data` field, files in `fileField` */
  files?: File[];
  fileField?: string;
  noAuth?: boolean;
}

const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

// The refresh token is kept in two places: the httpOnly cookie (when the browser sends it) and this device's storage.
// The storage copy is what keeps you logged in when the app and the server are on different addresses
// (for example localhost and 192.168.x.x), where browsers do not send the cookie.
const RT_KEY = 'rt-v1';
export const getRefreshToken = (): string | null => {
  try { return typeof window === 'undefined' ? null : localStorage.getItem(RT_KEY); } catch { return null; }
};
export const setRefreshToken = (t: string | null) => {
  try {
    if (typeof window === 'undefined') return;
    if (t) localStorage.setItem(RT_KEY, t); else localStorage.removeItem(RT_KEY);
  } catch { /* storage blocked: the cookie still works */ }
};

/** ok = new access token | denied = the session really ended | offline = server unreachable (stay logged in) */
export type RefreshResult = 'ok' | 'denied' | 'offline';
let refreshing: Promise<RefreshResult> | null = null;
export const refreshSession = (): Promise<RefreshResult> => {
  refreshing ??= (async (): Promise<RefreshResult> => {
    try {
      const rt = getRefreshToken();
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-token-mode': 'body' },
        body: JSON.stringify(rt ? { refreshToken: rt } : {}),
      });
      if (r.status >= 500) return 'offline'; // server restarting or down: not a logout
      if (!r.ok) {
        setRefreshToken(null);
        return 'denied';
      }
      const j = await r.json();
      setAccessToken(j.data.accessToken);
      if (j.data.refreshToken) setRefreshToken(j.data.refreshToken);
      return 'ok';
    } catch {
      return 'offline';
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

const send = async (path: string, o: Opts): Promise<Response> => {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (o.files?.length) {
    const fd = new FormData();
    fd.append('data', JSON.stringify(o.body ?? {}));
    o.files.forEach((f) => fd.append(o.fileField ?? 'images', f));
    body = fd;
  } else if (o.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(o.body);
  }
  if (accessToken && !o.noAuth) headers.Authorization = `Bearer ${accessToken}`;
  if (path.startsWith('/auth/')) headers['x-token-mode'] = 'body'; // login / password change also return the refresh token to keep on this device
  try {
    return await fetch(`${API_URL}${path}${qs(o.query)}`, { method: o.method ?? 'GET', headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'No internet connection', 'NETWORK');
  }
};

const run = async (path: string, o: Opts, retried = false): Promise<Response> => {
  const res = await send(path, o);
  if (res.status === 401 && !retried && !o.noAuth && !path.startsWith('/auth/')) {
    const code = (await res.clone().json().catch(() => ({})))?.code;
    if ((code === 'TOKEN_INVALID' || code === 'UNAUTHENTICATED') && (await refreshSession()) === 'ok') return run(path, o, true);
  }
  return res;
};

const fail = async (res: Response): Promise<never> => {
  const j = await res.json().catch(() => ({}));
  throw new ApiError(res.status, j.message ?? 'Something went wrong', j.code ?? 'ERROR', j.details);
};

/** Returns `data`. Use apiPaged for list endpoints that carry `meta`. */
export async function api<T = any>(path: string, o: Opts = {}): Promise<T> {
  const res = await run(path, o);
  if (!res.ok) return fail(res);
  const j = await res.json();
  if (path.startsWith('/auth/') && j.data?.refreshToken) setRefreshToken(j.data.refreshToken);
  return j.data as T;
}

export async function apiPaged<T = any>(path: string, query?: Query): Promise<{ data: T[]; meta: Meta }> {
  const res = await run(path, { query });
  if (!res.ok) return fail(res);
  const j = await res.json();
  return { data: j.data as T[], meta: j.meta as Meta };
}

/** Printable invoice HTML (needs the auth header, so it can't be a plain link). */
export async function apiText(path: string, query?: Query): Promise<string> {
  const res = await run(path, { query });
  if (!res.ok) return fail(res);
  return res.text();
}

export const errMsg = (e: unknown) => tr(e instanceof Error ? e.message : 'Something went wrong');
