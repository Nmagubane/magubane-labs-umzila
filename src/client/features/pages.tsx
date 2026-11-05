import { useState } from 'react';
import { PROGRAMMES, INSTITUTIONS } from '../../shared/data/programmes.ts';
import { SOURCES } from '../../shared/data/sources.ts';
import { CAREERS } from '../../shared/data/careers.ts';
import { api, type ApiError } from '../lib/api.ts';
import { Link, useRouter } from '../lib/router.tsx';
import { useSession } from '../lib/session.tsx';
import { Button, ButtonLink, PageHeader, TextField } from '../ui/bits.tsx';

export function NotFound() {
  return (
    <div className="prose">
      <h1>This page doesn’t exist</h1>
      <p>
        The link may be old. <Link to="/">Search for a career</Link> instead.
      </p>
    </div>
  );
}

export function SchoolsPage() {
  const { config } = useSession();
  return (
    <div className="prose">
      <h1>Umzila for schools</h1>
      <p className="lead">Most Grade 9 learners choose their subjects with a parent’s guess and a booklet. A wrong choice closes doors they won’t notice until Grade 12.</p>
      <h2>What a school gets</h2>
      <ul>
        <li>
          <strong>A class report before subject choices close.</strong> Every learner’s career goal next to their planned subjects, with the ones who are about to close their own door at the
          top.
        </li>
        <li>
          <strong>Mark gaps per learner from Grade 10.</strong> Learners enter their term marks; the report shows who is far from the minimum for the career they want, and in which subject.
        </li>
        <li>
          <strong>Printable plans for parents’ evenings.</strong> Each learner can print their route, so the conversation at home starts from facts.
        </li>
        <li>
          <strong>Requirements you can trust.</strong> Every requirement links to the prospectus or government document it came from. Anything we could not confirm is marked.
        </li>
      </ul>
      <h2>What it costs</h2>
      <p>
        Umzila is free for learners, and always will be: a learner should never have to pay to find out which subjects they need. Schools pay for the class tools. We are running a pilot with a
        small number of schools first, and we would rather set the price with them than guess it.
      </p>
      <p>Companies and foundations can sponsor Umzila for schools that cannot pay. Sponsors never get access to learners’ data.</p>
      <p>
        {config?.contactEmail ? (
          <>
            To join the pilot, write to <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>.
          </>
        ) : (
          'To join the pilot, contact Magubane Labs.'
        )}
      </p>
      <ButtonLink to="/signup?as=teacher">Create a teacher account</ButtonLink>
    </div>
  );
}

export function SourcesPage() {
  const reviewed = PROGRAMMES.filter((p) => p.review);
  return (
    <div className="prose">
      <PageHeader title="Where our information comes from" lead="Wrong advice in Grade 9 can cost a learner years. So every requirement in Umzila points at the document it came from, and we tell you when we are not sure." />
      <h2>How we check</h2>
      <ul>
        <li>Requirements come from university prospectuses, official programme pages, SAQA and government publications.</li>
        <li>When only a third-party summary was available, the requirement is shown with a “check this” note until we confirm it against the official document.</li>
        <li>Requirements change every year. Each one says which intake year it is for, and each source shows the date we read it.</li>
        <li>We never let software write requirements. The planning tools only calculate from this checked data.</li>
      </ul>
      <h2>Still to confirm</h2>
      <ul>
        {reviewed.map((p) => (
          <li key={p.id}>
            <strong>
              {p.name}, {INSTITUTIONS[p.institution].short}:
            </strong>{' '}
            {p.review}
          </li>
        ))}
      </ul>
      <h2>Sources</h2>
      <ul className="sources-list">
        {Object.values(SOURCES).map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
            <span className="muted">
              {' '}
              {s.publisher}. {s.kind === 'primary' ? 'Official source' : 'Third-party summary'}, read on {s.checked}.
            </span>
            {s.note ? <span className="small muted"> {s.note}</span> : null}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Umzila currently covers {CAREERS.length} careers and {PROGRAMMES.length} programmes. Spotted something out of date? Tell your teacher or Magubane Labs and we will fix it.
      </p>
    </div>
  );
}

export function PrivacyPage() {
  const { config } = useSession();
  const contact = config?.contactEmail;
  return (
    <div className="prose">
      <h1>Privacy notice</h1>
      <p className="muted">Version {config?.privacyVersion ?? '2026-11-06'}. Umzila is run by Magubane Labs, South Africa.</p>
      <h2>What we keep</h2>
      <ul>
        <li>Your first name, email address and password (stored only as a secure hash).</li>
        <li>Your grade, subject choices, the careers you add to your plan, and the marks you choose to enter.</li>
        <li>If you are under 18: your parent or guardian’s name and email, so we can tell them about your account.</li>
        <li>Teachers: name, email and school.</li>
      </ul>
      <p>We do not ask for ID numbers, addresses, phone numbers or photos. You can use most of Umzila without an account at all; then your plan stays in your browser and we see nothing.</p>
      <h2>Why we keep it</h2>
      <p>Only to show you your route, check your subjects and marks against requirements, and, if you join a class, show your plan to that teacher.</p>
      <h2>Who can see it</h2>
      <ul>
        <li>You.</li>
        <li>A teacher, only if you join their class with a code. You can leave the class at any time.</li>
        <li>Our email provider, to deliver sign-in codes.</li>
      </ul>
      <p>We never sell your data, never show adverts, and never share it with bursary providers, universities or sponsors.</p>
      <h2>Your rights</h2>
      <p>
        You can download everything we hold about you, or delete your account and all its data, from your account page.{contact ? ` You can also write to ${contact}.` : ''} If you are unhappy
        with how we handle your data, you can complain to the Information Regulator.
      </p>
    </div>
  );
}

export function AccountPage() {
  const { me, logout } = useSession();
  const { navigate } = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me?.user)
    return (
      <div className="prose">
        <h1>Account</h1>
        <p>
          <Link to="/login">Log in</Link> or <Link to="/signup">create an account</Link>.
        </p>
      </div>
    );
  return (
    <div className="prose">
      <h1>Account</h1>
      <p>
        {me.user.displayName}, {me.user.email}
        {me.user.role === 'teacher' ? ` (teacher${me.user.school ? `, ${me.user.school}` : ''})` : ''}.
      </p>
      <p>
        <Button variant="secondary" onClick={() => void logout().then(() => navigate('/'))}>
          Log out
        </Button>
      </p>
      <h2>Your data</h2>
      <p>
        <a href="/api/account/export" download="umzila-my-data.json">
          Download everything we hold about you
        </a>{' '}
        (a JSON file).
      </p>
      <h2>Delete your account</h2>
      <p>This removes your account, plan, marks and class memberships for good. It can’t be undone.</p>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.post('/api/account/delete', { password });
            await logout();
            navigate('/');
          } catch (err) {
            setError((err as ApiError).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" variant="danger" busy={busy} disabled={!password}>
          Delete my account
        </Button>
      </form>
    </div>
  );
}
