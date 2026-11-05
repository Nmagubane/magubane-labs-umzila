/**
 * Classes: a teacher (often the Life Orientation teacher or school counsellor) creates a class; learners join with a code.
 * The class report is the reason a school pays: it shows, before subject-choice deadlines, which learners are about to
 * close the door on the career they say they want.
 */
import { randomInt } from 'node:crypto';
import type { Db } from './db.ts';
import { all, newId, one, run } from './db.ts';
import { now } from './config.ts';
import { HttpError } from './http.ts';
import type { ClassReport, ClassSummary, LearnerRow, LearnerStatus, UserDto } from '../shared/api.ts';
import { careerById } from '../shared/data/careers.ts';
import { SUBJECTS } from '../shared/data/subjects.ts';
import { biggestGap, checkCareerSubjects, checkProgramme, programmesFor, standardAps } from '../shared/engine/plan.ts';
import { getPlan, latestMarks, listMarks, toPackage } from './plans.ts';

// No 0/O, 1/I/L: codes are read aloud in classrooms and copied from the board.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newJoinCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

interface ClassRow {
  id: string;
  teacher_id: string;
  name: string;
  grade: number;
  join_code: string;
  created_at: string;
  learners?: number;
}

const toSummary = (r: ClassRow): ClassSummary => ({ id: r.id, name: r.name, grade: r.grade, code: r.join_code, learners: r.learners ?? 0, createdAt: r.created_at });

export function requireTeacher(user: UserDto | null): UserDto {
  if (!user) throw new HttpError(401, 'unauthenticated', 'Please log in.');
  if (user.role !== 'teacher') throw new HttpError(403, 'not_teacher', 'This is for teacher accounts.');
  if (!user.emailVerified) throw new HttpError(403, 'unverified', 'Confirm your email address first.');
  return user;
}

export function listClasses(db: Db, teacherId: string): ClassSummary[] {
  return all<ClassRow>(
    db,
    `SELECT c.*, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS learners
     FROM classes c WHERE c.teacher_id = ? AND c.archived_at IS NULL ORDER BY c.created_at DESC`,
    teacherId,
  ).map(toSummary);
}

