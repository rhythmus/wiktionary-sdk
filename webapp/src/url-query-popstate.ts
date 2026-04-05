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
 * App.tsx additionally listens for `popstate` and refetches so results match `?q=` (this hook
 * only updates `query` state; use it in harnesses or minimal shells without that refetch).
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
