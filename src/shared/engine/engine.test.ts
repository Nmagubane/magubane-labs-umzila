import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAREERS, careerById, FIELDS, INTERESTS } from '../data/careers.ts';
import { PROGRAMMES, INSTITUTIONS } from '../data/programmes.ts';
import { SOURCES } from '../data/sources.ts';
import { FUNDING } from '../data/funding.ts';
import { SUBJECTS, levelOf, LEVEL_FLOOR } from '../data/subjects.ts';
import { standardAps, estimatePass, checkCareerSubjects, openCount, checkProgramme, biggestGap, programmesFor, type SubjectPackage, type Marks } from './plan.ts';
import { buildRoadmap, yearsAfterSchool } from './roadmap.ts';
import { searchCareers, careersForInterests, distance } from './search.ts';

const SCIENCE: SubjectPackage = { maths: 'maths', electives: ['physical-sciences', 'life-sciences', 'geography'], englishIs: 'additional' };
const LIT: SubjectPackage = { maths: 'maths-lit', electives: ['physical-sciences', 'life-sciences', 'geography'], englishIs: 'additional' };
const COMMERCE_LIT: SubjectPackage = { maths: 'maths-lit', electives: ['accounting', 'business-studies', 'history'], englishIs: 'home' };

// ---------------------------------------------------------------- Data integrity

test('the library has 25 careers with unique ids, all fields and interests valid', () => {
  assert.equal(CAREERS.length, 25);
  assert.equal(new Set(CAREERS.map((c) => c.id)).size, CAREERS.length);
  for (const c of CAREERS) {
    assert.ok(FIELDS[c.field], `${c.id}: field`);
    assert.ok(c.interests.length > 0 && c.interests.every((i) => INTERESTS[i]), `${c.id}: interests`);
    assert.ok(c.route.length >= 2, `${c.id}: route`);
    assert.ok(c.jobs.length >= 3, `${c.id}: jobs`);
    assert.ok(c.whatYouDo.length >= 3, `${c.id}: what you do`);
    for (const n of c.school.needs) for (const s of n.anyOf) assert.ok(SUBJECTS[s], `${c.id}: subject ${s}`);
    for (const a of c.alternatives) if (a.careerId) assert.ok(careerById(a.careerId), `${c.id}: alternative ${a.careerId}`);
    for (const f of c.funding) assert.ok(FUNDING[f], `${c.id}: funding ${f}`);
    if (c.entry) assert.ok(SOURCES[c.entry.source], `${c.id}: entry source`);
  }
});

test('every career has a checked route in: programmes, or a sourced entry rule for trades', () => {
  for (const c of CAREERS) {
    assert.ok(c.programmes.length > 0 || c.entry, `${c.id} has no programme and no entry rule`);
    for (const id of c.programmes) assert.ok(PROGRAMMES.some((p) => p.id === id), `${c.id}: unknown programme ${id}`);
  }
});

test('every programme points at a real institution and source, and is linked from a career', () => {
  assert.equal(new Set(PROGRAMMES.map((p) => p.id)).size, PROGRAMMES.length);
  for (const p of PROGRAMMES) {
    assert.ok(INSTITUTIONS[p.institution], `${p.id}: institution`);
    assert.ok(SOURCES[p.source], `${p.id}: source`);
    assert.ok(p.subjects.length > 0, `${p.id}: subjects`);
    for (const r of p.subjects) {
      assert.ok(r.minPercent > 0 && r.minPercent <= 100, `${p.id}: percent`);
      for (const s of r.anyOf) assert.ok(SUBJECTS[s], `${p.id}: subject ${s}`);
    }
    // Anything from a secondary source must be flagged for review.
    if (SOURCES[p.source].kind === 'secondary') assert.ok(p.review, `${p.id}: secondary source without a review note`);
    assert.ok(CAREERS.some((c) => c.programmes.includes(p.id)), `${p.id} is not used by any career`);
  }
});

test('an essential subject is required by every programme of that career (no stricter claims than the sources)', () => {
  for (const c of CAREERS) {
    const progs = programmesFor(c);
    for (const need of c.school.needs.filter((n) => n.kind === 'essential')) {
      for (const p of progs) {
        const required = p.subjects.some((r) => r.anyOf.some((s) => need.anyOf.includes(s)));
        assert.ok(required, `${c.id}: ${need.anyOf.join('/')} is "essential" but ${p.id} does not require it`);
      }
    }
  }
});

// ---------------------------------------------------------------- Levels and APS

test('NSC levels follow the DBE scale', () => {
  assert.equal(levelOf(100), 7);
  assert.equal(levelOf(80), 7);
  assert.equal(levelOf(79), 6);
  assert.equal(levelOf(50), 4);
  assert.equal(levelOf(49), 3);
  assert.equal(levelOf(30), 2);
  assert.equal(levelOf(29), 1);
  assert.equal(LEVEL_FLOOR[5], 60);
});

