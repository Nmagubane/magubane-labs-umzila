import type { ReactNode } from 'react';
import { careerById, FIELDS, type Career } from '../../shared/data/careers.ts';
import { FUNDING } from '../../shared/data/funding.ts';
import { INSTITUTIONS } from '../../shared/data/programmes.ts';
import { SUBJECTS, type SubjectId } from '../../shared/data/subjects.ts';
import { checkCareerSubjects, checkProgramme, takes, programmesFor, requirementLabel, type ProgrammeFit } from '../../shared/engine/plan.ts';
import { buildRoadmap, yearsAfterSchool } from '../../shared/engine/roadmap.ts';
import { Link } from '../lib/router.tsx';
import { useSetup } from '../lib/setup.tsx';
import { Button, ButtonLink, Notice, SourceNote, Status, type Tone } from '../ui/bits.tsx';
import { RouteMap } from './route.tsx';
import { NotFound } from './pages.tsx';

const names = (ids: SubjectId[]) => ids.map((s) => SUBJECTS[s].name).join(' or ');

export const FIT: Record<ProgrammeFit['status'], { tone: Tone; label: string }> = {
  meets: { tone: 'open', label: 'You meet the minimum' },
  close: { tone: 'risk', label: 'Close: within reach' },
  gap: { tone: 'closed', label: 'Not yet: a real gap' },
  blocked: { tone: 'closed', label: 'Missing a required subject' },
  incomplete: { tone: 'neutral', label: 'Add all your marks to check' },
};

