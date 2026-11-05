/**
 * One-time email codes for verifying an address and resetting a password.
 * Codes: 6 digits, valid 10 minutes, 5 tries each, stored only as an HMAC. Resending is rate-limited.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Db } from './db.ts';
import { one, run, newId, appSecret } from './db.ts';
import { now } from './config.ts';
import { HttpError } from './http.ts';
import { sendMail, layout, type MailResult } from './mailer.ts';

export type CodePurpose = 'verify' | 'reset';
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_GAP_MS = 60_000;
const MAX_PER_HOUR = 5;

const hash = (db: Db, id: string, code: string) => createHmac('sha256', appSecret(db)).update(`${id}:${code}`).digest('base64url');

export function issueCode(db: Db, userId: string, purpose: CodePurpose): string {
  const at = now();
  const recent = one<{ n: number; last: string | null }>(db, 'SELECT COUNT(*) AS n, MAX(created_at) AS last FROM email_codes WHERE user_id = ? AND purpose = ? AND created_at > ?', userId, purpose, new Date(at.getTime() - 3_600_000).toISOString());
  if (recent?.last && at.getTime() - new Date(recent.last).getTime() < RESEND_GAP_MS) {
    const wait = Math.ceil((RESEND_GAP_MS - (at.getTime() - new Date(recent.last).getTime())) / 1000);
    throw new HttpError(429, 'resend_too_soon', `Please wait ${wait} seconds before asking for another code.`, { retryAfter: wait });
  }
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) throw new HttpError(429, 'too_many_codes', 'Too many codes requested. Try again in an hour.');
  run(db, 'UPDATE email_codes SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL', at.toISOString(), userId, purpose);
  const id = newId('otp');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  run(db, 'INSERT INTO email_codes (id, user_id, purpose, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', id, userId, purpose, hash(db, id, code), at.toISOString(), new Date(at.getTime() + TTL_MS).toISOString());
  return code;
}

/** Consumes the code on success. Throws a clear, specific error otherwise. */
export function checkCode(db: Db, userId: string, purpose: CodePurpose, code: string): void {
  const at = now();
  const row = one<{ id: string; code_hash: string; attempts: number; expires_at: string }>(db, 'SELECT id, code_hash, attempts, expires_at FROM email_codes WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1', userId, purpose);
  if (!row || new Date(row.expires_at) < at) throw new HttpError(400, 'code_expired', 'That code has expired. Ask for a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(400, 'too_many_attempts', 'Too many wrong tries. Ask for a new code.');
  const clean = code.replace(/\D/g, '');
  const a = Buffer.from(hash(db, row.id, clean));
  const b = Buffer.from(row.code_hash);
  if (clean.length !== 6 || a.length !== b.length || !timingSafeEqual(a, b)) {
    run(db, 'UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new HttpError(400, 'wrong_code', left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code isn\'t right. Ask for a new code.', { fieldErrors: { code: ["That code isn't right"] } });
  }
  run(db, 'UPDATE email_codes SET consumed_at = ? WHERE id = ?', at.toISOString(), row.id);
}

export async function sendVerificationEmail(db: Db, user: { id: string; email: string; displayName: string }): Promise<MailResult> {
  const code = issueCode(db, user.id, 'verify');
  const { html, text } = layout({
    heading: `Your code is ${code}`,
    paragraphs: [`Hi ${user.displayName}, enter this code in Umzila to confirm your email address.`, 'It works for 10 minutes.'],
    code,
    footer: "If you didn't create an Umzila account, you can ignore this email. Nobody can use the account without this code.",
  });
  return logged(db, user.id, user.email, 'verify', await sendMail({ to: { email: user.email, name: user.displayName }, subject: `${code} is your Umzila code`, html, text }));
}

export async function sendResetEmail(db: Db, user: { id: string; email: string; displayName: string }): Promise<MailResult> {
  const code = issueCode(db, user.id, 'reset');
  const { html, text } = layout({
    heading: 'Reset your password',
    paragraphs: [`Hi ${user.displayName}, someone asked to reset the password for this Umzila account. Enter this code to choose a new password.`, 'It works for 10 minutes.'],
    code,
    footer: "If this wasn't you, ignore this email. Your password stays the same.",
  });
  return logged(db, user.id, user.email, 'reset', await sendMail({ to: { email: user.email, name: user.displayName }, subject: `${code} is your Umzila reset code`, html, text }));
}

export function logged(db: Db, learnerId: string | null, recipient: string, kind: string, r: MailResult, extra: { classId?: string | null; period?: string | null } = {}): MailResult {
  run(db, 'INSERT INTO email_log (id, learner_id, class_id, recipient, kind, period, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', newId('eml'), learnerId, extra.classId ?? null, recipient, kind, extra.period ?? null, r.status, r.status === 'failed' ? r.error : null, now().toISOString());
  return r;
}