test('APS counts six subjects, excludes Life Orientation, max 42', () => {
  const marks: Marks = { english: 65, 'other-language': 72, maths: 81, 'life-orientation': 95, 'physical-sciences': 58, 'life-sciences': 70, geography: 49 };
  const r = standardAps(SCIENCE, marks);
  // 5 + 6 + 7 + 4 + 6 + 3 = 31; LO 95% would have added 7.
  assert.equal(r.total, 31);
  assert.equal(r.counted.length, 6);
  assert.equal(r.complete, true);
  assert.equal(r.max, 42);
  assert.equal(standardAps(SCIENCE, { maths: 90 }).complete, false);
});

// ---------------------------------------------------------------- Pass estimate

test('pass estimate: bachelor, diploma, higher certificate, not yet', () => {
  const base: Marks = { english: 55, 'other-language': 60, maths: 52, 'life-orientation': 60, 'physical-sciences': 51, 'life-sciences': 45, geography: 40 };
  assert.equal(estimatePass(SCIENCE, base).level, 'bachelor');
  assert.equal(estimatePass(SCIENCE, { ...base, 'physical-sciences': 45 }).level, 'diploma');
  assert.equal(estimatePass(SCIENCE, { ...base, english: 42, maths: 41, 'physical-sciences': 35, 'life-sciences': 35, geography: 35 }).level, 'higher-certificate');
  // Home Language below 40% (English is the additional language here, so the other language is HL).
  assert.equal(estimatePass(SCIENCE, { ...base, 'other-language': 38 }).level, 'not-yet');
  // Two subjects below 30%: fails "six of seven".
  assert.equal(estimatePass(SCIENCE, { ...base, geography: 20, 'life-sciences': 25 }).level, 'not-yet');
  // LO does not count toward the four subjects at 50%.
  assert.equal(estimatePass(SCIENCE, { ...base, maths: 45, 'life-orientation': 90 }).level, 'diploma');
});

// ---------------------------------------------------------------- Subject choice

test('Mathematical Literacy closes engineering, medicine and CA, but not law', () => {
  for (const id of ['civil-engineer', 'doctor', 'chartered-accountant', 'actuary', 'software-developer', 'electrician']) {
    assert.equal(checkCareerSubjects(LIT, careerById(id)!).status, 'closed', id);
    assert.notEqual(checkCareerSubjects(SCIENCE, careerById(id)!).status, 'closed', id);
  }
  assert.notEqual(checkCareerSubjects(COMMERCE_LIT, careerById('lawyer')!).status, 'closed');
});

test('the Maths vs Maths Literacy swap is visible as a count of open careers', () => {
  const withMaths = openCount(SCIENCE);
  const withLit = openCount(LIT);
  assert.ok(withMaths > withLit + 15, `maths ${withMaths} vs lit ${withLit}`);
  assert.equal(withMaths, CAREERS.length, 'a maths + physics + life sciences package keeps every route open');
});

test('missing a recommended subject keeps a route open but weaker', () => {
  const noLife: SubjectPackage = { maths: 'maths', electives: ['physical-sciences', 'geography', 'history'], englishIs: 'home' };
  assert.equal(checkCareerSubjects(noLife, careerById('doctor')!).status, 'open-weaker');
  assert.equal(checkCareerSubjects(noLife, careerById('pharmacist')!).status, 'closed');
});

// ---------------------------------------------------------------- Programme fit

test('programme fit: meets, close, gap, blocked, incomplete', () => {
  const mbchb = PROGRAMMES.find((p) => p.id === 'up-mbchb')!;
  const strong: Marks = { english: 68, 'other-language': 70, maths: 78, 'life-orientation': 80, 'physical-sciences': 72, 'life-sciences': 75, geography: 70 };
  assert.equal(checkProgramme(SCIENCE, strong, mbchb).status, 'meets');
  const close: Marks = { ...strong, maths: 64 };
  assert.equal(checkProgramme(SCIENCE, close, mbchb).status, 'close');
  const gap: Marks = { ...strong, maths: 45, 'physical-sciences': 40, english: 50 };
  assert.equal(checkProgramme(SCIENCE, gap, mbchb).status, 'gap');
  assert.equal(checkProgramme(LIT, strong, mbchb).status, 'blocked');
  assert.equal(checkProgramme(SCIENCE, { maths: 80 }, mbchb).status, 'incomplete');
});

test('an APS shortfall beyond 3 points is a gap even when subjects are met', () => {
  const llb = PROGRAMMES.find((p) => p.id === 'up-llb')!;
  const marks: Marks = { english: 75, 'other-language': 60, 'maths-lit': 60, 'life-orientation': 70, accounting: 55, 'business-studies': 60, history: 60 };
  const fit = checkProgramme(COMMERCE_LIT, marks, llb);
  // 6 + 5 + 5 + 4 + 5 + 5 = 30 < 35
  assert.equal(fit.aps?.have, 30);
  assert.equal(fit.aps?.shortBy, 5);
  assert.equal(fit.status, 'gap');
});

