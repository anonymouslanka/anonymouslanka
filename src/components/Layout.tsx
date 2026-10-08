import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { cx } from '../lib/util';

type Theme = 'light' | 'dark' | 'system';
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'system', setTheme: () => undefined });
const useTheme = () => useContext(ThemeCtx);

function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem('app:theme');
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('app:theme', t);
    } catch {
      /* ignore */
    }
  };
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const icon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️';
  return (
    <button className="btn-ghost !px-3" onClick={() => setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg font-display text-lg font-bold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white shadow-sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2C7.6 2 4 5.6 4 10c0 3 1.5 4.7 1.5 7h13c0-2.3 1.5-4 1.5-7 0-4.4-3.6-8-8-8Zm-3 9a1.6 1.6 0 1 1 0-3.2A1.6 1.6 0 0 1 9 11Zm6 0a1.6 1.6 0 1 1 0-3.2A1.6 1.6 0 0 1 15 11Z" />
          <path d="M8.5 19h7v1a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-1Z" className="text-gold" fill="#ffbe29" />
        </svg>
      </span>
      <span>
        Anonymous <span className="text-brand-700 dark:text-brand-400">Lanka</span>
      </span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200' : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100');

export function Layout() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-800 focus:shadow-lg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>Reports</NavLink>
            <NavLink to="/my-posts" className={navClass}>My posts</NavLink>
            <NavLink to="/guidelines" className={navClass}>Guidelines</NavLink>
            <NavLink to="/about" className={navClass}>Privacy</NavLink>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/new" className="btn-primary hidden sm:inline-flex">Share a report</Link>
            <button className="btn-ghost !px-3 md:hidden" aria-expanded={menu} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
              {menu ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-stone-200 px-4 py-3 md:hidden dark:border-stone-800">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
              <NavLink to="/" end className={navClass}>Reports</NavLink>
              <NavLink to="/new" className={navClass}>Share a report</NavLink>
              <NavLink to="/my-posts" className={navClass}>My posts</NavLink>
              <NavLink to="/guidelines" className={navClass}>Guidelines</NavLink>
              <NavLink to="/about" className={navClass}>Privacy</NavLink>
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 py-8 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Anonymous Lanka · No accounts, no trackers, every post moderated.</p>
          <p className="flex gap-4">
            <Link className="hover:text-brand-700" to="/guidelines">Guidelines</Link>
            <Link className="hover:text-brand-700" to="/about">Privacy</Link>
          </p>
        </div>
        <p className="mx-auto mt-3 max-w-6xl px-4 text-xs sm:px-6">
          In an emergency call the Sri Lanka Police emergency line <strong>119</strong>. Reports here are not monitored in real time.
        </p>
      </footer>
    </div>
  );
}
