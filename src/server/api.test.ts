/**
 * End-to-end through HTTP: sign-up with guardian consent, email code, plan, marks, class join, teacher report,
 * access control, export and deletion.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, type Db } from './db.ts';
import { createApp } from './app.ts';
import { setTransport, type Mail } from './mailer.ts';
import { config } from './config.ts';
import type { ClassReport, ClassSummary, MeResponse } from '../shared/api.ts';

let server: Server;
let db: Db;
let base = '';
const inbox: Mail[] = [];

before(async () => {
  config.educatorCodes = ['TEACH-TEST'];
  config.signupMode = 'invite';
  config.inviteCodes = ['PILOT'];
  setTransport(async (m) => {
    inbox.push(m);
    return { status: 'sent' };
  });
  db = openDb(':memory:');
  server = createApp(db);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  db.close();
});

class Client {
  cookie = '';
  async call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await fetch(base + path, {
      method,
      headers: { 'x-requested-with': 'umzila', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0]!;
    return { status: res.status, data: (await res.json()) as T };
  }
}

const codeFor = (email: string) => {
  const mail = [...inbox].reverse().find((m) => m.to.email === email && /code/i.test(m.subject));
  return mail?.subject.match(/\d{6}/)?.[0] ?? '';
};

const PASSWORD = 'Ubuntu#Route77';

test('the full learner and teacher loop', async () => {
  // Teacher signs up with an educator code and creates a class.
  const teacher = new Client();
  let r = await teacher.call<MeResponse>('POST', '/api/auth/signup', { accountType: 'teacher', displayName: 'Ms Dlamini', email: 'dlamini@school.test', password: PASSWORD, consent: true, accessCode: 'teach-test', school: 'Sizwe High' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user?.role, 'teacher');
  // Unverified teachers cannot use classes yet.
  assert.equal((await teacher.call('GET', '/api/teach/classes')).status, 403);
  r = await teacher.call<MeResponse>('POST', '/api/auth/verify', { code: codeFor('dlamini@school.test') });
  assert.equal(r.data.user?.emailVerified, true);
  const cls = await teacher.call<ClassSummary>('POST', '/api/teach/classes', { name: '9B Life Orientation', grade: 9 });
  assert.equal(cls.status, 200);
  assert.match(cls.data.code, /^[A-Z2-9]{6}$/);

  // A learner under 18 needs a guardian; with a class code, no invite code is needed.
  const learner = new Client();
  const missingGuardian = await learner.call<{ error: { details: { fieldErrors: Record<string, string[]> } } }>('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Thando', email: 'thando@learner.test', password: PASSWORD, consent: true, grade: 9, ageGroup: 'minor', classCode: cls.data.code });
  assert.equal(missingGuardian.status, 422);
  assert.ok(missingGuardian.data.error.details.fieldErrors.guardianName);

  r = await learner.call<MeResponse>('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Thando', email: 'thando@learner.test', password: PASSWORD, consent: true, grade: 9, ageGroup: 'minor', guardianName: 'Nomsa', guardianEmail: 'nomsa@family.test', classCode: cls.data.code.toLowerCase() });
  assert.equal(r.status, 200);
  assert.equal(r.data.classes.length, 1);
  // Before confirming the email, plans are locked.
  assert.equal((await learner.call('PUT', '/api/plan', { grade: 9, englishIs: 'additional', maths: 'maths-lit', electives: [], careers: ['civil-engineer'] })).status, 403);
  await learner.call('POST', '/api/auth/verify', { code: codeFor('thando@learner.test') });
  assert.ok(inbox.some((m) => m.to.email === 'nomsa@family.test'), 'guardian is told about the account');

  // Thando wants to be a civil engineer but has planned Maths Lit.
  r = await learner.call<MeResponse>('PUT', '/api/plan', { grade: 9, englishIs: 'additional', maths: 'maths-lit', electives: ['life-sciences', 'geography', 'tourism'], careers: ['civil-engineer', 'teacher-stem'] });
  assert.equal(r.status, 200);
  assert.equal(r.data.plan?.careers[0], 'civil-engineer');

  let report = await teacher.call<ClassReport>('GET', `/api/teach/classes/${cls.data.id}`);
  assert.equal(report.data.summary.total, 1);
  assert.equal(report.data.learners[0]!.status, 'closed');
  assert.equal(report.data.summary.mathsLitBlocked, 1);
  assert.match(report.data.learners[0]!.flags[0]!, /civil engineer/);

  // After the conversation: Mathematics and Physical Sciences, and a term's marks.
  await learner.call('PUT', '/api/plan', { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['physical-sciences', 'geography', 'egd'], careers: ['civil-engineer'] });
  const marks = await learner.call<MeResponse>('PUT', '/api/marks', { grade: 9, term: 3, marks: { english: 64, 'other-language': 71, maths: 58, 'life-orientation': 80, 'physical-sciences': 61, geography: 66, egd: 70, tourism: 90 } });
  assert.equal(marks.status, 200);
  assert.equal(marks.data.marks[0]!.marks.tourism, undefined, 'marks for subjects outside the plan are dropped');

  report = await teacher.call<ClassReport>('GET', `/api/teach/classes/${cls.data.id}`);
  const row = report.data.learners[0]!;
  assert.equal(row.status, 'close', 'within reach of the 5-year BEng');
  assert.equal(row.gap?.shortBy, 7);
  assert.equal(row.gap?.subject, 'maths');
  assert.equal(row.aps, 5 + 6 + 4 + 5 + 5 + 6);

  // Teacher can open the learner; a stranger teacher cannot.
  assert.equal((await teacher.call('GET', `/api/teach/classes/${cls.data.id}/learners/${row.id}`)).status, 200);
  const other = new Client();
  await other.call('POST', '/api/auth/signup', { accountType: 'teacher', displayName: 'Mr Naidoo', email: 'naidoo@school.test', password: PASSWORD, consent: true, accessCode: 'TEACH-TEST' });
  await other.call('POST', '/api/auth/verify', { code: codeFor('naidoo@school.test') });
  assert.equal((await other.call('GET', `/api/teach/classes/${cls.data.id}`)).status, 404);
  assert.equal((await other.call('GET', `/api/teach/classes/${cls.data.id}/learners/${row.id}`)).status, 404);
  // Learners cannot reach teacher endpoints.
  assert.equal((await learner.call('GET', `/api/teach/classes/${cls.data.id}`)).status, 403);

  // Export and delete (POPIA).
  const exp = await learner.call<{ plan: unknown; marks: unknown[] }>('GET', '/api/account/export');
  assert.ok(exp.data.plan);
  assert.equal(exp.data.marks.length, 1);
  assert.equal((await learner.call('POST', '/api/account/delete', { password: 'wrong' })).status, 401);
  assert.equal((await learner.call('POST', '/api/account/delete', { password: PASSWORD })).status, 200);
  report = await teacher.call<ClassReport>('GET', `/api/teach/classes/${cls.data.id}`);
  assert.equal(report.data.summary.total, 0, 'deleting the account removes the learner from the class');
});

test('invite mode: a learner without a class code needs an access code', async () => {
  const c = new Client();
  const r = await c.call('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Lerato', email: 'lerato@learner.test', password: PASSWORD, consent: true, grade: 11, ageGroup: 'adult' });
  assert.equal(r.status, 403);
  const ok = await c.call('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Lerato', email: 'lerato@learner.test', password: PASSWORD, consent: true, grade: 11, ageGroup: 'adult', accessCode: 'pilot' });
  assert.equal(ok.status, 200);
});

test('requests without the CSRF header are refused, and validation messages are specific', async () => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
  const c = new Client();
  const weak = await c.call<{ error: { message: string } }>('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Sipho', email: 'sipho@learner.test', password: 'password', consent: true, grade: 10, ageGroup: 'adult', accessCode: 'PILOT' });
  assert.equal(weak.status, 422);
  assert.match(weak.data.error.message, /uppercase|number|special/i);
  const badPlan = new Client();
  await badPlan.call('POST', '/api/auth/signup', { accountType: 'learner', displayName: 'Ayanda', email: 'ayanda@learner.test', password: PASSWORD, consent: true, grade: 10, ageGroup: 'adult', accessCode: 'PILOT' });
  await badPlan.call('POST', '/api/auth/verify', { code: codeFor('ayanda@learner.test') });
  const tooMany = await badPlan.call('PUT', '/api/plan', { grade: 10, englishIs: 'home', maths: 'maths', electives: ['physical-sciences', 'tech-sciences'], careers: [] });
  assert.equal(tooMany.status, 422);
  const unknownCareer = await badPlan.call('PUT', '/api/plan', { grade: 10, englishIs: 'home', maths: 'maths', electives: [], careers: ['astronaut'] });
  assert.equal(unknownCareer.status, 422);
});