export function CareerPage({ id }: { id: string }) {
  const career = careerById(id);
  const { setup, pkg, subjectsChosen, marks, toggleCareer } = useSetup();
  if (!career) return <NotFound />;

  const inPlan = setup.careers.includes(career.id);
  const isMain = setup.careers[0] === career.id;
  const check = subjectsChosen ? checkCareerSubjects(pkg, career) : null;
  const milestones = buildRoadmap({ career, grade: setup.grade, pkg: subjectsChosen ? pkg : null, marks: marks?.marks ?? {} });
  const programmes = programmesFor(career);
  const fits = marks && subjectsChosen ? programmes.map((p) => checkProgramme(pkg, marks.marks, p)) : null;
  const years = yearsAfterSchool(career);

  return (
    <article className="career">
      <header className="career-head">
        <p className="career-field">
          <Link to={`/careers?field=${career.field}`}>{FIELDS[career.field].name}</Link>
        </p>
        <h1>{career.name}</h1>
        <p className="lead">{career.oneLine}</p>
        <dl className="facts">
          <div>
            <dt>After school</dt>
            <dd>
              <span className="num">{years}</span> {years === 1 ? 'year' : 'years'} of study and training
              <span className="facts-sub">{career.routeSummary}</span>
            </dd>
          </div>
          {career.registration ? (
            <div>
              <dt>Qualified when</dt>
              <dd>
                Registered with the {career.registration.abbr}
                <span className="facts-sub">{career.registration.body}</span>
              </dd>
            </div>
          ) : (
            <div>
              <dt>Qualified when</dt>
              <dd>{career.field === 'trades' ? 'You pass the trade test' : 'You finish your qualification: no compulsory registration'}</dd>
            </div>
          )}
          {career.demand ? (
            <div>
              <dt>Demand</dt>
              <dd>
                On DHET’s 2024 list of occupations in high demand
                <span className="facts-sub">
                  {career.demand.manySeekers ? 'DHET also notes many registered job-seekers for this occupation. ' : ''}
                  <SourceNote id="dhet-oihd-2024" />
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="career-actions">
          <Button variant={inPlan ? 'secondary' : 'primary'} onClick={() => toggleCareer(career.id)} aria-pressed={inPlan}>
            {inPlan ? 'Remove from my plan' : 'Add to my plan'}
          </Button>
          {inPlan ? <Status tone="open">{isMain ? 'Your main goal' : 'In your plan'}</Status> : null}
          {!subjectsChosen ? (
            <ButtonLink to="/subjects" variant="quiet">
              Check this against my subjects
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {check?.status === 'closed' ? (
        <Notice tone="closed" title={`Your subjects close the usual route to ${career.name.toLowerCase()}`}>
          <p>
            You need {check.missingEssential.map((n) => names(n.anyOf)).join(' and ')}. {check.missingEssential[0]?.why}
          </p>
          <p>
            <Link to="/subjects">Change your subjects</Link> or look at <a href="#alternatives">other ways in</a>.
          </p>
        </Notice>
      ) : null}

      <div className="career-grid">
        <section className="career-route" aria-labelledby="route-h">
          <h2 id="route-h">Your route from Grade {setup.grade}</h2>
          <p className="muted small">
            Built from your grade{subjectsChosen ? ', subjects' : ''}
            {marks ? ' and marks' : ''}. <Link to="/subjects">Change them</Link>
          </p>
          <RouteMap milestones={milestones} grade={setup.grade} />
        </section>

        <aside className="career-aside">
          <section aria-labelledby="subjects-h">
            <h2 id="subjects-h">School subjects</h2>
            <ul className="needs">
              {career.school.needs.map((n) => {
                const has = subjectsChosen ? n.anyOf.some((s) => takes(pkg, s)) : null;
                const tone: Tone = has === null ? 'neutral' : has ? 'open' : n.kind === 'essential' ? 'closed' : 'risk';
                return (
                  <li key={n.anyOf.join()}>
                    <p className="needs-head">
                      <strong>{names(n.anyOf)}</strong> <span className="muted">{n.kind === 'essential' ? 'must have' : 'helps'}</span>
                      {has !== null ? <Status tone={tone}>{has ? 'You take it' : 'Not in your subjects'}</Status> : null}
                    </p>
                    <p className="small">{n.why}</p>
                  </li>
                );
              })}
            </ul>
            {career.school.note ? <p className="small">{career.school.note}</p> : null}
            {career.entry ? (
              <p className="small">
                {career.entry.text} <SourceNote id={career.entry.source} />
              </p>
            ) : null}
          </section>

          <section aria-labelledby="do-h">
            <h2 id="do-h">What you would do</h2>
            <ul className="plain">
              {career.whatYouDo.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="jobs-h">
            <h2 id="jobs-h">Jobs it leads to</h2>
            <ul className="plain">
              {career.jobs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="small muted">Where you would work: {career.whereYouWork.join(', ')}.</p>
          </section>
        </aside>
      </div>

      {programmes.length ? (
        <section className="reqs" aria-labelledby="reqs-h">
          <h2 id="reqs-h">Entry requirements we have checked</h2>
          <p className="muted">
            Published minimums for {programmes[0]!.intake} entry. They change every year, and meeting them lets you apply: it does not guarantee a place. Other universities offer this too, with
            their own rules.
          </p>
          <ul className="programmes">
            {programmes.map((p, i) => {
              const fit = fits?.[i];
              return (
                <li key={p.id} className="programme">
                  <div className="programme-head">
                    <h3>
                      {p.name}
                      <span className="programme-where">
                        {INSTITUTIONS[p.institution].name}, {p.years} years
                      </span>
                    </h3>
                    {fit ? <Status tone={FIT[fit.status].tone}>{FIT[fit.status].label}</Status> : null}
                  </div>
                  <ul className="req-list">
                    {p.aps !== undefined ? (
                      <li className="num">
                        APS of at least {p.aps}
                        {fit?.aps ? <span className="req-you">{fit.aps.complete ? `, you have ${fit.aps.have}` : ''}</span> : null}
                      </li>
                    ) : null}
                    {p.pass ? <li>A {p.pass === 'bachelor' ? "Bachelor's" : 'Diploma'} pass</li> : null}
                    {p.subjects.map((r, j) => {
                      const rc = fit?.requirements[j];
                      return (
                        <li key={j} className="num">
                          {requirementLabel(r)}
                          {rc && rc.percent !== null ? <span className={`req-you${rc.met ? '' : ' short'}`}><span>, you have </span>{rc.percent}%{rc.met ? '' : `, ${rc.shortBy}% short`}</span> : null}
                          {rc && rc.subject === null ? <span className="req-you short">, not one of your subjects</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {p.notes.length ? <p className="small muted">{p.notes.join(' ')}</p> : null}
                  {p.review ? <p className="small review">Check this: {p.review}</p> : null}
                  <p className="small">
                    <SourceNote id={p.source} />
                  </p>
                </li>
              );
            })}
          </ul>
          {!marks ? (
            <p>
              <Link to="/marks">Add your latest marks</Link> to see how far you are from each one.
            </p>
          ) : null}
        </section>
      ) : null}

      <section id="alternatives" className="alternatives" aria-labelledby="alt-h">
        <h2 id="alt-h">If plan A doesn’t work out</h2>
        <p className="muted">There is almost always another way in. These are worth knowing about before you need them.</p>
        <ul className="alt-list">
          {career.alternatives.map((a) => (
            <li key={a.title}>
              <h3>{a.careerId ? <Link to={`/careers/${a.careerId}`}>{a.title}</Link> : a.title}</h3>
              <p>{a.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="funding" aria-labelledby="fund-h">
        <h2 id="fund-h">Paying for it</h2>
        <ul className="alt-list">
          {career.funding.map((f) => {
            const x = FUNDING[f];
            return (
              <li key={f}>
                <h3>
                  <a href={x.apply} target="_blank" rel="noreferrer">
                    {x.name}
                  </a>
                </h3>
                <p>{x.who}</p>
                <p className="small">{[...x.conditions, x.lastCycle].join(' ')}</p>
                <p className="small">
                  <SourceNote id={x.source} />
                </p>
              </li>
            );
          })}
        </ul>
        <p className="small muted">Many companies also offer bursaries in this field. Ask your school and check company websites from Grade 11.</p>
      </section>
    </article>
  );
}

/** One row in any career list: name, what it is, how long. */
export function CareerRow({ career, extra }: { career: Career; extra?: ReactNode }) {
  return (
    <li className="career-row">
      <Link to={`/careers/${career.id}`} className="career-row-link">
        <span className="career-row-name">{career.name}</span>
        <span className="career-row-line">{career.oneLine}</span>
      </Link>
      <span className="career-row-meta">
        <span className="num">{yearsAfterSchool(career)}</span> years after school
        {extra}
      </span>
    </li>
  );
}
