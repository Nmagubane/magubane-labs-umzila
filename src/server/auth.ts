import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { Db } from './db.ts';
import { one, run, newId } from './db.ts';
import { now } from './config.ts';
import type { UserDto } from '../shared/api.ts';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}

/** A dummy hash so failed logins for unknown emails take as long as wrong passwords. */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));
export function burnPasswordCheck(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');

export function createSession(db: Db, userId: string, days: number): string {
  const token = randomBytes(32).toString('base64url');
  const t = now();
  run(db, 'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha256(token), userId, t.toISOString(), new Date(t.getTime() + days * 86_400_000).toISOString());
  return token;
}

export function destroySession(db: Db, token: string): void {
  run(db, 'DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export function destroyAllSessions(db: Db, userId: string): void {
  run(db, 'DELETE FROM sessions WHERE user_id = ?', userId);
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: UserDto['role'];
  email_verified_at: string | null;
  school: string | null;
}
export const USER_COLS = 'id, email, display_name, role, email_verified_at, school';

export function toUserDto(row: UserRow): UserDto {
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, emailVerified: !!row.email_verified_at, school: row.school };
}

export function userForSession(db: Db, token: string | undefined): UserDto | null {
  if (!token || token.length > 100) return null;
  const row = one<UserRow & { expires_at: string }>(db, `SELECT u.id, u.email, u.display_name, u.role, u.email_verified_at, u.school, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, sha256(token));
  if (!row) return null;
  if (new Date(row.expires_at) < now()) {
    destroySession(db, token);
    return null;
  }
  return toUserDto(row);
}

export function getUser(db: Db, id: string): UserDto | null {
  const row = one<UserRow>(db, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id);
  return row ? toUserDto(row) : null;
}

export function markEmailVerified(db: Db, userId: string): void {
  run(db, 'UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', now().toISOString(), userId);
}

export function setPassword(db: Db, userId: string, password: string): void {
  run(db, 'UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), userId);
}

export interface NewUser {
  email: string;
  password: string;
  displayName: string;
  role: UserDto['role'];
  school?: string | null;
  inviteCode?: string | null;
  isMinor?: boolean;
  guardianName?: string | null;
  guardianEmail?: string | null;
  consentVersion: string;
  /** Only the demo seeder and tests create pre-verified accounts. */
  verified?: boolean;
}

export function createUser(db: Db, input: NewUser): UserDto {
  const id = newId('usr');
  const t = now().toISOString();
  run(
    db,
    `INSERT INTO users (id, email, password_hash, display_name, role, school, created_at, email_verified_at, invite_code, is_minor, guardian_name, guardian_email, consent_at, consent_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.email,
    hashPassword(input.password),
    input.displayName,
    input.role,
    input.school ?? null,
    t,
    input.verified ? t : null,
    input.inviteCode ?? null,
    input.isMinor ? 1 : 0,
    input.guardianName ?? null,
    input.guardianEmail ?? null,
    t,
    input.consentVersion,
  );
  return { id, email: input.email, displayName: input.displayName, role: input.role, emailVerified: !!input.verified, school: input.school ?? null };
}

/** Permanently removes an account and everything recorded about it (plans, marks, sessions and classes cascade). */
export function deleteUser(db: Db, userId: string): void {
  run(db, 'DELETE FROM email_log WHERE learner_id = ?', userId);
  run(db, 'DELETE FROM users WHERE id = ?', userId);
}

/**
 * The single rule for who may see a learner's plan and marks:
 * the learner themself, or a verified teacher of an active class the learner has joined.
 */
export function canAccessLearner(db: Db, viewer: UserDto, learnerId: string): boolean {
  if (viewer.id === learnerId) return true;
  if (viewer.role !== 'teacher' || !viewer.emailVerified) return false;
  return !!one(db, 'SELECT 1 FROM class_members m JOIN classes c ON c.id = m.class_id WHERE m.learner_id = ? AND c.teacher_id = ? AND c.archived_at IS NULL', learnerId, viewer.id);
}
