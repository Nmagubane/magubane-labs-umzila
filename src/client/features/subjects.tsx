import { CAREERS, careerById } from '../../shared/data/careers.ts';
import { SUBJECTS, type ElectiveId } from '../../shared/data/subjects.ts';
import { checkAllCareers, checkCareerSubjects, type CareerSubjectCheck } from '../../shared/engine/plan.ts';
import type { Grade } from '../../shared/engine/roadmap.ts';
import { Link } from '../lib/router.tsx';
import { useSetup } from '../lib/setup.tsx';
import { PageHeader, Segmented, Status } from '../ui/bits.tsx';
import { SaveState } from './plan.tsx';

const GROUPS: { title: string; ids: ElectiveId[] }[] = [
  { title: 'Sciences', ids: ['physical-sciences', 'life-sciences', 'agricultural-sciences', 'tech-sciences'] },
  { title: 'Commerce', ids: ['accounting', 'business-studies', 'economics'] },
  { title: 'Humanities', ids: ['geography', 'history', 'religion-studies'] },
  { title: 'Technology', ids: ['it', 'cat', 'egd', 'civil-tech', 'electrical-tech', 'mechanical-tech'] },
  { title: 'Arts and services', ids: ['visual-arts', 'dramatic-arts', 'music', 'design', 'consumer-studies', 'tourism', 'hospitality'] },
];

export function SubjectPicker() {
  const { setup, update } = useSetup();
  const toggle = (id: ElectiveId) => {
    const has = setup.electives.includes(id);
    if (has) return update({ electives: setup.electives.filter((e) => e !== id) });
    if (setup.electives.length >= 3) return;
    // Physical Sciences and Technical Sciences can't be taken together.
    const clash: Partial<Record<ElectiveId, ElectiveId>> = { 'physical-sciences': 'tech-sciences', 'tech-sciences': 'physical-sciences' };
    const other = clash[id];
    update({ electives: [...setup.electives.filter((e) => e !== other), id] });
  };
  const full = setup.electives.length >= 3;
  return (
    <div className="picker">
      <div className="picker-row">
        <p className="picker-label" id="pk-grade">
          Your grade now
        </p>
        <Segmented<Grade> label="Your grade now" value={setup.grade} onChange={(g) => update({ grade: g })} options={[9, 10, 11, 12].map((g) => ({ value: g as Grade, label: `Grade ${g}` }))} />
      </div>
      <div className="picker-row">
        <p className="picker-label">English is your</p>
        <Segmented
          label="English is your"
          value={setup.englishIs}
          onChange={(v) => update({ englishIs: v })}
          options={[
            { value: 'home', label: 'Home Language' },
            { value: 'additional', label: 'First Additional Language' },
          ]}
        />
      </div>
      <div className="picker-row">
        <p className="picker-label">Mathematics</p>
        <Segmented
          label="Mathematics"
          value={setup.maths}
          onChange={(v) => update({ maths: v })}
          options={[
            { value: 'maths', label: 'Mathematics' },
            { value: 'maths-lit', label: 'Maths Literacy' },
            { value: 'tech-maths', label: 'Technical Maths' },
          ]}
        />
      </div>
      <fieldset className="electives">
        <legend>
          Your three electives <span className="muted num">({setup.electives.length} of 3 chosen)</span>
        </legend>
        <p className="small muted">Plus Life Orientation and your second language, which everyone takes.</p>
        {GROUPS.map((g) => (
          <div key={g.title} className="elective-group">
            <p className="elective-group-name">{g.title}</p>
            <div className="chips">
              {g.ids.map((id) => {
                const on = setup.electives.includes(id);
                return (
                  <button key={id} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} disabled={!on && full} onClick={() => toggle(id)}>
                    {SUBJECTS[id].name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {full ? <p className="small">That’s three. Tap one to remove it and choose another.</p> : null}
      </fieldset>
    </div>
  );
}

export function SubjectsPage() {
  const { setup, pkg, subjectsChosen } = useSetup();
  const checks = checkAllCareers(pkg);
  const goals = setup.careers.map((id) => careerById(id)).filter((c) => !!c);
  const open = checks.filter((c) => c.status === 'open');
  const weaker = checks.filter((c) => c.status === 'open-weaker');
  const closed = checks.filter((c) => c.status === 'closed');
  return (
    <div className="subjects-page">
      <PageHeader title="Your subjects" lead="Choose what you take (or plan to take) from Grade 10. Every career route in Umzila updates as you change them." />
      <div className="two-col">
        <section aria-label="Choose subjects">
          <SubjectPicker />
          <SaveState />
        </section>
        <section className="doors" aria-labelledby="doors-h" aria-live="polite">
          <h2 id="doors-h">
            {subjectsChosen ? (
              <>
                <span className="num">{CAREERS.length - closed.length}</span> of {CAREERS.length} careers open
              </>
            ) : (
              'Choose your electives to check them'
            )}
          </h2>
          {goals.length && subjectsChosen ? (
            <div className="goal-checks">
              <h3>Your goals</h3>
              <ul className="check-list">
                {goals.map((c) => (
                  <CheckRow key={c.id} check={checkCareerSubjects(pkg, c)} />
                ))}
              </ul>
            </div>
          ) : null}
          {subjectsChosen ? (
            <>
              {closed.length ? <CheckGroup title="Closed by your subjects" checks={closed} /> : null}
              {weaker.length ? <CheckGroup title="Open, but you’d be missing a useful subject" checks={weaker} /> : null}
              <CheckGroup title="Open" checks={open} collapsed />
            </>
          ) : (
            <p className="muted">Pick three electives and you’ll see which careers your subjects keep open, and which they close.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function CheckGroup({ title, checks, collapsed = false }: { title: string; checks: CareerSubjectCheck[]; collapsed?: boolean }) {
  const body = (
    <ul className="check-list">
      {checks.map((c) => (
        <CheckRow key={c.career.id} check={c} />
      ))}
    </ul>
  );
  return (
    <div className="check-group">
      {collapsed ? (
        <details>
          <summary>
            <h3>
              {title} <span className="num muted">({checks.length})</span>
            </h3>
          </summary>
          {body}
        </details>
      ) : (
        <>
          <h3>
            {title} <span className="num muted">({checks.length})</span>
          </h3>
          {body}
        </>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: CareerSubjectCheck }) {
  const missing = check.status === 'closed' ? check.missingEssential : check.missingRecommended;
  return (
    <li className="check-row">
      <Link to={`/careers/${check.career.id}`}>{check.career.name}</Link>
      {check.status === 'open' ? (
        <Status tone="open">Open</Status>
      ) : (
        <Status tone={check.status === 'closed' ? 'closed' : 'risk'}>
          {check.status === 'closed' ? 'Needs' : 'Would help:'} {missing.map((n) => n.anyOf.map((s) => SUBJECTS[s].short).join(' or ')).join(', ')}
        </Status>
      )}
    </li>
  );
}

