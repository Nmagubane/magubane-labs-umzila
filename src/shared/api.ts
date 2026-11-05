/**
 * The API contract: request schemas (validated on the server) and response shapes (used by the client).
 */
import { z } from 'zod';
import { passwordProblem } from './password.ts';
import { CAREERS } from './data/careers.ts';
import { ELECTIVES, MATHS_OPTIONS, SUBJECTS, type ElectiveId, type MathsId, type SubjectId } from './data/subjects.ts';

export const PRIVACY_VERSION = '2026-11-06';
export const MAX_CAREERS = 3;

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(200);
const name = z.string().trim().min(1, 'Enter a name').max(80);
const careerId = z.string().refine((id) => CAREERS.some((c) => c.id === id), 'Unknown career');
const grade = z.number().int().min(9, 'Umzila is for Grades 9 to 12').max(12, 'Umzila is for Grades 9 to 12');

export const SignupBody = z
  .object({
    accountType: z.enum(['learner', 'teacher']),
    displayName: name,
    email,
    password: z.string().max(128),
    grade: grade.optional(),
    ageGroup: z.enum(['minor', 'adult']).optional(),
    guardianName: z.string().trim().max(80).optional(),
    guardianEmail: z.string().trim().toLowerCase().max(200).optional(),
    consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the privacy notice to continue' }) }),
    accessCode: z.string().trim().max(40).optional(),
    classCode: z.string().trim().max(12).optional(),
    school: z.string().trim().max(120).optional(),
  })
  .superRefine((b, ctx) => {
    const problem = passwordProblem(b.password, { email: b.email, name: b.displayName });
    if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
    if (b.accountType === 'learner') {
      if (b.grade === undefined) ctx.addIssue({ code: 'custom', path: ['grade'], message: 'Choose your grade' });
      if (!b.ageGroup) ctx.addIssue({ code: 'custom', path: ['ageGroup'], message: 'Tell us whether you are under 18' });
      if (b.ageGroup === 'minor') {
        if (!b.guardianName) ctx.addIssue({ code: 'custom', path: ['guardianName'], message: "Enter your parent or guardian's name" });
        if (!b.guardianEmail || !z.string().email().safeParse(b.guardianEmail).success) ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: "Enter your parent or guardian's email" });
        else if (b.guardianEmail === b.email) ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: "Use your parent or guardian's own email, not yours" });
      }
    }
  });
export type SignupBody = z.infer<typeof SignupBody>;

export const LoginBody = z.object({ email, password: z.string().min(1, 'Enter your password').max(128) });
export const VerifyBody = z.object({ code: z.string().trim().min(6).max(12) });
export const ForgotBody = z.object({ email });
export const ResetBody = z.object({ email, code: z.string().trim().min(6).max(12), password: z.string().max(128) }).superRefine((b, ctx) => {
  const problem = passwordProblem(b.password, { email: b.email });
  if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
});
export const DeleteAccountBody = z.object({ password: z.string().min(1).max(128) });

const mathsId = z.enum(MATHS_OPTIONS as [MathsId, ...MathsId[]]);
const electiveId = z.enum(ELECTIVES as [ElectiveId, ...ElectiveId[]]);

export const PlanBody = z.object({
  grade,
  englishIs: z.enum(['home', 'additional']),
  maths: mathsId,
  electives: z
    .array(electiveId)
    .max(3, 'Choose up to three electives')
    .refine((a) => new Set(a).size === a.length, 'Choose each subject once')
    .refine((a) => !(a.includes('physical-sciences') && a.includes('tech-sciences')), 'Choose Physical Sciences or Technical Sciences, not both'),
  careers: z.array(careerId).max(MAX_CAREERS, `Choose up to ${MAX_CAREERS} careers`).refine((a) => new Set(a).size === a.length, 'Choose each career once'),
});
export type PlanBody = z.infer<typeof PlanBody>;

const SUBJECT_IDS = Object.keys(SUBJECTS) as SubjectId[];
export const MarksBody = z.object({
  grade,
  term: z.number().int().min(1).max(4),
  marks: z
    .record(z.string(), z.number().min(0, 'Marks are between 0 and 100').max(100, 'Marks are between 0 and 100'))
    .refine((m) => Object.keys(m).every((k) => (SUBJECT_IDS as string[]).includes(k)), 'Unknown subject'),
});
export type MarksBody = z.infer<typeof MarksBody>;

export const CreateClassBody = z.object({ name: z.string().trim().min(1, 'Name the class').max(60), grade });
export const JoinClassBody = z.object({ code: z.string().trim().min(4).max(12) });

// ---------------------------------------------------------------- Responses

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: 'learner' | 'teacher';
  emailVerified: boolean;
  school: string | null;
}

export interface PlanDto {
  grade: 9 | 10 | 11 | 12;
  englishIs: 'home' | 'additional';
  maths: MathsId;
  electives: ElectiveId[];
  careers: string[];
  updatedAt: string;
}

export interface MarksRecord {
  grade: number;
  term: number;
  marks: Partial<Record<SubjectId, number>>;
  updatedAt: string;
}

export interface MeResponse {
  user: UserDto | null;
  plan: PlanDto | null;
  marks: MarksRecord[];
  classes: { id: string; name: string; teacher: string }[];
}

export interface PublicConfig {
  signupMode: 'open' | 'invite' | 'closed';
  teacherSignup: boolean;
  contactEmail: string | null;
  privacyVersion: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  grade: number;
  code: string;
  learners: number;
  createdAt: string;
}

export type LearnerStatus = 'no-plan' | 'closed' | 'no-marks' | 'gap' | 'close' | 'on-track';

export interface LearnerRow {
  id: string;
  name: string;
  grade: number | null;
  careers: string[];
  maths: MathsId | null;
  electives: ElectiveId[];
  status: LearnerStatus;
  /** Plain-language reasons a teacher should talk to this learner. */
  flags: string[];
  aps: number | null;
  gap: { subject: SubjectId; shortBy: number; programme: string } | null;
  updatedAt: string | null;
}

export interface ClassReport {
  class: ClassSummary;
  learners: LearnerRow[];
  summary: {
    total: number;
    withPlan: number;
    closed: number;
    needsConversation: number;
    topCareers: { id: string; count: number }[];
    mathsLitBlocked: number;
  };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
