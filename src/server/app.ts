import { createServer, type Server } from 'node:http';
import type { Db } from './db.ts';
import { one } from './db.ts';
import { Router, HttpError, readJson, sendJson, parseCookies, setCookie, securityHeaders, serveStatic, RateLimiter, type Ctx } from './http.ts';
import { config } from './config.ts';
import { createSession, destroySession, destroyAllSessions, userForSession, createUser, deleteUser, verifyPassword, burnPasswordCheck, markEmailVerified, setPassword, getUser, toUserDto, USER_COLS, canAccessLearner, type UserRow } from './auth.ts';
import { sendVerificationEmail, sendResetEmail, checkCode, logged } from './verification.ts';
import { sendMail, layout } from './mailer.ts';
import { getPlan, savePlan, listMarks, saveMarks } from './plans.ts';
import { requireTeacher, listClasses, createClass, archiveClass, classReport, findClassByCode, joinClass, leaveClass, myClasses, removeMember, teacherLearner } from './classes.ts';
import { SignupBody, LoginBody, VerifyBody, ForgotBody, ResetBody, DeleteAccountBody, PlanBody, MarksBody, CreateClassBody, JoinClassBody, PRIVACY_VERSION, type MeResponse, type PublicConfig, type UserDto } from '../shared/api.ts';
import { passwordProblem } from '../shared/password.ts';
import type { Marks } from '../shared/engine/plan.ts';

const COOKIE = 'um_session';
const loginLimiter = new RateLimiter(10, 15 * 60_000);
// Generous per network: a whole class behind one school IP may sign up in the same lesson.
const signupLimiter = new RateLimiter(config.signupRatePerHour, 60 * 60_000);
const codeLimiter = new RateLimiter(20, 15 * 60_000);
const forgotLimiter = new RateLimiter(5, 15 * 60_000);

/** While an email is unconfirmed, only these endpoints work. */
const UNVERIFIED_OK = new Set(['/api/me', '/api/config', '/api/auth/verify', '/api/auth/resend', '/api/auth/logout', '/api/account/delete', '/api/health']);

function requireUser(ctx: Ctx): UserDto {
  if (!ctx.user) throw new HttpError(401, 'unauthenticated', 'Please log in.');
  return ctx.user;
}
function requireLearner(ctx: Ctx): UserDto {
  const u = requireUser(ctx);
  if (u.role !== 'learner') throw new HttpError(403, 'not_learner', 'This is for learner accounts.');
  return u;
}

function startSession(ctx: Ctx, db: Db, userId: string): void {
  setCookie(ctx.res, COOKIE, createSession(db, userId, config.sessionDays), { maxAge: config.sessionDays * 86400, secure: !config.dev });
}

/** POPIA: a guardian is told once a learner under 18 has confirmed their account. */
async function noticeToGuardian(db: Db, userId: string): Promise<void> {
  const g = one<{ display_name: string; is_minor: number; guardian_email: string | null; guardian_name: string | null }>(db, 'SELECT display_name, is_minor, guardian_email, guardian_name FROM users WHERE id = ?', userId);
  if (!g?.is_minor || !g.guardian_email) return;
  const { html, text } = layout({
    heading: `${g.display_name} is planning their career on Umzila`,
    paragraphs: [
      `Hello${g.guardian_name ? ` ${g.guardian_name}` : ''}. ${g.display_name} has created an account on Umzila, a career and subject-choice planner by Magubane Labs, and gave your email address as their parent or guardian.`,
      'Umzila keeps their grade, subject choices, career goals and the term marks they enter. It does not keep ID numbers, addresses or phone numbers, and it never sells or shares data with advertisers or bursary providers.',
      `If you did not agree to this, reply to this email${config.contactEmail ? ` or write to ${config.contactEmail}` : ''} and we will delete the account and all its data.`,
    ],
    button: { label: 'Read the privacy notice', url: `${config.publicUrl}/privacy` },
  });
  logged(db, userId, g.guardian_email, 'guardian-welcome', await sendMail({ to: { email: g.guardian_email, ...(g.guardian_name ? { name: g.guardian_name } : {}) }, subject: `${g.display_name} joined Umzila`, html, text }));
}