test('biggest gap points at the subject that matters most', () => {
  const doctor = careerById('doctor')!;
  const marks: Marks = { english: 66, 'other-language': 70, maths: 58, 'life-orientation': 80, 'physical-sciences': 61, 'life-sciences': 75, geography: 70 };
  const fits = programmesFor(doctor).map((p) => checkProgramme(SCIENCE, marks, p));
  const g = biggestGap(fits);
  assert.equal(g?.subject, 'maths');
  assert.equal(g?.shortBy, 12);
});

test('UKZN pharmacy asks for a Bachelor pass and Life Orientation, and the engine checks both', () => {
  const p = PROGRAMMES.find((x) => x.id === 'ukzn-bpharm')!;
  const marks: Marks = { english: 55, 'other-language': 60, maths: 55, 'life-orientation': 45, 'physical-sciences': 55, 'life-sciences': 55, geography: 50 };
  const fit = checkProgramme(SCIENCE, marks, p);
  assert.equal(fit.status, 'close');
  assert.equal(fit.requirements.find((r) => r.subject === 'life-orientation')?.shortBy, 5);
  assert.equal(fit.pass?.estimate, 'bachelor');
});

// ---------------------------------------------------------------- Roadmap

test('a Grade 9 roadmap starts with the subject decision and ends with registration', () => {
  const r = buildRoadmap({ career: careerById('civil-engineer')!, grade: 9, pkg: SCIENCE });
  assert.equal(r[0]!.kind, 'decision');
  assert.ok(r.some((m) => m.kind === 'target' && m.target?.subject === 'maths' && m.target.minimum === 70 && m.target.aim === 80 && /UP asks for at least 70%/.test(m.detail)));
  assert.equal(r.at(-1)!.kind, 'register');
  assert.ok(r.every((m) => m.kind !== 'warning'));
});

test('a closed route is the first milestone, with advice that depends on the grade', () => {
  const r9 = buildRoadmap({ career: careerById('doctor')!, grade: 9, pkg: LIT });
  assert.equal(r9[0]!.kind, 'warning');
  assert.match(r9[0]!.title, /Mathematics/);
  assert.match(r9[0]!.detail, /switch/);
  const r12 = buildRoadmap({ career: careerById('doctor')!, grade: 12, pkg: LIT });
  assert.match(r12[0]!.detail, /other ways in/);
  assert.ok(!r12.some((m) => m.phase === 'grade-9' || m.phase === 'grade-10' || m.phase === 'grade-11'));
});

test('targets skip subjects a learner does not take, and carry current marks', () => {
  const r = buildRoadmap({ career: careerById('nurse')!, grade: 10, pkg: SCIENCE, marks: { 'life-sciences': 62 } });
  const life = r.find((m) => m.target?.subject === 'life-sciences');
  assert.equal(life?.target?.current, 62);
  assert.ok(!r.some((m) => m.target?.subject === 'life-orientation'));
  assert.ok(!r.some((m) => m.target?.subject === 'tech-maths'));
});

test('years after school exclude optional steps', () => {
  assert.equal(yearsAfterSchool(careerById('doctor')!), 9);
  assert.equal(yearsAfterSchool(careerById('civil-technician')!), 6);
  assert.equal(yearsAfterSchool(careerById('software-developer')!), 3);
});

// ---------------------------------------------------------------- Search

test('search understands names, aliases, typos and phrases', () => {
  const top = (q: string) => searchCareers(q)[0]?.career.id;
  assert.equal(top('doctor'), 'doctor');
  assert.equal(top('dokotela'), 'doctor');
  assert.equal(top('I want to be a doctor'), 'doctor');
  assert.equal(top('pharmasist'), 'pharmacist');
  assert.equal(top('build bridges'), 'civil-engineer');
  assert.equal(top('CA'), 'chartered-accountant');
  assert.equal(top('physio'), 'physiotherapist');
  assert.equal(top('vet'), 'vet');
  assert.ok(searchCareers('engineer').filter((h) => h.career.field === 'engineering').length >= 5);
  assert.deepEqual(searchCareers(''), []);
  assert.deepEqual(searchCareers('zzzzqqq'), []);
});

test('typo distance is capped and symmetric enough for search', () => {
  assert.equal(distance('pharmasist', 'pharmacist'), 1);
  assert.equal(distance('enjineer', 'engineer'), 1);
  assert.equal(distance('a', 'abcdef'), 3);
});

test('interests rank careers by overlap', () => {
  const r = careersForInterests(['animals-nature', 'helping-people']);
  assert.equal(r[0]?.career.id, 'vet');
  assert.deepEqual(careersForInterests([]), []);
});
