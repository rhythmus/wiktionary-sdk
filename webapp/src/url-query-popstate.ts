import { useEffect } from 'react';

/** Read trimmed `q` from a search string (e.g. `window.location.search`). */
export function readQueryParamQ(search: string): string {
  return (new URLSearchParams(search).get('q') ?? '').trim();
}

/** Initial search box value from the current window URL (SSR-safe). */
export function readInitialQueryFromWindow(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const q = readQueryParamQ(window.location.search);
  return q || fallback;
}

/**
 * Keeps React query state in sync with the URL when the user navigates with back/forward.
 * Does not trigger a refetch — same contract as App.tsx (audit §13.12).
 */
export function usePopstateQuerySync(setQuery: (q: string) => void, emptyFallback: string): void {
  useEffect(() => {
    const onPopState = () => {
      const q = readQueryParamQ(window.location.search);
      setQuery(q || emptyFallback);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setQuery, emptyFallback]);
}
