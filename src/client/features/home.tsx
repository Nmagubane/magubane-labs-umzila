import { useId, useMemo, useState } from 'react';
import { CAREERS, FIELDS, type FieldId } from '../../shared/data/careers.ts';
import { checkAllCareers, openCount, type SubjectPackage } from '../../shared/engine/plan.ts';
import { searchCareers } from '../../shared/engine/search.ts';
import { Link, useRouter } from '../lib/router.tsx';
import { useSetup } from '../lib/setup.tsx';
import { Segmented } from '../ui/bits.tsx';
import { CareerRow } from './career.tsx';

const SUGGESTIONS = ['doctor', 'engineer', 'accountant', 'software developer', 'nurse', 'lawyer', 'electrician'];

export function HomePage() {
  const { search, navigate } = useRouter();
  const [q, setQ] = useState(search.get('q') ?? '');
  const hits = useMemo(() => searchCareers(q).slice(0, 8), [q]);
  const inputId = useId();

  return (
    <div className="home">
      <section className="ask" aria-labelledby={`${inputId}-label`}>
        <h1 id={`${inputId}-label`}>
          <label htmlFor={inputId}>What do you want to become?</label>
        </h1>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) navigate(`/careers/${hits[0].career.id}`);
          }}
        >
          <input
            id={inputId}
            className="ask-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="A doctor, an engineer, a coder…"
            autoComplete="off"
            enterKeyHint="go"
            aria-describedby={`${inputId}-hint`}
          />
        </form>
        <p id={`${inputId}-hint`} className="ask-hint">
          Type a job, a subject you love or what you’d like to do all day. You get the route from your grade to that career: subjects, marks, where to study and what it takes to qualify.
        </p>

        {q.trim() ? (
          hits.length ? (
            <ul className="career-list" aria-label="Matching careers" aria-live="polite">
              {hits.map((h) => (
                <CareerRow key={h.career.id} career={h.career} />
              ))}
            </ul>
          ) : (
            <div className="ask-empty" aria-live="polite">
              <p>
                <strong>Umzila doesn’t have “{q.trim()}” yet.</strong> The library starts with 25 careers we have checked carefully, and grows every term.
              </p>
              <p>
                Try a related word, <Link to="/careers">browse all careers</Link> or <Link to="/explore">start from what you enjoy</Link>.
              </p>
            </div>
          )
        ) : (
          <p className="ask-try">
            Try:{' '}
            {SUGGESTIONS.map((s, i) => (
              <span key={s}>
                <button type="button" className="linkish" onClick={() => setQ(s)}>
                  {s}
                </button>
                {i < SUGGESTIONS.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
        <section className="browse" aria-labelledby="browse-h">
        <h2 id="browse-h">Not sure yet?</h2>
        <p>
          <Link to="/explore">Start from what you enjoy</Link> and we’ll suggest careers to look at, or <Link to="/careers">browse all {CAREERS.length} careers</Link>.
        </p>
        </section>
      </section>

      <MathsChoice />

    </div>
  );
}

/**
 * The single most consequential decision in Grade 9, made concrete: flip the switch and watch doors close.
 * Uses the learner's own electives when they have chosen them.
 */
function MathsChoice() {
  const { pkg, subjectsChosen } = useSetup();
  const [maths, setMaths] = useState<'maths' | 'maths-lit'>(pkg.maths === 'maths-lit' ? 'maths-lit' : 'maths');
  const base: SubjectPackage = subjectsChosen ? pkg : { maths: 'maths', electives: ['physical-sciences', 'life-sciences', 'geography'], englishIs: pkg.englishIs };
  const current = { ...base, maths };
  const open = openCount(current);
  const closed = checkAllCareers(current).filter((c) => c.status === 'closed');
  return (
    <section className="maths-choice" aria-labelledby="mc-h">
      <h2 id="mc-h">The choice that decides the most</h2>
      <p>
        At the end of Grade 9 you choose between Mathematics and Mathematical Literacy. See what it does to the careers in Umzila
        {subjectsChosen ? ', with your other subjects' : ', with Physical Sciences, Life Sciences and Geography as electives'}.
      </p>
      <Segmented
        label="Maths subject"
        value={maths}
        onChange={setMaths}
        options={[
          { value: 'maths', label: 'Mathematics' },
          { value: 'maths-lit', label: 'Maths Literacy' },
        ]}
      />
      <p className="mc-count" aria-live="polite">
        <span className="num mc-number">{open}</span> of {CAREERS.length} careers stay open
      </p>
      <div className="mc-doors" aria-hidden>
        {CAREERS.map((c) => (
          <span key={c.id} className={`door${closed.some((x) => x.career.id === c.id) ? ' shut' : ''}`} />
        ))}
      </div>
      {closed.length ? (
        <p className="small">
          Closed:{' '}
          {closed.map((c, i) => (
            <span key={c.career.id}>
              <Link to={`/careers/${c.career.id}`}>{c.career.name.toLowerCase()}</Link>
              {i < closed.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      ) : (
        <p className="small">With Mathematics, every route in Umzila stays open.</p>
      )}
      <p className="small muted">
        Umzila’s first 25 careers lean towards maths and science. Many good careers outside this list accept Mathematical Literacy, and it is the right subject for some learners. Choose it
        knowing what it closes.
      </p>
    </section>
  );
}

export function CareersPage() {
  const { search } = useRouter();
  const only = search.get('field') as FieldId | null;
  const fields = (Object.keys(FIELDS) as FieldId[]).filter((f) => !only || f === only);
  return (
    <div className="careers-page">
      <header className="page-header">
        <h1>{only ? FIELDS[only].name : 'All careers'}</h1>
        <p className="lead">{only ? FIELDS[only].blurb : 'Every career in Umzila, grouped by the kind of work. Each one has a full route and requirements we have checked.'}</p>
        {only ? (
          <p>
            <Link to="/careers">See all careers</Link>
          </p>
        ) : null}
      </header>
      {fields.map((f) => {
        const list = CAREERS.filter((c) => c.field === f);
        return (
          <section key={f} className="field-group" aria-labelledby={`fg-${f}`}>
            <h2 id={`fg-${f}`}>{FIELDS[f].name}</h2>
            {!only ? <p className="muted small">{FIELDS[f].blurb}</p> : null}
            <ul className="career-list">
              {list.map((c) => (
                <CareerRow key={c.id} career={c} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
