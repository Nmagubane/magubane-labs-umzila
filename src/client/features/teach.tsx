import { useState } from 'react';
import type { ClassReport, ClassSummary, LearnerRow, LearnerStatus, MarksRecord, PlanDto } from '../../shared/api.ts';
import { careerById } from '../../shared/data/careers.ts';
import { SUBJECTS } from '../../shared/data/subjects.ts';
import { buildRoadmap } from '../../shared/engine/roadmap.ts';
import { api, type ApiError } from '../lib/api.ts';
import { Link, useRouter } from '../lib/router.tsx';
import { invalidate, useResource } from '../lib/useResource.ts';
import { Button, ErrorState, Loading, PageHeader, SelectField, Status, TextField, type Tone } from '../ui/bits.tsx';
import { RouteMap } from './route.tsx';

const STATUS: Record<LearnerStatus, { tone: Tone; label: string }> = {
  closed: { tone: 'closed', label: 'Subjects close their goal' },
  gap: { tone: 'closed', label: 'Marks far from the minimum' },
  'no-plan': { tone: 'risk', label: 'No career goal yet' },
  'no-marks': { tone: 'neutral', label: 'No marks yet' },
  close: { tone: 'risk', label: 'Close to the minimum' },
  'on-track': { tone: 'open', label: 'On track' },
};

export function TeachHome() {
  const classes = useResource<ClassSummary[]>('/api/teach/classes');
  const { navigate } = useRouter();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('9');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="teach">
      <PageHeader title="My classes" lead="Create a class, put the code on the board, and see which learners are about to close the door on the career they want, before subject choices are final." />
      {classes.error ? <ErrorState error={classes.error} onRetry={classes.reload} /> : null}
      {classes.loading ? <Loading /> : null}
      {classes.data?.length ? (
        <ul className="class-list">
          {classes.data.map((c) => (
            <li key={c.id}>
              <Link to={`/teach/${c.id}`} className="class-link">
                <span className="class-name">{c.name}</span>
                <span className="muted">
                  Grade {c.grade}, <span className="num">{c.learners}</span> {c.learners === 1 ? 'learner' : 'learners'}, code <span className="num">{c.code}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : classes.data ? (
        <p className="muted">No classes yet. Create your first one below.</p>
      ) : null}
      <form
        className="create-class"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const c = await api.post<ClassSummary>('/api/teach/classes', { name, grade: Number(grade) });
            invalidate('/api/teach');
            navigate(`/teach/${c.id}`);
          } catch (err) {
            setError((err as ApiError).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Create a class</h2>
        <div className="inline-fields">
          <TextField label="Class name" value={name} onChange={(e) => setName(e.target.value)} placeholder="9B Life Orientation" error={error} />
          <SelectField label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {[9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="submit" busy={busy} disabled={!name.trim()}>
          Create class
        </Button>
      </form>
    </div>
  );
}

export function ClassPage({ id }: { id: string }) {
  const r = useResource<ClassReport>(`/api/teach/classes/${id}`);
  if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  if (!r.data) return <Loading />;
  const { class: c, learners, summary } = r.data;
  const joinUrl = `${window.location.origin}/signup?code=${c.code}`;
  return (
    <div className="teach class-page">
      <p className="crumb">
        <Link to="/teach">My classes</Link>
      </p>
      <PageHeader title={c.name} lead={`Grade ${c.grade}`}>
        <div className="join-board">
          <p>Learners join with this code</p>
          <p className="join-code num">{c.code}</p>
          <p className="small">
            New learners: <span className="url">{joinUrl.replace(/^https?:\/\//, '')}</span>. Learners with an account add the code under My plan.
          </p>
        </div>
      </PageHeader>

      {summary.total ? (
        <>
          <p className="class-summary">
            <strong className="num">{summary.needsConversation}</strong> of <span className="num">{summary.total}</span> learners need a conversation.
            {summary.closed ? (
              <>
                {' '}
                <strong className="num">{summary.closed}</strong> have chosen subjects that close the career they want
                {summary.mathsLitBlocked ? <>, {summary.mathsLitBlocked} of them because of Mathematical Literacy</> : null}.
              </>
            ) : null}
          </p>
          {summary.topCareers.length ? (
            <p className="muted">
              Most common goals:{' '}
              {summary.topCareers.map((t, i) => (
                <span key={t.id}>
                  {careerById(t.id)?.name.toLowerCase()} ({t.count}){i < summary.topCareers.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          ) : null}
          <div className="table-wrap">
            <table className="class-table">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col">Wants to be</th>
                  <th scope="col">Maths</th>
                  <th scope="col">Status</th>
                  <th scope="col">Talk about</th>
                  <th scope="col" className="num">
                    APS
                  </th>
                </tr>
              </thead>
              <tbody>
                {learners.map((l) => (
                  <LearnerTr key={l.id} classId={c.id} l={l} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="no-print">
            <Button variant="secondary" onClick={() => window.print()}>
              Print this report
            </Button>
          </p>
        </>
      ) : (
        <div className="empty">
          <p>No learners yet. Put the code on the board: learners create an account with it, or add it under My plan.</p>
        </div>
      )}
    </div>
  );
}

function LearnerTr({ classId, l }: { classId: string; l: LearnerRow }) {
  const main = l.careers[0] ? careerById(l.careers[0]) : undefined;
  return (
    <tr>
      <th scope="row">
        <Link to={`/teach/${classId}/learners/${l.id}`}>{l.name}</Link>
        {l.grade ? <span className="muted small"> Gr {l.grade}</span> : null}
      </th>
      <td>{main ? main.name : <span className="muted">Not chosen</span>}</td>
      <td>{l.maths ? SUBJECTS[l.maths].short : ''}</td>
      <td>
        <Status tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Status>
      </td>
      <td className="flags">{l.flags.length ? l.flags.join('. ') + '.' : ''}</td>
      <td className="num">{l.aps ?? ''}</td>
    </tr>
  );
}

export function TeacherLearnerPage({ classId, learnerId }: { classId: string; learnerId: string }) {
  const r = useResource<{ name: string; plan: PlanDto | null; marks: MarksRecord[] }>(`/api/teach/classes/${classId}/learners/${learnerId}`);
  if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  if (!r.data) return <Loading />;
  const { name, plan, marks } = r.data;
  const main = plan?.careers[0] ? careerById(plan.careers[0]) : undefined;
  const latest = marks[0];
  return (
    <div className="teach">
      <p className="crumb">
        <Link to={`/teach/${classId}`}>Back to the class</Link>
      </p>
      <PageHeader title={name} lead={plan ? `Grade ${plan.grade}. Takes ${[SUBJECTS[plan.maths].name, ...plan.electives.map((e) => SUBJECTS[e].name)].join(', ')}.` : 'Has not made a plan yet.'} />
      {plan && main ? (
        <>
          <p>
            Careers: {plan.careers.map((id) => careerById(id)?.name).filter(Boolean).join(', ')}.
            {latest ? ` Latest marks: Grade ${latest.grade}, term ${latest.term}.` : ' No marks entered yet.'}
          </p>
          <h2>Route to {main.name.toLowerCase()}</h2>
          <RouteMap milestones={buildRoadmap({ career: main, grade: plan.grade, pkg: { maths: plan.maths, electives: plan.electives, englishIs: plan.englishIs }, marks: latest?.marks ?? {} })} grade={plan.grade} />
        </>
      ) : null}
    </div>
  );
}
