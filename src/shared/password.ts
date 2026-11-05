/**
 * Password policy, shared by the server (which enforces it) and the client (which shows a live checklist).
 * Rules: 8–128 characters, with an uppercase letter, a lowercase letter, a number and a special character,
 * not a well-known password, and not containing the person's name or email.
 */

export interface PasswordRule {
  id: 'length' | 'upper' | 'lower' | 'number' | 'special' | 'common' | 'personal';
  label: string;
  ok: boolean;
}

/** A short list of passwords that pass the character rules but are guessed first. Lower-cased, compared without spaces. */
const COMMON = new Set([
  'password1!', 'password1', 'p@ssw0rd', 'p@ssword1', 'passw0rd!', 'welcome1!', 'welcome123!', 'qwerty123!', 'qwerty1!', 'abc123!@#', 'abcd1234!',
  'letmein1!', 'iloveyou1!', 'admin123!', 'changeme1!', 'test1234!', 'summer2026!', 'winter2026!', 'spring2026!', 'autumn2026!', 'football1!',
  'monkey123!', 'sunshine1!', 'princess1!', 'dragon123!', 'master123!', 'magubane1!', 'bonisa123!', 'south@frica1', 'mzansi123!', 'bafana123!', 'password123!',
  'password@123', 'pass@1234', 'aa123456!', 'q1w2e3r4!', '1qaz2wsx!', 'zaq12wsx!',
]);

export function passwordRules(password: string, context: { email?: string; name?: string } = {}): PasswordRule[] {
  const lower = password.toLowerCase();
  const local = (context.email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const name = (context.name ?? '').trim().toLowerCase();
  const personal = (local.length >= 3 && lower.includes(local)) || (name.length >= 3 && lower.includes(name));
  return [
    { id: 'length', label: 'At least 8 characters', ok: password.length >= 8 && password.length <= 128 },
    { id: 'upper', label: 'An uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
    { id: 'lower', label: 'A lowercase letter (a–z)', ok: /[a-z]/.test(password) },
    { id: 'number', label: 'A number (0–9)', ok: /[0-9]/.test(password) },
    { id: 'special', label: 'A special character, like ! @ # ? or *', ok: /[^A-Za-z0-9\s]/.test(password) },
    { id: 'common', label: 'Not a well-known password', ok: password.length > 0 && !COMMON.has(lower.replace(/\s+/g, '')) },
    { id: 'personal', label: "Doesn't contain your name or email", ok: password.length > 0 && !personal },
  ];
}

/** The first unmet rule, phrased as an instruction, or null when the password is acceptable. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  const bad = passwordRules(password, context).find((r) => !r.ok);
  if (!bad) return null;
  switch (bad.id) {
    case 'length':
      return password.length > 128 ? 'Use 128 characters or fewer' : 'Use at least 8 characters';
    case 'upper':
      return 'Add an uppercase letter';
    case 'lower':
      return 'Add a lowercase letter';
    case 'number':
      return 'Add a number';
    case 'special':
      return 'Add a special character, like ! @ # ? or *';
    case 'common':
      return 'That password is too well known. Choose another';
    case 'personal':
      return "Don't use your name or email in your password";
  }
}
