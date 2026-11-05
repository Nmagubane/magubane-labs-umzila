import { resolve } from 'node:path';

try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file: environment variables or defaults apply.
}

const env = process.env;
/** A setting's value, or undefined when it is missing or blank: `PUBLIC_URL=` in .env means "not set", not "empty". */
const setting = (name: string): string | undefined => env[name]?.trim() || undefined;
const list = (name: string): string[] =>
  (env[name] ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

export const config = {
  port: Number(setting('PORT') ?? 5175),
  dev: env.NODE_ENV !== 'production',
  databasePath: resolve(setting('DATABASE_PATH') ?? './data/umzila.db'),
  clientDir: resolve(setting('CLIENT_DIR') ?? './dist/client'),
  sessionDays: 30,
  /** 'invite' (default in production): learner sign-up needs a code from INVITE_CODES or a class code. 'open' or 'closed' otherwise. */
  signupMode: (setting('SIGNUP_MODE') ?? (env.NODE_ENV === 'production' ? 'invite' : 'open')) as 'invite' | 'open' | 'closed',
  inviteCodes: list('INVITE_CODES'),
  /** Codes that let someone create a teacher account. Keep them private. */
  educatorCodes: list('EDUCATOR_CODES'),
  signupRatePerHour: Number(setting('SIGNUP_RATE_PER_HOUR') ?? 40),
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  contactEmail: setting('CONTACT_EMAIL') ?? null,
  publicUrl: (setting('PUBLIC_URL') ?? setting('RENDER_EXTERNAL_URL') ?? `http://localhost:${setting('PORT') ?? 5175}`).replace(/\/$/, ''),
  email: {
    provider: (['brevo', 'resend'].includes(env.EMAIL_PROVIDER?.trim().toLowerCase() ?? '') && env.EMAIL_API_KEY?.trim() ? env.EMAIL_PROVIDER!.trim().toLowerCase() : 'log') as 'brevo' | 'resend' | 'log',
    apiKey: setting('EMAIL_API_KEY') ?? null,
    from: setting('EMAIL_FROM') ?? 'no-reply@magubanelabs.local',
    fromName: setting('EMAIL_FROM_NAME') ?? 'Umzila',
    apiBase: env.EMAIL_API_BASE?.replace(/\/$/, '') || null,
  },
};

/** The server's clock. Only tests and the demo seeder move it. */
let clockOverride: Date | null = null;
export function now(): Date {
  return clockOverride ? new Date(clockOverride) : new Date();
}
export function setClock(d: Date | null): void {
  clockOverride = d;
}
