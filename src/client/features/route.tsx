/**
 * The route map: the one bold visual in Umzila. A transit line from the learner's grade to a registered career.
 * Stations are milestones; "you are here" is the learner's grade; a closed route turns the line after it dashed.
 */
import { Fragment } from 'react';
import { PHASE_LABEL, type Grade, type Milestone, type Phase } from '../../shared/engine/roadmap.ts';

const PHASES: Phase[] = ['grade-9', 'grade-10', 'grade-11', 'grade-12', 'after'];

const KIND_LABEL: Partial<Record<Milestone['kind'], string>> = {
  decision: 'Decision',
  action: 'To do',
  target: 'Mark target',
  deadline: 'Deadline',
  funding: 'Funding',
  study: 'Study',
  practice: 'Training',
  exam: 'Exam',
  register: 'Qualified',
  work: 'Work',
};

export function RouteMap({ milestones, grade, compact = false }: { milestones: Milestone[]; grade: Grade; compact?: boolean }) {
  const blocked = milestones.some((m) => m.kind === 'warning');
  const here: Phase = `grade-${grade}` as Phase;
  // The line goes dashed from the phase after the warning: the stations in the same phase are how to fix it.
  const warnPhase = milestones.find((m) => m.kind === 'warning')?.phase;
  const cutFrom = warnPhase ? PHASES.indexOf(warnPhase) + 1 : PHASES.length;
  return (
    <ol className={`route${compact ? ' route-compact' : ''}`} aria-label="Your route">
      {PHASES.map((phase) => {
        const items = milestones.filter((m) => m.phase === phase);
        if (!items.length) return null;
        const isHere = phase === here;
        const afterWarning = PHASES.indexOf(phase) >= cutFrom;
        return (
          <Fragment key={phase}>
            <li className={`route-phase${isHere ? ' is-here' : ''}${afterWarning ? ' is-cut' : ''}`}>
              <span className="route-interchange" aria-hidden />
              <span className="route-phase-name">{PHASE_LABEL[phase]}</span>
              {isHere ? <span className="route-here">You are here</span> : null}
            </li>
            {items.map((m, i) => {
              const cut = afterWarning;
              const terminus = m.kind === 'register' && !milestones.slice(milestones.indexOf(m) + 1).some((x) => x.kind === 'register');
              return (
                <li key={`${phase}-${i}`} className={`route-stop stop-${m.kind}${cut ? ' is-cut' : ''}${terminus ? ' is-terminus' : ''}`}>
                  <span className="route-dot" aria-hidden>
                    {m.kind === 'warning' ? '✗' : null}
                  </span>
                  <div className="route-body">
                    <p className="route-meta">
                      {m.kind === 'warning' ? <strong className="route-closed-label">Route closed</strong> : KIND_LABEL[m.kind]}
                      {m.years ? <span className="num">, {m.years === 1 ? '1 year' : `${m.years} years`}</span> : null}
                    </p>
                    <h3 className="route-title">{m.title}</h3>
                    {!compact || m.kind === 'warning' ? <p className="route-detail">{m.detail}</p> : null}
                    {m.target ? <TargetMeter {...m.target} /> : null}
                  </div>
                </li>
              );
            })}
          </Fragment>
        );
      })}
      {blocked ? (
        <li className="route-stop stop-note is-cut">
          <span className="route-dot" aria-hidden />
          <div className="route-body">
            <p className="route-detail">The dashed part of the line is out of reach with your current subjects.</p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

/** A 0–100 ruler: the published minimum, the aim, and the learner's current mark if we have it. */
export function TargetMeter({ minimum, aim, current }: { minimum: number; aim: number; current?: number }) {
  const state = current === undefined ? 'none' : current >= aim ? 'aim' : current >= minimum ? 'min' : 'below';
  const text =
    current === undefined
      ? `Minimum ${minimum}%, aim ${aim}%. Add your marks to see where you are.`
      : state === 'below'
        ? `You have ${current}%: ${minimum - current}% below the minimum.`
        : state === 'min'
          ? `You have ${current}%: above the minimum, ${aim - current}% to your aim.`
          : `You have ${current}%: at or above your aim.`;
  return (
    <div className={`meter meter-${state}`}>
      <div className="meter-track" role="img" aria-label={text}>
        {current !== undefined ? <span className="meter-fill" style={{ width: `${current}%` }} /> : null}
        <span className="meter-tick meter-min" style={{ left: `${minimum}%` }} />
        <span className="meter-tick meter-aim" style={{ left: `${aim}%` }} />
      </div>
      <p className="meter-text num">{text}</p>
    </div>
  );
}
