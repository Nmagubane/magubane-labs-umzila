import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse, PublicConfig } from '../../shared/api.ts';
import { api, ApiError } from './api.ts';
import { invalidate } from './useResource.ts';

interface SessionValue {
  me: MeResponse | null;
  config: PublicConfig | null;
  error: ApiError | null;
  refresh: () => Promise<MeResponse | null>;
  setMe: (m: MeResponse) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const EMPTY: MeResponse = { user: null, plan: null, marks: [], classes: [] };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<MeResponse | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await api.get<MeResponse>('/api/me');
      setMeState(m);
      setError(null);
      return m;
    } catch (e) {
      setError(e as ApiError);
      // The public parts of the app work without the server: carry on as a guest.
      setMeState((prev) => prev ?? EMPTY);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    api.get<PublicConfig>('/api/config').then(setConfig, () => undefined);
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    invalidate('/api');
    setMeState(EMPTY);
  }, []);

  const setMe = useCallback((m: MeResponse) => {
    invalidate('/api/teach');
    setMeState(m);
  }, []);

  return <SessionContext.Provider value={{ me, config, error, refresh, setMe, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
