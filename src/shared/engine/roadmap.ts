/**
 * Turns "I want to become X" + "I'm in Grade N" into an ordered route: decisions, mark targets, deadlines and the
 * post-school stations. Facts about dates come from the funding and programme data; nothing here is invented per learner.
 */
import type { Career, Station } from '../data/careers.ts';
import { FUNDING } from '../data/funding.ts';
import { INSTITUTIONS } from '../data/programmes.ts';
import { SUBJECTS, type SubjectId } from '../data/subjects.ts';
import { checkCareerSubjects, programmesFor, type SubjectPackage, type Marks } from './plan.ts';

export type Grade = 9 | 10 | 11 | 12;
export type Phase = 'grade-9' | 'grade-10' | 'grade-11' | 'grade-12' | 'after';

export interface Milestone {
  phase: Phase;
  kind: 'warning' | 'decision' | 'target' | 'action' | 'deadline' | 'funding' | Station['kind'];
  title: string;
  detail: string;
  years?: number;
  /** For targets: the subject and the number to aim for. */
  target?: { subject: SubjectId; minimum: number; aim: number; current?: number };
}

export const PHASE_LABEL: Record<Phase, string> = {
  'grade-9': 'Grade 9',
  'grade-10': 'Grade 10',
  'grade-11': 'Grade 11',
  'grade-12': 'Grade 12',
  after: 'After school',
};

/** Selection is competitive: aim above the published minimum. The margin is shown, never hidden inside the number. */
export const AIM_MARGIN = 10;

