/**
 * A tiny client router (History API). Enough for this app; no dependency.
 * Moves focus to the page heading on navigation so screen-reader and keyboard users land in the right place.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

interface RouterValue {
  path: string;
  search: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname, search: window.location.search }));

  useEffect(() => {
    const onPop = () => setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname + url.search === window.location.pathname + window.location.search) return;
    if (opts?.replace) window.history.replaceState(null, '', url.pathname + url.search);
    else window.history.pushState(null, '', url.pathname + url.search);
    setLoc({ path: url.pathname, search: url.search });
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ path: loc.path, search: new URLSearchParams(loc.search), navigate }), [loc, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const v = useContext(RouterContext);
  if (!v) throw new Error('useRouter outside RouterProvider');
  return v;
}

/** Match "/tests/:id/results" against a path. Returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as string;
    const b = s[i] as string;
    if (a.startsWith(':')) params[a.slice(1)] = decodeURIComponent(b);
    else if (a !== b) return null;
  }
  return params;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean };

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, replace ? { replace } : undefined);
  };
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

/** Focus the page's main heading after route changes (not on first load). */
export function useRouteFocus(path: string) {
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    const id = window.setTimeout(() => {
      // A page can name where to start ([data-autofocus], e.g. the password when the email is known);
      // otherwise focus goes to the heading so screen readers announce the new page.
      const start = document.querySelector<HTMLElement>('main [data-autofocus]');
      if (start) {
        start.focus({ preventScroll: true });
        return;
      }
      const h = document.querySelector<HTMLElement>('main h1');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
