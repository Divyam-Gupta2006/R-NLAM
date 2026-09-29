'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './client';

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => void;
}

/** Tiny cache so revisiting a page renders instantly while it refreshes. */
const cache = new Map<string, unknown>();

/**
 * GET a path and track loading / error / data. Pass `null` to skip (e.g. until
 * an id is known). Refetches when the path changes or `reload()` is called.
 */
export function useApi<T>(path: string | null, opts: { refreshMs?: number } = {}): ApiState<T> {
  const [data, setData] = useState<T | undefined>(() => (path ? (cache.get(path) as T | undefined) : undefined));
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState<boolean>(!!path);
  const [tick, setTick] = useState(0);
  const current = useRef(path);

  useEffect(() => {
    current.current = path;
    if (!path) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    if (cache.has(path)) setData(cache.get(path) as T);
    api
      .get<T>(path)
      .then((d) => {
        if (!alive || current.current !== path) return;
        cache.set(path, d);
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  useEffect(() => {
    if (!opts.refreshMs || !path) return;
    const t = setInterval(() => setTick((x) => x + 1), opts.refreshMs);
    return () => clearInterval(t);
  }, [opts.refreshMs, path]);

  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, error, loading, reload };
}

/** Run a write and expose its pending/error state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(undefined);
      try {
        return await fn(...args);
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, reset: () => setError(undefined) };
}

export function clearApiCache() {
  cache.clear();
}
