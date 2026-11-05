import { useState } from 'react';
import { careerById, INTERESTS, type InterestId } from '../../shared/data/careers.ts';
import { checkCareerSubjects, checkProgramme, programmesFor } from '../../shared/engine/plan.ts';
import { buildRoadmap } from '../../shared/engine/roadmap.ts';
import { careersForInterests } from '../../shared/engine/search.ts';
import { api, type ApiError } from '../lib/api.ts';
import { Link } from '../lib/router.tsx';
import { useSession } from '../lib/session.tsx';
import { useSetup } from '../lib/setup.tsx';
import { Button, ButtonLink, Notice, PageHeader, Status, TextField, type Tone } from '../ui/bits.tsx';
import { CareerRow, FIT } from './career.tsx';
import { RouteMap } from './route.tsx';
import type { MeResponse } from '../../shared/api.ts';

export function SaveState() {
  const { saving, saveError, storage } = useSetup();
  if (saveError) return <p className="field-error">Not saved: {saveError.message}</p>;
  return <p className="small muted save-state">{saving ? 'Saving…' : storage === 'account' ? 'Saved to your account.' : 'Saved in this browser only.'}</p>;
}

export function PlanPage() {
  const { setup, pkg, subjectsChosen, marks, update, toggleCareer, storage } = useSetup();
  const { me } = useSession();
  const goals = setup.careers.map((id) => careerById(id)).filter((c) => !!c);
  const main = goals[0];

  if (!main) {
    return (
      <div className="plan-page">
        <PageHeader title="My plan" lead="Your plan holds up to three careers: a main goal and two backups." />
        <div className="empty">
          <p>You haven’t added a career yet.</p>
          <ButtonLink to="/">Find a career</ButtonLink>
        </div>
      </div>
    );
  }

  const makeMain = (id: string) => update({ careers: [id, ...setup.careers.filter((c) => c !== id)] });

  return (
    <div className="plan-page">
      <PageHeader title="My plan" lead={`Grade ${setup.grade}. Main goal: ${main.name.toLowerCase()}.`}>
        <div className="header-actions">
          <Button variant="secondary" onClick={() => window.print()}>
            Print for my parents
          </Button>
        </div>
      </PageHeader>

      {storage === 'browser' ? (
        <Notice title="This plan is saved in this browser only">
          <p>
            <Link to="/signup">Create an account</Link> to keep it on any phone, and to share it with your Life Orientation teacher.
          </p>
        </Notice>
      ) : null}

      <section aria-labelledby="goals-h" className="goals">
        <h2 id="goals-h">Your careers</h2>
        <ol className="goal-list">
          {goals.map((c, i) => {
            const subj = subjectsChosen ? checkCareerSubjects(pkg, c) : null;
            const fits = marks && subjectsChosen ? programmesFor(c).map((p) => checkProgramme(pkg, marks.marks, p)) : [];
            const best = fits.find((f) => f.status === 'meets') ?? fits.find((f) => f.status === 'close') ?? fits[0];
            const subjTone: Tone = !subj ? 'neutral' : subj.status === 'open' ? 'open' : subj.status === 'closed' ? 'closed' : 'risk';
            return (
              <li key={c.id} className="goal">
                <div className="goal-main">
                  <p className="goal-rank">{i === 0 ? 'Main goal' : `Backup ${i}`}</p>
                  <h3>
                    <Link to={`/careers/${c.id}`}>{c.name}</Link>
                  </h3>
                  <p className="goal-status">
                    <Status tone={subjTone}>{!subj ? 'Subjects not chosen yet' : subj.status === 'open' ? 'Subjects: open' : subj.status === 'closed' ? 'Subjects: closed' : 'Subjects: open, one missing'}</Status>
                    {best ? <Status tone={FIT[best.status].tone}>Marks: {FIT[best.status].label.toLowerCase()}</Status> : null}
                  </p>
                </div>
                <div className="goal-actions">
                  {i > 0 ? (
                    <Button variant="quiet" size="sm" onClick={() => makeMain(c.id)}>
                      Make main goal
                    </Button>
                  ) : null}
                  <Button variant="quiet" size="sm" onClick={() => toggleCareer(c.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        {goals.length < 3 ? (
          <p className="small">
            <Link to="/">Add a backup career</Link>. A good backup shares your main goal’s subjects.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="mainroute-h" className="plan-route">
        <h2 id="mainroute-h">Route to {main.name.toLowerCase()}</h2>
        <RouteMap milestones={buildRoadmap({ career: main, grade: setup.grade, pkg: subjectsChosen ? pkg : null, marks: marks?.marks ?? {} })} grade={setup.grade} />
      </section>

      {me?.user?.role === 'learner' && me.user.emailVerified ? <ClassJoin /> : null}
      <SaveState />
    </div>
  );
}

function ClassJoin() {
  const { me, setMe } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const classes = me?.classes ?? [];
  return (
    <section className="class-join" aria-labelledby="cj-h">
      <h2 id="cj-h">Your teacher</h2>
      {classes.length ? (
        <ul className="plain">
          {classes.map((c) => (
            <li key={c.id}>
              {c.name}, with {c.teacher}. They can see your plan and marks.{' '}
              <button
                type="button"
                className="linkish"
                onClick={async () => {
                  setMe(await api.del<MeResponse>(`/api/classes/${c.id}/membership`));
                }}
              >
                Leave class
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Join your Life Orientation class so your teacher can help you with your plan.</p>
      )}
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            setMe(await api.post<MeResponse>('/api/classes/join', { code }));
            setCode('');
          } catch (err) {
            setError((err as ApiError).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField label="Class code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} error={error} autoComplete="off" maxLength={8} />
        <Button type="submit" variant="secondary" busy={busy} disabled={code.trim().length < 4}>
          Join class
        </Button>
      </form>
    </section>
  );
}

export function ExplorePage() {
  const [chosen, setChosen] = useState<InterestId[]>([]);
  const results = careersForInterests(chosen).slice(0, 10);
  const toggle = (id: InterestId) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="explore-page">
      <PageHeader title="Start from what you enjoy" lead="Pick everything that sounds like you. This is a starting point for exploring, not a test: it only matches what you pick to the kind of work each career involves." />
      <div className="two-col">
        <fieldset className="interests">
          <legend className="sr-only">Things you enjoy</legend>
          {(Object.keys(INTERESTS) as InterestId[]).map((id) => {
            const on = chosen.includes(id);
            return (
              <button key={id} type="button" className={`interest${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(id)}>
                <span className="interest-label">{INTERESTS[id].label}</span>
                <span className="interest-example">{INTERESTS[id].example}</span>
              </button>
            );
          })}
        </fieldset>
        <section aria-live="polite" aria-labelledby="ex-h">
          <h2 id="ex-h">{chosen.length ? 'Careers to look at' : 'Pick at least one'}</h2>
          {results.length ? (
            <ul className="career-list">
              {results.map((r) => (
                <CareerRow key={r.career.id} career={r.career} extra={<span className="match">Matches: {r.shared.map((i) => INTERESTS[i].label.toLowerCase()).join(', ')}</span>} />
              ))}
            </ul>
          ) : (
            <p className="muted">Your matches appear here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
