import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom';
import { ease, pageVariants, spring } from '../lib/motion';
import { cx } from '../lib/util';
import { Icon, IconName, LogoMark } from './Icon';
import { OfflineBar, UpdateToast, usePwa } from './Pwa';
import { haptic } from './ui';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="chrome group flex items-center gap-2.5 rounded-xl" aria-label="DetectiveLanka home">
      <motion.span whileHover={{ rotate: [0, -6, 6, 0], scale: 1.05 }} transition={{ duration: 0.5, ease }} className="shrink-0 drop-shadow-sm">
        <LogoMark size={compact ? 32 : 40} />
      </motion.span>
      <span className="font-display leading-none font-bold tracking-tight text-ink">
        <span className={compact ? 'text-lg' : 'text-xl'}>
          Detective<span className="text-brand-700">Lanka</span>
        </span>
        {!compact && <span className="mt-1 block font-sans text-[0.62rem] font-bold tracking-[0.2em] text-ink-soft uppercase">Anonymous case files</span>}
      </span>
    </Link>
  );
}

const nav: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Cases', icon: 'list', end: true },
  { to: '/my-cases', label: 'My cases', icon: 'folders' },
  { to: '/guidelines', label: 'Code of conduct', icon: 'scale' },
  { to: '/about', label: 'Privacy', icon: 'shieldCheck' },
];

function SideItem({ to, label, icon, end }: { to: string; label: string; icon: IconName; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="chrome relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-ink shadow-[0_8px_20px_-10px_rgb(28_37_65/0.8)]" transition={spring} />}
          <span className={cx('relative flex items-center gap-3 transition-colors', isActive ? 'text-white' : 'text-ink-soft hover:text-ink')}>
            <Icon name={icon} size={19} />
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function TabItem({ to, label, icon, end }: { to: string; label: string; icon: IconName; end?: boolean }) {
  return (
    <NavLink to={to} end={end} onClick={() => haptic(6)} className="chrome relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[0.65rem] font-semibold">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="tab-bar-dot" className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand-600" transition={spring} />}
          <motion.span animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }} transition={spring} className={isActive ? 'text-brand-700' : 'text-stone-500'}>
            <Icon name={icon} size={23} strokeWidth={isActive ? 2.1 : 1.7} />
          </motion.span>
          <span className={isActive ? 'text-brand-700' : 'text-stone-500'}>{label}</span>
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
  const { installable, install, standalone } = usePwa();
  const [scrolled, setScrolled] = useState(false);
  const formRoute = pathname.startsWith('/open-case') || pathname.startsWith('/edit');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="min-h-dvh lg:pl-72">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-800 focus:shadow-lg">
        Skip to content
      </a>

      {/* Desktop / tablet: left rail */}
      <motion.aside initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease }} className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-stone-200/80 bg-white/70 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {nav.map((n) => <SideItem key={n.to} {...n} />)}
        </nav>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={spring} className="mt-6">
          <Link to="/open-case" className="btn-primary w-full !min-h-12 text-base">
            <Icon name="folderPlus" size={20} /> Open Case
          </Link>
        </motion.div>
        {installable && !standalone && (
          <button className="btn-secondary mt-3 w-full" onClick={install}>
            <Icon name="download" size={18} /> Install app
          </button>
        )}
        <div className="mt-auto space-y-2 rounded-2xl bg-folder/45 p-4 text-xs text-ink-soft">
          <p className="flex items-center gap-2 font-bold text-ink"><Icon name="lock" size={14} /> No name. No email. No phone.</p>
          <p>Every case is reviewed before it is published. In an emergency call <strong className="text-brand-700">119</strong>.</p>
        </div>
      </motion.aside>

      <div className="min-w-0">
        <OfflineBar />

        {/* Mobile top bar */}
        <motion.header
          className={cx('sticky top-0 z-30 border-b pt-safe backdrop-blur-xl transition-colors duration-300 lg:hidden', scrolled ? 'border-stone-200/80 bg-white/90' : 'border-transparent bg-white/70')}
        >
          <div className="flex h-14 items-center justify-between px-4">
            <Logo compact />
            <Link to="/open-case" className="btn-navy !min-h-9 !rounded-full !px-3.5 !text-xs">
              <Icon name="plus" size={16} strokeWidth={2.4} /> Open Case
            </Link>
          </div>
        </motion.header>

        <main id="main" className={cx('mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10', formRoute ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12')}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname} variants={pageVariants} initial="initial" animate="enter" exit="exit">
              <Suspense fallback={<div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40 w-full" /></div>}>
                <Frozen>{outlet}</Frozen>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <UpdateToast />

      {/* Mobile: bottom tab bar */}
      <AnimatePresence>
        {!formRoute && (
          <motion.nav
            aria-label="Primary"
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ duration: 0.3, ease }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/90 pb-safe backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto flex max-w-lg items-end px-2">
              <TabItem to="/" label="Cases" icon="list" end />
              <TabItem to="/my-cases" label="My cases" icon="folders" />
              <div className="flex flex-1 justify-center">
                <motion.div whileTap={{ scale: 0.9 }} transition={spring} className="-mt-5">
                  <Link to="/open-case" onClick={() => haptic(12)} aria-label="Open a new case" className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-brand ring-4 ring-paper">
                    <Icon name="folderPlus" size={26} />
                  </Link>
                </motion.div>
              </div>
              <TabItem to="/guidelines" label="Conduct" icon="scale" />
              <TabItem to="/about" label="Privacy" icon="shieldCheck" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
