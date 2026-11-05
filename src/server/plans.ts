import type { Db } from './db.ts';
import { all, one, run } from './db.ts';
import { now } from './config.ts';
import type { MarksRecord, PlanBody, PlanDto } from '../shared/api.ts';
import type { SubjectPackage, Marks } from '../shared/engine/plan.ts';
import { packageSubjects } from '../shared/engine/plan.ts';

interface PlanRow {
  grade: number;
  english_is: 'home' | 'additional';
  maths: PlanDto['maths'];
  electives: string;
  careers: string;
  updated_at: string;
}

export function getPlan(db: Db, userId: string): PlanDto | null {
  const r = one<PlanRow>(db, 'SELECT grade, english_is, maths, electives, careers, updated_at FROM plans WHERE user_id = ?', userId);
  if (!r) return null;
  return { grade: r.grade as PlanDto['grade'], englishIs: r.english_is, maths: r.maths, electives: JSON.parse(r.electives), careers: JSON.parse(r.careers), updatedAt: r.updated_at };
}

export function savePlan(db: Db, userId: string, body: PlanBody): PlanDto {
  const t = now().toISOString();
  run(
    db,
    `INSERT INTO plans (user_id, grade, english_is, maths, electives, careers, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET grade = excluded.grade, english_is = excluded.english_is, maths = excluded.maths, electives = excluded.electives, careers = excluded.careers, updated_at = excluded.updated_at`,
    userId,
    body.grade,
    body.englishIs,
    body.maths,
    JSON.stringify(body.electives),
    JSON.stringify(body.careers),
    t,
  );
  return { ...body, grade: body.grade as PlanDto['grade'], updatedAt: t };
}

export function toPackage(plan: PlanDto): SubjectPackage {
  return { maths: plan.maths, electives: plan.electives, englishIs: plan.englishIs };
}

export function listMarks(db: Db, userId: string): MarksRecord[] {
  return all<{ grade: number; term: number; marks: string; updated_at: string }>(db, 'SELECT grade, term, marks, updated_at FROM marks WHERE user_id = ? ORDER BY grade DESC, term DESC', userId).map((r) => ({
    grade: r.grade,
    term: r.term,
    marks: JSON.parse(r.marks),
    updatedAt: r.updated_at,
  }));
}

/**
 * Saves one term's report. Only subjects in the learner's current plan are kept, so a changed subject choice
 * can't leave stale marks that silently count towards an APS.
 */
export function saveMarks(db: Db, userId: string, grade: number, term: number, marks: Marks, plan: PlanDto | null): MarksRecord {
  const allowed = plan ? new Set<string>(packageSubjects(toPackage(plan))) : null;
  const clean: Marks = {};
  for (const [k, v] of Object.entries(marks)) if (v !== undefined && (!allowed || allowed.has(k))) clean[k as keyof Marks] = Math.round(v);
  const t = now().toISOString();
  if (!Object.keys(clean).length) {
    run(db, 'DELETE FROM marks WHERE user_id = ? AND grade = ? AND term = ?', userId, grade, term);
  } else {
    run(
      db,
      `INSERT INTO marks (user_id, grade, term, marks, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, grade, term) DO UPDATE SET marks = excluded.marks, updated_at = excluded.updated_at`,
      userId,
      grade,
      term,
      JSON.stringify(clean),
      t,
    );
  }
  return { grade, term, marks: clean, updatedAt: t };
}

/** The most recent report: what every check runs on. */
export function latestMarks(records: MarksRecord[]): MarksRecord | null {
  return [...records].sort((a, b) => b.grade - a.grade || b.term - a.term)[0] ?? null;
}