export function createClass(db: Db, teacherId: string, name: string, grade: number): ClassSummary {
  const id = newId('cls');
  let code = newJoinCode();
  while (one(db, 'SELECT 1 FROM classes WHERE join_code = ?', code)) code = newJoinCode();
  const t = now().toISOString();
  run(db, 'INSERT INTO classes (id, teacher_id, name, grade, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, teacherId, name, grade, code, t);
  return { id, name, grade, code, learners: 0, createdAt: t };
}

function ownedClass(db: Db, teacherId: string, classId: string): ClassRow {
  const c = one<ClassRow>(db, 'SELECT * FROM classes WHERE id = ? AND teacher_id = ? AND archived_at IS NULL', classId, teacherId);
  if (!c) throw new HttpError(404, 'not_found', 'Class not found.');
  return c;
}

export function archiveClass(db: Db, teacherId: string, classId: string): void {
  ownedClass(db, teacherId, classId);
  run(db, 'UPDATE classes SET archived_at = ? WHERE id = ?', now().toISOString(), classId);
}

export function findClassByCode(db: Db, code: string): ClassRow | undefined {
  return one<ClassRow>(db, 'SELECT * FROM classes WHERE join_code = ? AND archived_at IS NULL', code.trim().toUpperCase());
}

export function joinClass(db: Db, learner: UserDto, code: string): ClassSummary {
  if (learner.role !== 'learner') throw new HttpError(403, 'not_learner', 'Only learner accounts can join a class.');
  const c = findClassByCode(db, code);
  if (!c) throw new HttpError(404, 'unknown_class', 'No class has that code. Check it with your teacher.', { fieldErrors: { code: ['No class has that code'] } });
  run(db, 'INSERT OR IGNORE INTO class_members (class_id, learner_id, joined_at) VALUES (?, ?, ?)', c.id, learner.id, now().toISOString());
  return toSummary(c);
}

export function leaveClass(db: Db, learnerId: string, classId: string): void {
  run(db, 'DELETE FROM class_members WHERE class_id = ? AND learner_id = ?', classId, learnerId);
}

export function removeMember(db: Db, teacherId: string, classId: string, learnerId: string): void {
  ownedClass(db, teacherId, classId);
  run(db, 'DELETE FROM class_members WHERE class_id = ? AND learner_id = ?', classId, learnerId);
}

export function myClasses(db: Db, learnerId: string): { id: string; name: string; teacher: string }[] {
  return all<{ id: string; name: string; teacher: string }>(
    db,
    `SELECT c.id, c.name, u.display_name AS teacher FROM class_members m JOIN classes c ON c.id = m.class_id JOIN users u ON u.id = c.teacher_id
     WHERE m.learner_id = ? AND c.archived_at IS NULL ORDER BY m.joined_at`,
    learnerId,
  );
}

/** One learner, as a teacher sees them. Uses exactly the same engine as the learner's own screens. */
export function learnerRow(db: Db, learner: { id: string; display_name: string }): LearnerRow {
  const plan = getPlan(db, learner.id);
  const base = { id: learner.id, name: learner.display_name, grade: plan?.grade ?? null, careers: plan?.careers ?? [], maths: plan?.maths ?? null, electives: plan?.electives ?? [], aps: null, gap: null, updatedAt: plan?.updatedAt ?? null };
  const main = plan?.careers[0] ? careerById(plan.careers[0]) : undefined;
  if (!plan || !main) return { ...base, status: 'no-plan', flags: ['Has not chosen a career goal yet'] };

  const pkg = toPackage(plan);
  const flags: string[] = [];
  const mainCheck = checkCareerSubjects(pkg, main);
  for (const id of plan.careers) {
    const c = careerById(id);
    if (!c) continue;
    const check = id === main.id ? mainCheck : checkCareerSubjects(pkg, c);
    if (check.status === 'closed') flags.push(`Wants to be: ${c.name.toLowerCase()}, but does not take ${check.missingEssential.map((n) => n.anyOf.map((s) => SUBJECTS[s].name).join(' or ')).join(', ')}`);
  }
  if (plan.electives.length < 3) flags.push('Has not chosen all three electives');

  const latest = latestMarks(listMarks(db, learner.id));
  const aps = latest ? standardAps(pkg, latest.marks) : null;
  let status: LearnerStatus;
  let gap: LearnerRow['gap'] = null;
  if (mainCheck.status === 'closed') status = 'closed';
  else if (!latest) {
    status = 'no-marks';
    flags.push('No marks entered yet');
  } else {
    const fits = programmesFor(main).map((p) => checkProgramme(pkg, latest.marks, p));
    const g = biggestGap(fits);
    if (g) gap = { subject: g.subject, shortBy: g.shortBy, programme: g.programme.name };
    if (fits.some((f) => f.status === 'meets')) status = 'on-track';
    else if (fits.some((f) => f.status === 'close')) status = 'close';
    else if (fits.some((f) => f.status === 'gap')) status = 'gap';
    else if (!fits.length) status = 'on-track'; // trades: no admission table, only the subject rule, which is met
    else {
      status = 'no-marks';
      flags.push('Marks are incomplete');
    }
    if (g && status !== 'on-track') flags.push(`${SUBJECTS[g.subject].name} is ${g.shortBy}% short of the minimum for ${g.programme.name}`);
  }
  return { ...base, status, flags, aps: aps?.complete ? aps.total : null, gap };
}

const STATUS_ORDER: Record<LearnerStatus, number> = { closed: 0, gap: 1, 'no-plan': 2, 'no-marks': 3, close: 4, 'on-track': 5 };

export function classReport(db: Db, teacherId: string, classId: string): ClassReport {
  const c = ownedClass(db, teacherId, classId);
  const members = all<{ id: string; display_name: string }>(
    db,
    'SELECT u.id, u.display_name FROM class_members m JOIN users u ON u.id = m.learner_id WHERE m.class_id = ? ORDER BY u.display_name COLLATE NOCASE',
    classId,
  );
  const learners = members.map((m) => learnerRow(db, m)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
  const counts = new Map<string, number>();
  for (const l of learners) if (l.careers[0]) counts.set(l.careers[0], (counts.get(l.careers[0]) ?? 0) + 1);
  return {
    class: toSummary({ ...c, learners: members.length }),
    learners,
    summary: {
      total: learners.length,
      withPlan: learners.filter((l) => l.status !== 'no-plan').length,
      closed: learners.filter((l) => l.status === 'closed').length,
      needsConversation: learners.filter((l) => l.status === 'closed' || l.status === 'gap' || l.status === 'no-plan').length,
      topCareers: [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      mathsLitBlocked: learners.filter((l) => l.status === 'closed' && l.maths === 'maths-lit').length,
    },
  };
}

/** A teacher may open one learner's full plan only through a class they own. */
export function teacherLearner(db: Db, teacherId: string, classId: string, learnerId: string) {
  ownedClass(db, teacherId, classId);
  const member = one<{ id: string; display_name: string }>(db, 'SELECT u.id, u.display_name FROM class_members m JOIN users u ON u.id = m.learner_id WHERE m.class_id = ? AND m.learner_id = ?', classId, learnerId);
  if (!member) throw new HttpError(404, 'not_found', 'Learner not found in this class.');
  return { name: member.display_name, plan: getPlan(db, learnerId), marks: listMarks(db, learnerId) };
}
