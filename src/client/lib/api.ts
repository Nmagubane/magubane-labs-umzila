import type { ApiErrorBody } from '../../shared/api.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get offline(): boolean {
    return this.code === 'network';
  }
  /** Field-level messages from a 422, keyed by field name. */
  get fields(): Record<string, string> {
    const fe = (this.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {};
    return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0] ?? '']));
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'x-requested-with': 'umzila', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'network', 'You seem to be offline. Check your connection and try again.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (a proxy error page, for example).
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
