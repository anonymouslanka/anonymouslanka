import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom';
import { ease, pageVariants, spring } from '../lib/motion';
import { cx } from '../lib/util';

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-lg font-display text-lg font-bold tracking-tight">
      <motion.span
        whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.06 }}
        transition={{ duration: 0.6, ease }}
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-brand"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2C7.6 2 4 5.6 4 10c0 3 1.5 4.7 1.5 7h13c0-2.3 1.5-4 1.5-7 0-4.4-3.6-8-8-8Zm-3 9a1.6 1.6 0 1 1 0-3.2A1.6 1.6 0 0 1 9 11Zm6 0a1.6 1.6 0 1 1 0-3.2A1.6 1.6 0 0 1 15 11Z" />
          <path d="M8.5 19h7v1a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-1Z" fill="#f6b01e" />
        </svg>
      </motion.span>
      <span>
        Anonymous <span className="bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-transparent">Lanka</span>
      </span>
    </Link>
  );
}

const links = [
  { to: '/', label: 'Reports', end: true },
  { to: '/my-posts', label: 'My posts' },
  { to: '/guidelines', label: 'Guidelines' },
  { to: '/about', label: 'Privacy' },
];

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="relative rounded-lg px-3.5 py-2 text-sm font-semibold">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-brand-100/80" transition={spring} />}
          <span className={cx('relative transition-colors', isActive ? 'text-brand-800' : 'text-stone-600 hover:text-stone-900')}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Keeps the outgoing route rendered during its exit animation (useOutlet otherwise swaps instantly). */
function Frozen({ children }: { children: ReactNode }) {
  const [frozen] = useState(children);
  return <>{frozen}</>;
}

export function Layout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-800 focus:shadow-lg">
        Skip to content
      </a>
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1, boxShadow: scrolled ? '0 10px 30px -18px rgb(35 31 51 / 0.35)' : '0 0 0 0 rgb(35 31 51 / 0)' }}
        transition={{ duration: 0.5, ease }}
        className={cx('sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300', scrolled ? 'border-stone-200/80 bg-white/80' : 'border-transparent bg-paper/60')}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => <NavItem key={l.to} {...l} />)}
          </nav>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} transition={spring} className="hidden sm:block">
              <Link to="/new" className="btn-primary">Share a report</Link>
            </motion.div>
            <button className="btn-ghost !px-3 md:hidden" aria-expanded={menu} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
              <motion.span animate={{ rotate: menu ? 90 : 0 }} transition={spring} className="inline-block">{menu ? '✕' : '☰'}</motion.span>
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {menu && (
            <motion.nav
              id="mobile-nav"
              aria-label="Mobile"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease }}
              className="overflow-hidden border-t border-stone-200/70 md:hidden"
            >
              <motion.div
                className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              >
                {[...links.slice(0, 1), { to: '/new', label: 'Share a report' }, ...links.slice(1)].map((l) => (
                  <motion.div key={l.to} variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
                    <NavItem {...l} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pathname} variants={pageVariants} initial="initial" animate="enter" exit="exit">
            <Suspense fallback={<div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-64 w-full" /></div>}>
              <Frozen>{outlet}</Frozen>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-stone-200/70 bg-white/60 py-8 text-sm text-stone-500 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Anonymous Lanka · No accounts, no trackers, every post moderated.</p>
          <p className="flex gap-4">
            <Link className="transition-colors hover:text-brand-700" to="/guidelines">Guidelines</Link>
            <Link className="transition-colors hover:text-brand-700" to="/about">Privacy</Link>
          </p>
        </div>
        <p className="mx-auto mt-3 max-w-6xl px-4 text-xs sm:px-6">
          In an emergency call the Sri Lanka Police emergency line <strong>119</strong>. Reports here are not monitored in real time.
        </p>
      </footer>
    </div>
  );
}
