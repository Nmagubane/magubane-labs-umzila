/**
 * "My setup": grade, subjects, careers and the latest marks. Every screen reads it, so changing a subject anywhere
 * updates every route at once.
 *
 * Signed-in learners: saved on the server (debounced). Guests: kept in this browser only, and moved to the account
 * when they sign up, so nothing typed before sign-up is lost.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MeResponse, PlanBody } from '../../shared/api.ts';
import type { ElectiveId, MathsId } from '../../shared/data/subjects.ts';
import type { Marks, SubjectPackage } from '../../shared/engine/plan.ts';
import type { Grade } from '../../shared/engine/roadmap.ts';
import { api, ApiError } from './api.ts';
import { useSession } from './session.tsx';

export interface Setup {
  grade: Grade;
  englishIs: 'home' | 'additional';
  maths: MathsId;
  electives: ElectiveId[];
  careers: string[];
}

export interface MarksEntry {
  grade: number;
  term: number;
  marks: Marks;
}

const DEFAULT: Setup = { grade: 9, englishIs: 'additional', maths: 'maths', electives: [], careers: [] };
const KEY = 'umzila.setup.v1';
const MARKS_KEY = 'umzila.marks.v1';

function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the setup still works for this visit.
  }
}
function clearLocal(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(MARKS_KEY);
  } catch {
    // ignore
  }
}

interface SetupValue {
  setup: Setup;
  /** True once the learner has picked their electives (until then, subject checks are not shown as warnings). */
  subjectsChosen: boolean;
  pkg: SubjectPackage;
  marks: MarksEntry | null;
  saving: boolean;
  saveError: ApiError | null;
  /** Where it is stored, for honest copy ("Saved to your account" vs "Saved in this browser"). */
  storage: 'account' | 'browser';
  update: (patch: Partial<Setup>) => void;
  toggleCareer: (id: string) => void;
  saveMarks: (entry: MarksEntry) => Promise<void>;
}

const SetupContext = createContext<SetupValue | null>(null);

function fromMe(me: MeResponse): { setup: Setup | null; marks: MarksEntry | null } {
  const p = me.plan;
  const latest = me.marks[0];
  return {
    setup: p ? { grade: p.grade, englishIs: p.englishIs, maths: p.maths, electives: p.electives, careers: p.careers } : null,
    marks: latest ? { grade: latest.grade, term: latest.term, marks: latest.marks } : null,
  };
}

export function SetupProvider({ children }: { children: ReactNode }) {
  const { me, setMe } = useSession();
  const isLearner = !!me?.user && me.user.role === 'learner' && me.user.emailVerified;
  const [setup, setSetup] = useState<Setup>(() => readLocal<Setup>(KEY) ?? DEFAULT);
  const [marks, setMarks] = useState<MarksEntry | null>(() => readLocal<MarksEntry>(MARKS_KEY));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const loadedFor = useRef<string | null>(null);

  // When a learner signs in: load their saved plan, or move the guest setup into the new account.
  useEffect(() => {
    if (!me) return;
    const uid = isLearner ? me.user!.id : null;
    if (loadedFor.current === uid) return;
    loadedFor.current = uid;
    if (!uid) return;
    const server = fromMe(me);
    if (server.setup) {
      setSetup(server.setup);
      setMarks(server.marks);
      clearLocal();
      return;
    }
    const local = readLocal<Setup>(KEY);
    const localMarks = readLocal<MarksEntry>(MARKS_KEY);
    const base: Setup = local ?? DEFAULT;
    const withGrade = { ...base };
    void (async () => {
      try {
        let m = await api.put<MeResponse>('/api/plan', withGrade satisfies PlanBody);
        if (localMarks) m = await api.put<MeResponse>('/api/marks', localMarks);
        setMe(m);
        clearLocal();
      } catch (e) {
        setSaveError(e as ApiError);
      }
    })();
    setSetup(withGrade);
    setMarks(localMarks);
  }, [me, isLearner, setMe]);

  const persist = useCallback(
    (next: Setup) => {
      if (!isLearner) {
        writeLocal(KEY, next);
        return;
      }
      window.clearTimeout(timer.current);
      setSaving(true);
      timer.current = window.setTimeout(() => {
        api.put<MeResponse>('/api/plan', next satisfies PlanBody).then(
          (m) => {
            setSaving(false);
            setSaveError(null);
            setMe(m);
          },
          (e) => {
            setSaving(false);
            setSaveError(e as ApiError);
          },
        );
      }, 500);
    },
    [isLearner, setMe],
  );

  const update = useCallback(
    (patch: Partial<Setup>) => {
      setSetup((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggleCareer = useCallback(
    (id: string) => {
      setSetup((prev) => {
        const has = prev.careers.includes(id);
        const careers = has ? prev.careers.filter((c) => c !== id) : [...prev.careers, id].slice(-3);
        const next = { ...prev, careers };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const saveMarks = useCallback(
    async (entry: MarksEntry) => {
      setMarks(entry);
      if (!isLearner) {
        writeLocal(MARKS_KEY, entry);
        return;
      }
      setSaving(true);
      try {
        setMe(await api.put<MeResponse>('/api/marks', entry));
        setSaveError(null);
      } catch (e) {
        setSaveError(e as ApiError);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [isLearner, setMe],
  );

  const value = useMemo<SetupValue>(
    () => ({
      setup,
      subjectsChosen: setup.electives.length > 0,
      pkg: { maths: setup.maths, electives: setup.electives, englishIs: setup.englishIs },
      marks,
      saving,
      saveError,
      storage: isLearner ? 'account' : 'browser',
      update,
      toggleCareer,
      saveMarks,
    }),
    [setup, marks, saving, saveError, isLearner, update, toggleCareer, saveMarks],
  );
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupValue {
  const v = useContext(SetupContext);
  if (!v) throw new Error('useSetup outside SetupProvider');
  return v;
}
