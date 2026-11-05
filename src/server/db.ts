/**
 * SQLite via Node's built-in node:sqlite (nothing native to compile on Windows).
 * Migrations are append-only, tracked with PRAGMA user_version.
 *
 * Data minimisation: a learner's record is their name, email, grade, subject choices, career goals and term marks.
 * No ID numbers, no addresses, no phone numbers. A guardian's name and email are kept only for under-18s (POPIA consent).
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const MIGRATIONS: string[] = [
  /* v1 */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'teacher')),
    school TEXT,
    created_at TEXT NOT NULL,
    email_verified_at TEXT,
    invite_code TEXT,
    is_minor INTEGER NOT NULL DEFAULT 0,
    guardian_name TEXT,
    guardian_email TEXT,
    consent_at TEXT,
    consent_version TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE email_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );
  CREATE INDEX email_codes_user ON email_codes(user_id, purpose, created_at);

  CREATE TABLE email_log (
    id TEXT PRIMARY KEY,
    learner_id TEXT,
    class_id TEXT,
    recipient TEXT NOT NULL,
    kind TEXT NOT NULL,
    period TEXT,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- One plan per learner: their grade, their seven subjects, and up to three careers (first = main goal).
  CREATE TABLE plans (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
    english_is TEXT NOT NULL CHECK (english_is IN ('home', 'additional')),
    maths TEXT NOT NULL,
    electives TEXT NOT NULL,
    careers TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Term marks from school reports. One row per learner, grade and term; marks as JSON {subjectId: percent}.
  CREATE TABLE marks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
    term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 4),
    marks TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, grade, term)
  );

  CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    archived_at TEXT
  );
  CREATE INDEX classes_teacher ON classes(teacher_id);

  CREATE TABLE class_members (
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (class_id, learner_id)
  );
  CREATE INDEX class_members_learner ON class_members(learner_id);
  `,
];

export type Db = DatabaseSync;
export type Row = Record<string, string | number | null>;

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

/** A per-installation secret (for HMACs), created on first use and kept in the database. */
export function appSecret(db: Db): string {
  const row = one<{ value: string }>(db, "SELECT value FROM app_settings WHERE key = 'secret'");
  if (row) return row.value;
  const value = randomBytes(32).toString('base64url');
  run(db, "INSERT INTO app_settings (key, value) VALUES ('secret', ?)", value);
  return value;
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Short, URL-safe, unguessable ids. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

export function one<T = Row>(db: Db, sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T = Row>(db: Db, sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(db: Db, sql: string, ...params: (string | number | null)[]): void {
  db.prepare(sql).run(...params);
}