export function buildRouter(db: Db): Router {
  const r = new Router();
  const me = (u: UserDto | null): MeResponse => ({
    user: u,
    plan: u && u.role === 'learner' ? getPlan(db, u.id) : null,
    marks: u && u.role === 'learner' ? listMarks(db, u.id) : [],
    classes: u && u.role === 'learner' ? myClasses(db, u.id) : [],
  });

  // ---------------------------------------------------------------- auth
  r.post('/api/auth/signup', async (ctx) => {
    if (!signupLimiter.take(ctx.ip)) throw new HttpError(429, 'rate_limited', 'Too many sign-ups from this network. Try again later.');
    if (config.signupMode === 'closed') throw new HttpError(403, 'signup_closed', 'Sign-ups are closed at the moment.');
    const body = await readJson(ctx, SignupBody);
    let inviteCode: string | null = null;
    let joinCode: string | null = null;
    if (body.accountType === 'teacher') {
      if (!config.educatorCodes.length) throw new HttpError(403, 'educator_closed', `Teacher accounts aren't open yet.${config.contactEmail ? ` Write to ${config.contactEmail} to join the pilot.` : ''}`);
      inviteCode = (body.accessCode ?? '').toUpperCase();
      if (!config.educatorCodes.includes(inviteCode)) throw new HttpError(403, 'bad_access_code', "That educator code isn't valid.", { fieldErrors: { accessCode: ["That educator code isn't valid"] } });
    } else {
      const cls = body.classCode ? findClassByCode(db, body.classCode) : undefined;
      if (body.classCode && !cls) throw new HttpError(404, 'unknown_class', 'No class has that code. Check it with your teacher.', { fieldErrors: { classCode: ['No class has that code'] } });
      if (cls) joinCode = cls.join_code;
      else if (config.signupMode === 'invite') {
        inviteCode = (body.accessCode ?? '').toUpperCase();
        if (!inviteCode || !config.inviteCodes.includes(inviteCode)) throw new HttpError(403, 'bad_access_code', 'You need a class code from your teacher, or an access code.', { fieldErrors: { classCode: ['Enter your class code'] } });
      }
    }
    if (one(db, 'SELECT 1 FROM users WHERE email = ?', body.email)) throw new HttpError(409, 'email_taken', 'An account with that email already exists. Log in instead.');
    const minor = body.accountType === 'learner' && body.ageGroup === 'minor';
    const user = createUser(db, {
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: body.accountType,
      school: body.accountType === 'teacher' ? (body.school ?? null) : null,
      inviteCode,
      isMinor: minor,
      guardianName: minor ? (body.guardianName ?? null) : null,
      guardianEmail: minor ? (body.guardianEmail ?? null) : null,
      consentVersion: PRIVACY_VERSION,
    });
    startSession(ctx, db, user.id);
    if (joinCode) joinClass(db, user, joinCode);
    await sendVerificationEmail(db, user).catch((e) => console.error('[signup] verification email failed', e));
    return me(user);
  });

  r.post('/api/auth/verify', async (ctx) => {
    const user = requireUser(ctx);
    if (user.emailVerified) return me(user);
    if (!codeLimiter.take(`${ctx.ip}:${user.id}`)) throw new HttpError(429, 'rate_limited', 'Too many tries. Wait a few minutes.');
    const body = await readJson(ctx, VerifyBody);
    checkCode(db, user.id, 'verify', body.code);
    markEmailVerified(db, user.id);
    await noticeToGuardian(db, user.id).catch((e) => console.error('[verify] guardian notice failed', e));
    return me(getUser(db, user.id));
  });

  r.post('/api/auth/resend', async (ctx) => {
    const user = requireUser(ctx);
    if (user.emailVerified) throw new HttpError(400, 'already_verified', 'Your email is already confirmed.');
    const res = await sendVerificationEmail(db, user);
    return { ok: true, delivery: res.status };
  });

  r.post('/api/auth/login', async (ctx) => {
    const body = await readJson(ctx, LoginBody);
    if (!loginLimiter.take(`${ctx.ip}:${body.email}`)) throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait 15 minutes and try again.');
    const row = one<UserRow & { password_hash: string }>(db, `SELECT ${USER_COLS}, password_hash FROM users WHERE email = ?`, body.email);
    if (!row) {
      burnPasswordCheck(body.password);
      throw new HttpError(401, 'bad_credentials', "That email and password don't match.");
    }
    if (!verifyPassword(body.password, row.password_hash)) throw new HttpError(401, 'bad_credentials', "That email and password don't match.");
    startSession(ctx, db, row.id);
    const user = toUserDto(row);
    if (!user.emailVerified) await sendVerificationEmail(db, user).catch(() => undefined);
    return me(user);
  });

  r.post('/api/auth/logout', (ctx) => {
    const token = parseCookies(ctx.req.headers.cookie)[COOKIE];
    if (token) destroySession(db, token);
    setCookie(ctx.res, COOKIE, '', { maxAge: 0, secure: !config.dev });
    return { ok: true };
  });

  r.post('/api/auth/forgot', async (ctx) => {
    if (!forgotLimiter.take(ctx.ip)) throw new HttpError(429, 'rate_limited', 'Too many requests. Wait 15 minutes and try again.');
    const body = await readJson(ctx, ForgotBody);
    const row = one<UserRow>(db, `SELECT ${USER_COLS} FROM users WHERE email = ?`, body.email);
    // The same answer whether or not the account exists, so this can't be used to find out who has an account.
    if (row) await sendResetEmail(db, toUserDto(row)).catch((e) => (e instanceof HttpError ? undefined : console.error('[forgot]', e)));
    return { ok: true };
  });

  r.post('/api/auth/reset', async (ctx) => {
    if (!codeLimiter.take(ctx.ip)) throw new HttpError(429, 'rate_limited', 'Too many tries. Wait a few minutes.');
    const body = await readJson(ctx, ResetBody);
    const row = one<UserRow>(db, `SELECT ${USER_COLS} FROM users WHERE email = ?`, body.email);
    if (!row) throw new HttpError(400, 'code_expired', 'That code has expired. Ask for a new one.');
    const problem = passwordProblem(body.password, { email: row.email, name: row.display_name });
    if (problem) throw new HttpError(422, 'invalid', problem, { fieldErrors: { password: [problem] } });
    checkCode(db, row.id, 'reset', body.code);
    setPassword(db, row.id, body.password);
    markEmailVerified(db, row.id);
    destroyAllSessions(db, row.id);
    startSession(ctx, db, row.id);
    return me(getUser(db, row.id));
  });

  r.get('/api/config', () => ({ signupMode: config.signupMode, teacherSignup: config.educatorCodes.length > 0, contactEmail: config.contactEmail, privacyVersion: PRIVACY_VERSION }) satisfies PublicConfig);
  r.get('/api/me', (ctx) => me(ctx.user));

  // ---------------------------------------------------------------- account (POPIA: access and deletion)
  r.get('/api/account/export', (ctx) => {
    const user = requireUser(ctx);
    const row = one(db, 'SELECT email, display_name, role, school, created_at, email_verified_at, is_minor, guardian_name, guardian_email, consent_at, consent_version FROM users WHERE id = ?', user.id);
    return { exportedAt: new Date().toISOString(), account: row, plan: getPlan(db, user.id), marks: listMarks(db, user.id), classes: user.role === 'learner' ? myClasses(db, user.id) : listClasses(db, user.id) };
  });

  r.post('/api/account/delete', async (ctx) => {
    const user = requireUser(ctx);
    const body = await readJson(ctx, DeleteAccountBody);
    const row = one<{ password_hash: string }>(db, 'SELECT password_hash FROM users WHERE id = ?', user.id);
    if (!row || !verifyPassword(body.password, row.password_hash)) throw new HttpError(401, 'bad_credentials', "That password isn't right.", { fieldErrors: { password: ["That password isn't right"] } });
    deleteUser(db, user.id);
    setCookie(ctx.res, COOKIE, '', { maxAge: 0, secure: !config.dev });
    return { ok: true };
  });

  // ---------------------------------------------------------------- learner plan
  r.put('/api/plan', async (ctx) => {
    const user = requireLearner(ctx);
    const body = await readJson(ctx, PlanBody);
    savePlan(db, user.id, body);
    return me(user);
  });

  r.put('/api/marks', async (ctx) => {
    const user = requireLearner(ctx);
    const body = await readJson(ctx, MarksBody);
    saveMarks(db, user.id, body.grade, body.term, body.marks as Marks, getPlan(db, user.id));
    return me(user);
  });

  r.post('/api/classes/join', async (ctx) => {
    const user = requireLearner(ctx);
    const body = await readJson(ctx, JoinClassBody);
    joinClass(db, user, body.code);
    return me(user);
  });

  r.delete('/api/classes/:id/membership', (ctx) => {
    const user = requireLearner(ctx);
    leaveClass(db, user.id, ctx.params.id as string);
    return me(user);
  });

  // ---------------------------------------------------------------- teacher
  r.get('/api/teach/classes', (ctx) => listClasses(db, requireTeacher(ctx.user).id));
  r.post('/api/teach/classes', async (ctx) => {
    const t = requireTeacher(ctx.user);
    const body = await readJson(ctx, CreateClassBody);
    return createClass(db, t.id, body.name, body.grade);
  });
  r.get('/api/teach/classes/:id', (ctx) => classReport(db, requireTeacher(ctx.user).id, ctx.params.id as string));
  r.delete('/api/teach/classes/:id', (ctx) => {
    archiveClass(db, requireTeacher(ctx.user).id, ctx.params.id as string);
    return { ok: true };
  });
  r.get('/api/teach/classes/:id/learners/:learnerId', (ctx) => {
    const t = requireTeacher(ctx.user);
    const learnerId = ctx.params.learnerId as string;
    if (!canAccessLearner(db, t, learnerId)) throw new HttpError(404, 'not_found', 'Learner not found in this class.');
    return teacherLearner(db, t.id, ctx.params.id as string, learnerId);
  });
  r.delete('/api/teach/classes/:id/learners/:learnerId', (ctx) => {
    removeMember(db, requireTeacher(ctx.user).id, ctx.params.id as string, ctx.params.learnerId as string);
    return { ok: true };
  });

  r.get('/api/health', () => ({ ok: true }));
  return r;
}

