/**
 * Minimal data loading with a stale-while-revalidate cache, so going back to a page is instant.
 * One hook, explicit keys, no global magic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api.ts';

const cache = new Map<string, unknown>();

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

export function useResource<T>(path: string | null): Resource<T> {
  const [data, setDataState] = useState<T | undefined>(() => (path ? (cache.get(path) as T | undefined) : undefined));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null && !cache.has(path));
  const current = useRef(path);

  const load = useCallback(async () => {
    if (!path) return;
    current.current = path;
    setLoading(!cache.has(path));
    setError(null);
    try {
      const d = await api.get<T>(path);
      if (current.current !== path) return;
      cache.set(path, d);
      setDataState(d);
    } catch (e) {
      if (current.current !== path) return;
      setError(e instanceof ApiError ? e : new ApiError(0, 'unknown', 'Something went wrong.'));
    } finally {
      if (current.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setDataState(path ? (cache.get(path) as T | undefined) : undefined);
    void load();
  }, [path, load]);

  const setData = useCallback(
    (d: T) => {
      if (path) cache.set(path, d);
      setDataState(d);
    },
    [path],
  );

  return { data, error, loading, reload: load, setData };
}

/** Drop cached responses whose key starts with any prefix (after a mutation). */
export function invalidate(...prefixes: string[]) {
  for (const k of [...cache.keys()]) if (prefixes.some((p) => k.startsWith(p))) cache.delete(k);
}
