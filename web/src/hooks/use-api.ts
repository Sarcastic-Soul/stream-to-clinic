"use client";

import { useEffect, useState } from "react";

type State<T> = { load: () => Promise<T>; data?: T; error?: Error };

/**
 * Runs `load` on mount and whenever its identity changes (wrap it in useCallback when it has arguments).
 * Pass null to skip loading.
 */
export function useApi<T>(load: (() => Promise<T>) | null) {
  const [state, setState] = useState<State<T> | null>(null);

  useEffect(() => {
    if (!load) return;
    let active = true;
    load().then(
      (data) => active && setState({ load, data }),
      (error: Error) => active && setState({ load, error }),
    );
    return () => {
      active = false;
    };
  }, [load]);

  const current = load && state?.load === load ? state : undefined;
  return { data: current?.data, error: current?.error, loading: load !== null && !current };
}
