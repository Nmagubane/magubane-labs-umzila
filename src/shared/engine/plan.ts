/**
 * The planning engine: pure functions, no I/O. The server and the client run the same code,
 * so what a teacher sees in a class report is exactly what the learner sees on their phone.
 */
import { CAREERS, type Career, type SubjectNeed } from '../data/careers.ts';
import { INSTITUTIONS, PROGRAMMES, type Programme, type SubjectRequirement } from '../data/programmes.ts';
import { LEVEL_FLOOR, levelOf, SUBJECTS, type ElectiveId, type Level, type MathsId, type SubjectId } from '../data/subjects.ts';

/** The seven subjects a learner takes in Grades 10–12. */
export interface SubjectPackage {
  maths: MathsId;
  electives: ElectiveId[];
  /** Whether English is the Home Language or the First Additional Language. The other language is the second one. */
  englishIs: 'home' | 'additional';
}

/** Percent per subject. Missing = not entered yet. */
export type Marks = Partial<Record<SubjectId, number>>;

export const COMPULSORY: SubjectId[] = ['english', 'other-language', 'life-orientation'];

export function packageSubjects(pkg: SubjectPackage): SubjectId[] {
  return ['english', 'other-language', pkg.maths, 'life-orientation', ...pkg.electives];
}

export function takes(pkg: SubjectPackage, id: SubjectId): boolean {
  return packageSubjects(pkg).includes(id);
}

// ---------------------------------------------------------------- APS

export interface ApsResult {
  total: number;
  max: number;
  counted: { subject: SubjectId; percent: number; level: Level }[];
  /** How many of the six counted subjects have marks. Below 6, the APS is incomplete. */
  complete: boolean;
}

/**
 * The common university method: the six 20-credit subjects on the 1–7 scale, Life Orientation excluded (max 42).
 * A learner has exactly six 20-credit subjects, so all of them count.
 */
export function standardAps(pkg: SubjectPackage, marks: Marks): ApsResult {
  const subjects = packageSubjects(pkg).filter((s) => s !== 'life-orientation');
  const counted = subjects.flatMap((subject) => {
    const percent = marks[subject];
    return percent === undefined ? [] : [{ subject, percent, level: levelOf(percent) }];
  });
  return { total: counted.reduce((n, c) => n + c.level, 0), max: 42, counted, complete: counted.length === subjects.length };
}

// ---------------------------------------------------------------- NSC pass estimate

export type PassLevel = 'bachelor' | 'diploma' | 'higher-certificate' | 'not-yet';

export const PASS_LABEL: Record<PassLevel, string> = {
  bachelor: "Bachelor's pass",
  diploma: 'Diploma pass',
  'higher-certificate': 'Higher Certificate pass',
  'not-yet': 'Not a pass yet',
};

/**
 * An estimate of the NSC result from current marks (DBE rules; see sources 'wced-bachelor-pass').
 * Bachelor: Home Language ≥ 40%, four subjects other than LO ≥ 50%, at least six of seven passed.
 * Diploma: Home Language ≥ 40%, four subjects other than LO ≥ 40%, at least six of seven passed.
 * Higher Certificate: Home Language ≥ 40%, two other subjects ≥ 40%, at least six of seven passed.
 * "Passed" is taken as 30% or more. The real result is decided by the DBE and Umalusi; the app labels this an estimate.
 */
export function estimatePass(pkg: SubjectPackage, marks: Marks): { level: PassLevel; complete: boolean } {
  const all = packageSubjects(pkg);
  const complete = all.every((s) => marks[s] !== undefined);
  const m = (s: SubjectId) => marks[s] ?? 0;
  const homeLanguage: SubjectId = pkg.englishIs === 'home' ? 'english' : 'other-language';
  if (m(homeLanguage) < 40) return { level: 'not-yet', complete };
  const passed = all.filter((s) => m(s) >= 30).length;
  if (passed < 6) return { level: 'not-yet', complete };
  const nonLo = all.filter((s) => s !== 'life-orientation');
  if (nonLo.filter((s) => m(s) >= 50).length >= 4) return { level: 'bachelor', complete };
  if (nonLo.filter((s) => m(s) >= 40).length >= 4) return { level: 'diploma', complete };
  if (all.filter((s) => s !== homeLanguage && m(s) >= 40).length >= 2) return { level: 'higher-certificate', complete };
  return { level: 'not-yet', complete };
}

// ---------------------------------------------------------------- Subject choice vs careers

export type RouteStatus = 'open' | 'open-weaker' | 'closed';

export interface CareerSubjectCheck {
  career: Career;
  status: RouteStatus;
  missingEssential: SubjectNeed[];
  missingRecommended: SubjectNeed[];
}

const hasAny = (pkg: SubjectPackage, need: SubjectNeed) => need.anyOf.some((s) => takes(pkg, s));

export function checkCareerSubjects(pkg: SubjectPackage, career: Career): CareerSubjectCheck {
  const missingEssential = career.school.needs.filter((n) => n.kind === 'essential' && !hasAny(pkg, n));
  const missingRecommended = career.school.needs.filter((n) => n.kind === 'recommended' && !hasAny(pkg, n));
  const status: RouteStatus = missingEssential.length ? 'closed' : missingRecommended.length ? 'open-weaker' : 'open';
  return { career, status, missingEssential, missingRecommended };
}

export function checkAllCareers(pkg: SubjectPackage, careers: Career[] = CAREERS): CareerSubjectCheck[] {
  return careers.map((c) => checkCareerSubjects(pkg, c));
}

