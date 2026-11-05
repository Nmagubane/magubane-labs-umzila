/**
 * A deliberately small HTTP layer on node:http: routing, JSON, cookies, errors, security headers.
 * No framework — fewer moving parts, and every behaviour is visible in this file.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { ZodType, ZodTypeDef } from 'zod';
import type { UserDto } from '../shared/api.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  user: UserDto | null;
  ip: string;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler): void {
    this.routes.push({ method, parts: path.split('/').filter(Boolean), handler });
  }
  get(path: string, h: Handler) {
    this.on('GET', path, h);
  }
  post(path: string, h: Handler) {
    this.on('POST', path, h);
  }
  put(path: string, h: Handler) {
    this.on('PUT', path, h);
  }
  delete(path: string, h: Handler) {
    this.on('DELETE', path, h);
  }
  patch(path: string, h: Handler) {
    this.on('PATCH', path, h);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'method' | null {
    const segs = pathname.split('/').filter(Boolean);
    let pathMatched = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        const p = r.parts[i] as string;
        const s = segs[i] as string;
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(s);
        else if (p !== s) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      pathMatched = true;
      if (r.method === method) return { handler: r.handler, params };
    }
    return pathMatched ? 'method' : null;
  }
}

const MAX_BODY = 64 * 1024;

export async function readJson<T>(ctx: Ctx, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const type = ctx.req.headers['content-type'] ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of ctx.req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large', 'Request body too large.');
    chunks.push(chunk as Buffer);
  }
  let raw: unknown;
  try {
    raw = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw new HttpError(400, 'bad_json', 'Malformed JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(422, 'invalid', first?.message ?? 'Invalid request.', parsed.error.flatten());
  }
  return parsed.data;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res: ServerResponse, name: string, value: string, opts: { maxAge: number; secure: boolean }): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${opts.maxAge}`];
  if (opts.secure) parts.push('Secure');
  const prev = res.getHeader('set-cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  res.setHeader('set-cookie', [...list, parts.join('; ')]);
}

export function securityHeaders(res: ServerResponse, dev: boolean): void {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (!dev) res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'content-security-policy',
    [
      "default-src 'self'",
      `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/** Serve a file from `root`, or the SPA index for unknown non-asset paths. Returns false if not handled. */
export function serveStatic(req: IncomingMessage, res: ServerResponse, root: string, pathname: string): boolean {
  const rootAbs = resolve(root);
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(rootAbs, safe);
  if (!file.startsWith(rootAbs)) return false;
  let isIndex = false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(pathname)) return false; // a missing asset is a 404, not the app
    file = join(rootAbs, 'index.html');
    isIndex = true;
    if (!existsSync(file)) return false;
  }
  const ext = extname(file);
  const hashed = /\.[A-Z0-9]{8,}\.(js|css|woff2?)$/i.test(file) || file.includes(`${'/'}fonts${'/'}`) || file.includes('\\fonts\\');
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': isIndex ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

/** Simple fixed-window rate limiter (in memory; fine for a single instance). */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}
  take(key: string): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.reset < now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
      return true;
    }
    h.count++;
    return h.count <= this.limit;
  }
}