function clientIp(req: import('node:http').IncomingMessage): string {
  if (config.trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function createApp(db: Db): Server {
  const router = buildRouter(db);
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    securityHeaders(res, config.dev);
    if (!url.pathname.startsWith('/api/')) {
      if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, config.clientDir, url.pathname)) return;
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const ctx: Ctx = { req, res, params: {}, query: url.searchParams, user: userForSession(db, parseCookies(req.headers.cookie)[COOKIE]), ip: clientIp(req) };
    try {
      // CSRF: state-changing requests must carry our header (cross-site forms can't set it; SameSite=Lax covers the rest).
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-requested-with'] !== 'umzila') throw new HttpError(403, 'csrf', 'Missing request header.');
      if (ctx.user && !ctx.user.emailVerified && !UNVERIFIED_OK.has(url.pathname)) throw new HttpError(403, 'email_unverified', 'Confirm your email address first.');
      const match = router.match(req.method ?? 'GET', url.pathname);
      if (match === null) throw new HttpError(404, 'not_found', 'No such endpoint.');
      if (match === 'method') throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
      ctx.params = match.params;
      sendJson(res, 200, (await match.handler(ctx)) ?? { ok: true });
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { code: e.code, message: e.message, ...(e.details !== undefined && e.status < 500 ? { details: e.details } : {}) } });
      } else {
        console.error('[server]', e);
        sendJson(res, 500, { error: { code: 'internal', message: 'Something went wrong on our side. Try again.' } });
      }
    }
  });
}
