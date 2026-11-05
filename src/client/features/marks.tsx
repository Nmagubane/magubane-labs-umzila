import { useEffect, useState } from 'react';
import { careerById } from '../../shared/data/careers.ts';
import { INSTITUTIONS } from '../../shared/data/programmes.ts';
import { levelOf, SUBJECTS, type SubjectId } from '../../shared/data/subjects.ts';
import { biggestGap, checkProgramme, estimatePass, packageSubjects, PASS_LABEL, programmesFor, standardAps, type Marks } from '../../shared/engine/plan.ts';
import { Link } from '../lib/router.tsx';
import { useSetup } from '../lib/setup.tsx';
import { Button, Notice, PageHeader, SelectField, SourceNote, Status } from '../ui/bits.tsx';
import { FIT } from './career.tsx';
import type { ApiError } from '../lib/api.ts';

export function MarksPage() {
  const { setup, pkg, subjectsChosen, marks, saveMarks, storage } = useSetup();
  const subjects = packageSubjects(pkg);
  const [grade, setGrade] = useState<number>(marks?.grade ?? setup.grade);
  const [term, setTerm] = useState<number>(marks?.term ?? 1);
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(marks?.marks ?? {}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!marks) return;
    setDraft(toDraft(marks.marks));
    setGrade(marks.grade);
    setTerm(marks.term);
  }, [marks]);

  const parsed: Marks = {};
  const invalid: string[] = [];
  for (const s of subjects) {
    const raw = draft[s]?.trim();
    if (!raw) continue;
    const n = Number(raw.replace(',', '.').replace('%', ''));
    if (Number.isFinite(n) && n >= 0 && n <= 100) parsed[s] = Math.round(n);
    else invalid.push(SUBJECTS[s].name);
  }

  const aps = standardAps(pkg, parsed);
  const pass = estimatePass(pkg, parsed);
  const goals = setup.careers.map((id) => careerById(id)).filter((c) => !!c);

  const onSave = async () => {
    if (invalid.length) {
      setError(`Marks are between 0 and 100. Check ${invalid.join(', ')}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveMarks({ grade, term, marks: parsed });
      setSaved(true);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="marks-page">
      <PageHeader title="Your marks" lead="Copy the percentages from your latest school report. Umzila works out your APS and shows how far you are from each programme." />
      {!subjectsChosen ? (
        <Notice tone="risk" title="Choose your subjects first">
          <p>
            Your marks are checked against your seven subjects. <Link to="/subjects">Choose them here</Link>, then come back.
          </p>
        </Notice>
      ) : null}
      <div className="two-col">
        <form
          className="marks-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <div className="inline-fields">
            <SelectField label="Report from" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </SelectField>
            <SelectField label="Term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t === 4 ? 'Final (term 4)' : `Term ${t}`}
                </option>
              ))}
            </SelectField>
          </div>
          {grade === 9 ? <p className="small muted">In Grade 9, use your Natural Sciences mark for Physical and Life Sciences, and leave subjects you don’t take yet empty.</p> : null}
          <table className="marks-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Mark (%)</th>
                <th scope="col">Level</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const v = parsed[s];
                return (
                  <tr key={s}>
                    <th scope="row">
                      <label htmlFor={`m-${s}`}>{subjectLabel(s, setup.englishIs)}</label>
                    </th>
                    <td>
                      <input
                        id={`m-${s}`}
                        className="mark-input num"
                        inputMode="decimal"
                        value={draft[s] ?? ''}
                        onChange={(e) => {
                          setSaved(false);
                          setDraft({ ...draft, [s]: e.target.value });
                        }}
                        aria-invalid={invalid.includes(SUBJECTS[s].name) || undefined}
                        maxLength={5}
                      />
                    </td>
                    <td className="num level-cell">{v !== undefined ? levelOf(v) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error ? <p className="field-error">{error}</p> : null}
          <div className="form-actions">
            <Button type="submit" busy={busy}>
              Save marks
            </Button>
            {saved ? <span className="saved-note">{storage === 'account' ? 'Saved to your account.' : 'Saved in this browser.'}</span> : null}
          </div>
          {storage === 'browser' ? (
            <p className="small muted">
              Marks you save here stay in this browser only. <Link to="/signup">Create an account</Link> to keep them and share your plan with your teacher.
            </p>
          ) : null}
        </form>

        <section className="results" aria-live="polite" aria-labelledby="res-h">
          <h2 id="res-h" className="sr-only">
            Results
          </h2>
          <div className="big-numbers">
            <div>
              <p className="big-number num">
                {aps.total}
                <span className="big-of">/{aps.max}</span>
              </p>
              <p className="big-label">APS{aps.complete ? '' : ` (${aps.counted.length} of 6 subjects entered)`}</p>
            </div>
            <div>
              <p className="big-word">{PASS_LABEL[pass.level]}</p>
              <p className="big-label">Estimated NSC result{pass.complete ? '' : ' (enter all seven to be sure)'}</p>
            </div>
          </div>
          <p className="small muted">
            APS here is the common method: your six subjects on the 1–7 scale, Life Orientation not counted, out of 42. Some universities count differently. The pass level is an estimate from
            Department of Basic Education rules: <SourceNote id="wced-bachelor-pass" />.
          </p>

          {goals.length ? (
            goals.map((career) => {
              const fits = programmesFor(career).map((p) => checkProgramme(pkg, parsed, p));
              const gap = biggestGap(fits);
              return (
                <div key={career.id} className="goal-fit">
                  <h3>
                    <Link to={`/careers/${career.id}`}>{career.name}</Link>
                  </h3>
                  {gap ? (
                    <p>
                      Work on <mark className="hl">{SUBJECTS[gap.subject].name}</mark> first: you are {gap.shortBy}% short of the minimum for {gap.programme.name} at {INSTITUTIONS[gap.programme.institution].short}.
                    </p>
                  ) : null}
                  {fits.length ? (
                    <ul className="fit-list">
                      {fits.map((f) => (
                        <li key={f.programme.id}>
                          <span>
                            {f.programme.name}, {INSTITUTIONS[f.programme.institution].short}
                          </span>
                          <Status tone={FIT[f.status].tone}>{FIT[f.status].label}</Status>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small">This route has no university admission table. {career.entry?.text}</p>
                  )}
                </div>
              );
            })
          ) : (
            <p>
              <Link to="/">Add a career to your plan</Link> and you’ll see how your marks compare with what it needs.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function toDraft(m: Marks): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]));
}

function subjectLabel(s: SubjectId, englishIs: 'home' | 'additional'): string {
  if (s === 'english') return englishIs === 'home' ? 'English Home Language' : 'English First Additional Language';
  if (s === 'other-language') return englishIs === 'home' ? 'First Additional Language' : 'Home Language';
  return SUBJECTS[s].name;
}