export function buildRoadmap(input: { career: Career; grade: Grade; pkg?: SubjectPackage | null; marks?: Marks }): Milestone[] {
  const { career, grade, pkg, marks = {} } = input;
  const out: Milestone[] = [];
  const check = pkg ? checkCareerSubjects(pkg, career) : null;
  const essentials = career.school.needs.filter((n) => n.kind === 'essential');
  const recommended = career.school.needs.filter((n) => n.kind === 'recommended');
  const names = (ids: SubjectId[]) => ids.map((s) => SUBJECTS[s].name).join(' or ');

  // A closed route is the first thing a learner must see, whatever their grade.
  if (check?.status === 'closed') {
    const missing = check.missingEssential.map((n) => names(n.anyOf)).join(', ');
    out.push({
      phase: grade <= 9 ? 'grade-9' : (`grade-${grade}` as Phase),
      kind: 'warning',
      title: `Your subjects close the usual route: you need ${missing}`,
      detail:
        grade <= 10
          ? 'Talk to your school now. Changing subjects gets harder every term, and many schools do not allow a switch from Mathematical Literacy back to Mathematics later.'
          : 'Look at the other ways in below. Some people also rewrite or add a subject after school.',
    });
  }

  if (grade <= 9) {
    out.push({
      phase: 'grade-9',
      kind: 'decision',
      title: 'Choose your Grade 10 subjects',
      detail: [
        essentials.length ? `Must have: ${essentials.map((n) => names(n.anyOf)).join(', ')}.` : 'No specific school subject is required for this route.',
        recommended.length ? `Helps: ${recommended.map((n) => names(n.anyOf)).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    if (essentials.some((n) => n.anyOf.includes('maths'))) {
      out.push({
        phase: 'grade-9',
        kind: 'action',
        title: 'Ask what Grade 9 Maths mark your school needs',
        detail: 'Many schools only let you take Mathematics in Grade 10 if your Grade 9 Maths mark is high enough. Find out the cut-off now, while there is still time to reach it.',
      });
    }
  }

  // Mark targets: the main programme's published minimum (the first one listed for the career), plus a margin.
  const progs = programmesFor(career);
  const targetSubjects = uniqueSubjects(progs.flatMap((p) => p.subjects.flatMap((r) => r.anyOf)));
  const targets: Milestone[] = targetSubjects.flatMap((subject) => {
    if (subject === 'life-orientation') return [];
    if (pkg && !pkgTakes(pkg, subject)) return [];
    const reference = progs.find((p) => p.subjects.some((r) => r.anyOf.includes(subject)));
    const minimum = reference?.subjects.find((r) => r.anyOf.includes(subject))?.minPercent;
    if (!reference || minimum === undefined) return [];
    const aim = Math.min(100, minimum + AIM_MARGIN);
    const current = marks[subject];
    const otherBars = progs.filter((p) => p !== reference).flatMap((p) => p.subjects.filter((r) => r.anyOf.includes(subject)).map((r) => r.minPercent));
    const low = otherBars.length ? Math.min(...otherBars) : null;
    const high = otherBars.length ? Math.max(...otherBars) : null;
    const others = low !== null && high !== null ? ` Other programmes we checked ask for ${low === high ? `${low}%` : `${low}% to ${high}%`}.` : '';
    return [
      {
        phase: (grade <= 10 ? 'grade-10' : `grade-${grade}`) as Phase,
        kind: 'target' as const,
        title: `${SUBJECTS[subject].name}: aim for ${aim}%`,
        detail: `${reference.name} at ${INSTITUTIONS[reference.institution].short} asks for at least ${minimum}%.${others} Places are competitive, so aim above the minimum.`,
        target: { subject, minimum, aim, ...(current !== undefined ? { current } : {}) },
      },
    ];
  });
  out.push(...targets);

  if (grade <= 10) {
    out.push({
      phase: 'grade-10',
      kind: 'action',
      title: `Meet someone who works as a ${career.name.toLowerCase()}`,
      detail: 'Ask to shadow them for a day, or ask your Life Orientation teacher to help. It is the fastest way to find out if you really want this.',
    });
  }

  if (grade <= 11) {
    out.push({
      phase: 'grade-11',
      kind: 'action',
      title: 'Your Grade 11 results matter more than you think',
      detail: 'Many universities make early, conditional offers using final Grade 11 results, and some bursaries look only at Grade 11.',
    });
    if (career.funding.includes('thuthuka')) {
      out.push({ phase: 'grade-11', kind: 'funding', title: 'Thuthuka needs 60% for Mathematics in Grade 11', detail: FUNDING.thuthuka.conditions.join(' ') });
    }
    out.push({
      phase: 'grade-11',
      kind: 'action',
      title: 'Download the prospectuses',
      detail: `Requirements change every year. Check the newest prospectus for each place you want to apply to${programmesFor(career).length ? `, starting with ${uniqueInstitutions(career).join(', ')}` : ''}.`,
    });
  }

  if (grade <= 12) {
    out.push({
      phase: 'grade-12',
      kind: 'deadline',
      title: 'Apply early in Grade 12',
      detail: 'Applications usually open around April. Closing dates differ: for the 2027 intake, UP closed on 30 June 2026 and UJ on 31 October 2026. Health science and veterinary programmes close earliest.',
    });
    out.push({
      phase: 'grade-12',
      kind: 'action',
      title: 'Check for the National Benchmark Tests (NBT)',
      detail: 'Many programmes and bursaries ask for NBT results. Check each application and book a test date early.',
    });
    for (const id of career.funding) {
      const f = FUNDING[id];
      out.push({ phase: 'grade-12', kind: 'funding', title: f.name, detail: `${f.who} ${f.lastCycle}` });
    }
  }

  for (const s of career.route) {
    out.push({ phase: 'after', kind: s.kind, title: s.title, detail: s.detail, ...(s.years ? { years: s.years } : {}) });
  }
  return out;
}

function uniqueSubjects(ids: SubjectId[]): SubjectId[] {
  // English first, then Mathematics, then the rest: the order a learner thinks in.
  const order: SubjectId[] = ['english', 'maths', 'tech-maths', 'physical-sciences', 'life-sciences'];
  return [...new Set(ids)].sort((a, b) => rank(a, order) - rank(b, order));
}
const rank = (id: SubjectId, order: SubjectId[]) => (order.includes(id) ? order.indexOf(id) : order.length);

function pkgTakes(pkg: SubjectPackage, s: SubjectId): boolean {
  return s === 'english' || s === 'other-language' || s === 'life-orientation' || s === pkg.maths || pkg.electives.includes(s as never);
}

function uniqueInstitutions(career: Career): string[] {
  return [...new Set(programmesFor(career).map((p) => INSTITUTIONS[p.institution].short))];
}

/** Years of study and supervised training after school on the main route (optional steps excluded). */
export function yearsAfterSchool(career: Career): number {
  return career.route.filter((s) => (s.kind === 'study' || s.kind === 'practice' || s.kind === 'exam') && !s.title.includes('(optional)')).reduce((n, s) => n + (s.years ?? 0), 0);
}