/** How a single swap changes things: the number that makes the Maths vs Maths Literacy decision concrete. */
export function openCount(pkg: SubjectPackage, careers: Career[] = CAREERS): number {
  return checkAllCareers(pkg, careers).filter((c) => c.status !== 'closed').length;
}

// ---------------------------------------------------------------- Programme eligibility from marks

export type FitStatus = 'meets' | 'close' | 'gap' | 'blocked' | 'incomplete';

export interface RequirementCheck {
  requirement: SubjectRequirement;
  /** Which of the learner's subjects is used for it, if any. */
  subject: SubjectId | null;
  percent: number | null;
  met: boolean;
  /** Percentage points still needed (0 if met). */
  shortBy: number;
}

export interface ProgrammeFit {
  programme: Programme;
  status: FitStatus;
  requirements: RequirementCheck[];
  aps: { have: number; need: number; shortBy: number; complete: boolean } | null;
  pass: { need: 'bachelor' | 'diploma'; estimate: PassLevel } | null;
}

/** Percentage points within which we call a requirement "close". */
export const CLOSE_POINTS = 10;
export const CLOSE_APS = 3;

export function checkProgramme(pkg: SubjectPackage, marks: Marks, programme: Programme): ProgrammeFit {
  const requirements: RequirementCheck[] = programme.subjects.map((requirement) => {
    const taken = requirement.anyOf.filter((s) => takes(pkg, s));
    if (!taken.length) return { requirement, subject: null, percent: null, met: false, shortBy: requirement.minPercent };
    // Use the best mark among the acceptable subjects the learner takes.
    const best = taken.map((s) => ({ s, p: marks[s] })).sort((a, b) => (b.p ?? -1) - (a.p ?? -1))[0]!;
    if (best.p === undefined) return { requirement, subject: best.s, percent: null, met: false, shortBy: 0 };
    const shortBy = Math.max(0, requirement.minPercent - best.p);
    return { requirement, subject: best.s, percent: best.p, met: shortBy === 0, shortBy };
  });

  let aps: ProgrammeFit['aps'] = null;
  if (programme.aps !== undefined && INSTITUTIONS[programme.institution].aps) {
    const r = standardAps(pkg, marks);
    aps = { have: r.total, need: programme.aps, shortBy: Math.max(0, programme.aps - r.total), complete: r.complete };
  }
  const pass = programme.pass ? { need: programme.pass, estimate: estimatePass(pkg, marks).level } : null;

  let status: FitStatus;
  if (requirements.some((r) => r.subject === null)) status = 'blocked';
  else if (requirements.some((r) => r.percent === null) || (aps && !aps.complete)) status = 'incomplete';
  else {
    const subjectsMet = requirements.every((r) => r.met);
    const apsMet = !aps || aps.shortBy === 0;
    const passMet = !pass || passRank(pass.estimate) >= passRank(pass.need);
    if (subjectsMet && apsMet && passMet) status = 'meets';
    else if (requirements.every((r) => r.shortBy <= CLOSE_POINTS) && (!aps || aps.shortBy <= CLOSE_APS)) status = 'close';
    else status = 'gap';
  }
  return { programme, status, requirements, aps, pass };
}

const passRank = (p: PassLevel): number => ({ 'not-yet': 0, 'higher-certificate': 1, diploma: 2, bachelor: 3 })[p];

export function programmesFor(career: Career): Programme[] {
  return career.programmes.map((id) => PROGRAMMES.find((p) => p.id === id)).filter((p): p is Programme => !!p);
}

/** The single most useful line for a learner: what to work on next for this career. */
export function biggestGap(fits: ProgrammeFit[]): { subject: SubjectId; shortBy: number; programme: Programme } | null {
  // Look at the most reachable programme first.
  const ranked = [...fits].filter((f) => f.status !== 'blocked').sort((a, b) => totalShort(a) - totalShort(b));
  const best = ranked[0];
  if (!best) return null;
  const worst = [...best.requirements].filter((r) => r.subject && r.shortBy > 0).sort((a, b) => b.shortBy - a.shortBy)[0];
  return worst && worst.subject ? { subject: worst.subject, shortBy: worst.shortBy, programme: best.programme } : null;
}

const totalShort = (f: ProgrammeFit) => f.requirements.reduce((n, r) => n + r.shortBy, 0) + (f.aps?.shortBy ?? 0) * 5;

// ---------------------------------------------------------------- Helpers for display

export function requirementLabel(r: SubjectRequirement): string {
  const names = r.anyOf.map((s) => SUBJECTS[s].name).join(' or ');
  const level = (Object.entries(LEVEL_FLOOR) as [string, number][]).find(([, floor]) => floor === r.minPercent)?.[0];
  return level ? `${names}: level ${level} (${r.minPercent}%)` : `${names}: ${r.minPercent}%`;
}

/** The highest bar a career sets for a subject across its checked programmes (for target-setting). */
export function targetFor(career: Career, subject: SubjectId): number | null {
  const bars = programmesFor(career).flatMap((p) => p.subjects.filter((r) => r.anyOf.includes(subject)).map((r) => r.minPercent));
  return bars.length ? Math.max(...bars) : null;
}

/** Lowest bar: the minimum to get in anywhere we checked. */
export function floorFor(career: Career, subject: SubjectId): number | null {
  const bars = programmesFor(career).flatMap((p) => p.subjects.filter((r) => r.anyOf.includes(subject)).map((r) => r.minPercent));
  return bars.length ? Math.min(...bars) : null;
}
