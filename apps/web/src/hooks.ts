import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

/** Loads data with explicit loading and error states. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null
  });
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const call = ++latest.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    load().then(
      (data) => {
        if (call === latest.current) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (call === latest.current) setState({ data: null, loading: false, error: messageOf(error) });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
