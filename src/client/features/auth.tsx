import { useState, type FormEvent } from 'react';
import type { MeResponse } from '../../shared/api.ts';
import { passwordRules } from '../../shared/password.ts';
import type { Grade } from '../../shared/engine/roadmap.ts';
import { api, ApiError } from '../lib/api.ts';
import { Link, useRouter } from '../lib/router.tsx';
import { useSession } from '../lib/session.tsx';
import { useSetup } from '../lib/setup.tsx';
import { Button, Notice, Segmented, SelectField, TextField } from '../ui/bits.tsx';

function useForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const submit = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await fn();
    } catch (e) {
      const err = e as ApiError;
      setFields(err instanceof ApiError ? err.fields : {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, fields, submit };
}

export function LoginPage() {
  const { setMe } = useSession();
  const { navigate, search } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const f = useForm();
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void f.submit(async () => {
      const m = await api.post<MeResponse>('/api/auth/login', { email, password });
      setMe(m);
      navigate(!m.user?.emailVerified ? '/verify' : m.user.role === 'teacher' ? '/teach' : (search.get('next') ?? '/plan'));
    });
  };
  return (
    <div className="auth">
      <h1>Log in</h1>
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={f.fields.email} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={f.fields.password} required />
        {f.error && !Object.keys(f.fields).length ? <p className="field-error">{f.error}</p> : null}
        <Button type="submit" busy={f.busy} size="lg">
          Log in
        </Button>
      </form>
      <p>
        <Link to="/forgot">Forgot your password?</Link>
      </p>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}

export function SignupPage() {
  const { setMe, config } = useSession();
  const { setup, update } = useSetup();
  const { navigate, search } = useRouter();
  const [type, setType] = useState<'learner' | 'teacher'>(search.get('as') === 'teacher' ? 'teacher' : 'learner');
  const [v, setV] = useState({ displayName: '', email: '', password: '', grade: String(setup.grade), ageGroup: 'minor' as 'minor' | 'adult', guardianName: '', guardianEmail: '', classCode: search.get('code') ?? '', accessCode: '', school: '', consent: false });
  const f = useForm();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const rules = passwordRules(v.password, { email: v.email, name: v.displayName });
  const invite = config?.signupMode === 'invite';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void f.submit(async () => {
      if (type === 'learner') update({ grade: Number(v.grade) as Grade });
      const body =
        type === 'learner'
          ? {
              accountType: 'learner',
              displayName: v.displayName,
              email: v.email,
              password: v.password,
              grade: Number(v.grade),
              ageGroup: v.ageGroup,
              ...(v.ageGroup === 'minor' ? { guardianName: v.guardianName, guardianEmail: v.guardianEmail } : {}),
              ...(v.classCode.trim() ? { classCode: v.classCode.trim() } : {}),
              ...(v.accessCode.trim() ? { accessCode: v.accessCode.trim() } : {}),
              consent: v.consent || undefined,
            }
          : { accountType: 'teacher', displayName: v.displayName, email: v.email, password: v.password, school: v.school || undefined, accessCode: v.accessCode, consent: v.consent || undefined };
      setMe(await api.post<MeResponse>('/api/auth/signup', body));
      navigate('/verify');
    });
  };

  return (
    <div className="auth auth-wide">
      <h1>Create your account</h1>
      <Segmented
        label="Account type"
        value={type}
        onChange={setType}
        options={[
          { value: 'learner', label: 'I’m a learner' },
          { value: 'teacher', label: 'I’m a teacher' },
        ]}
      />
      {type === 'teacher' && config && !config.teacherSignup ? (
        <Notice tone="risk" title="Teacher accounts are in a pilot">
          <p>{config.contactEmail ? `Write to ${config.contactEmail} for an educator code.` : 'Ask Magubane Labs for an educator code.'}</p>
        </Notice>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <TextField label={type === 'teacher' ? 'Your name, as learners know you' : 'Your first name'} autoComplete={type === 'teacher' ? 'name' : 'given-name'} value={v.displayName} onChange={set('displayName')} error={f.fields.displayName} placeholder={type === 'teacher' ? 'Ms Dlamini' : ''} />
        <TextField label="Email" type="email" autoComplete="email" value={v.email} onChange={set('email')} error={f.fields.email} hint="We send a 6-digit code to confirm it." />
        <TextField label="Password" type="password" autoComplete="new-password" value={v.password} onChange={set('password')} error={f.fields.password} />
        {v.password ? (
          <ul className="pw-rules" aria-label="Password rules">
            {rules.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : ''}>
                <span aria-hidden>{r.ok ? '✓' : '•'}</span> {r.label}
                <span className="sr-only">{r.ok ? ' (done)' : ' (not yet)'}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {type === 'learner' ? (
          <>
            <SelectField label="Your grade" value={v.grade} onChange={set('grade')} error={f.fields.grade}>
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </SelectField>
            <fieldset className="field">
              <legend>Are you under 18?</legend>
              <Segmented
                label="Are you under 18?"
                value={v.ageGroup}
                onChange={(a) => setV({ ...v, ageGroup: a })}
                options={[
                  { value: 'minor', label: 'Yes, I’m under 18' },
                  { value: 'adult', label: 'No, I’m 18 or older' },
                ]}
              />
            </fieldset>
            {v.ageGroup === 'minor' ? (
              <div className="guardian">
                <p className="small">The law (POPIA) asks for a parent or guardian’s consent for under-18s. We email them once to tell them about your account.</p>
                <TextField label="Parent or guardian’s name" value={v.guardianName} onChange={set('guardianName')} error={f.fields.guardianName} />
                <TextField label="Parent or guardian’s email" type="email" value={v.guardianEmail} onChange={set('guardianEmail')} error={f.fields.guardianEmail} />
              </div>
            ) : null}
            <TextField label="Class code (from your teacher)" value={v.classCode} onChange={(e) => setV({ ...v, classCode: e.target.value.toUpperCase() })} error={f.fields.classCode} hint={invite ? 'You need a class code or an access code to join the pilot.' : 'Optional. Your teacher can then see your plan.'} autoComplete="off" />
            {invite && !v.classCode.trim() ? <TextField label="Access code" value={v.accessCode} onChange={set('accessCode')} error={f.fields.accessCode} autoComplete="off" /> : null}
          </>
        ) : (
          <>
            <TextField label="School" value={v.school} onChange={set('school')} error={f.fields.school} autoComplete="organization" />
            <TextField label="Educator code" value={v.accessCode} onChange={set('accessCode')} error={f.fields.accessCode} autoComplete="off" />
          </>
        )}

        <label className="check">
          <input type="checkbox" checked={v.consent} onChange={(e) => setV({ ...v, consent: e.target.checked })} />
          <span>
            I have read the <Link to="/privacy">privacy notice</Link>
            {type === 'learner' && v.ageGroup === 'minor' ? ', and my parent or guardian agrees to me using Umzila' : ''}.
          </span>
        </label>
        {f.fields.consent ? <p className="field-error">{f.fields.consent}</p> : null}
        {f.error && !Object.keys(f.fields).length ? <p className="field-error">{f.error}</p> : null}
        <Button type="submit" busy={f.busy} size="lg">
          Create account
        </Button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export function VerifyPage() {
  const { me, setMe, logout } = useSession();
  const { navigate } = useRouter();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const f = useForm();
  if (!me?.user) {
    return (
      <div className="auth">
        <h1>Confirm your email</h1>
        <p>
          <Link to="/login">Log in</Link> first.
        </p>
      </div>
    );
  }
  return (
    <div className="auth">
      <h1>Confirm your email</h1>
      <p>
        We sent a 6-digit code to <strong>{me.user.email}</strong>. It works for 10 minutes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void f.submit(async () => {
            const m = await api.post<MeResponse>('/api/auth/verify', { code });
            setMe(m);
            navigate(m.user?.role === 'teacher' ? '/teach' : '/plan');
          });
        }}
      >
        <TextField label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={f.fields.code ?? f.error} maxLength={8} className="code-field" />
        <Button type="submit" busy={f.busy} size="lg">
          Confirm
        </Button>
      </form>
      <p className="small">
        No email? Check your spam folder, or{' '}
        <button
          type="button"
          className="linkish"
          onClick={async () => {
            try {
              await api.post('/api/auth/resend');
              setSent('A new code is on its way.');
            } catch (e) {
              setSent((e as ApiError).message);
            }
          }}
        >
          send a new code
        </button>
        . {sent}
      </p>
      <p className="small">
        Wrong email?{' '}
        <button type="button" className="linkish" onClick={() => void logout().then(() => navigate('/signup'))}>
          Start again
        </button>
      </p>
    </div>
  );
}

export function ForgotPage() {
  const { setMe } = useSession();
  const { navigate } = useRouter();
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const f = useForm();
  return (
    <div className="auth">
      <h1>Reset your password</h1>
      {stage === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void f.submit(async () => {
              await api.post('/api/auth/forgot', { email });
              setStage('code');
            });
          }}
        >
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={f.fields.email ?? f.error} />
          <Button type="submit" busy={f.busy}>
            Send a reset code
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void f.submit(async () => {
              setMe(await api.post<MeResponse>('/api/auth/reset', { email, code, password }));
              navigate('/plan');
            });
          }}
        >
          <p>If {email} has an account, a code is on its way.</p>
          <TextField label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={f.fields.code} />
          <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={f.fields.password} />
          {f.error && !Object.keys(f.fields).length ? <p className="field-error">{f.error}</p> : null}
          <Button type="submit" busy={f.busy}>
            Set new password
          </Button>
        </form>
      )}
    </div>
  );
}
