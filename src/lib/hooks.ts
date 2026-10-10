import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (d: T | null) => void;
}

/** Minimal data-loading hook with race protection (stale responses are ignored). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], initial?: T | null): AsyncState<T> {
  const [data, setData] = useState<T | null>(initial ?? null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(initial == null);
  const warm = useRef(initial != null);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    if (warm.current) warm.current = false; // first run with a warm value: refresh without a loading state
    else setLoading(true);
    setError(null);
    fn()
      .then((d) => run.current === id && setData(d))
      .catch((e: unknown) => run.current === id && setError(e instanceof ApiError ? e : new ApiError('Something went wrong.', 0, 'ERROR')))
      .finally(() => run.current === id && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
