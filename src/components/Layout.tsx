import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { cx } from '../lib/util';
import { ConnectionBanner } from './ConnectionBanner';
import { HelpSheet } from './HelpSheet';
import { Icon, IconName, LogoMark } from './Icon';
import { OfflineBar, UpdateToast, usePwa } from './Pwa';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="chrome flex items-center gap-2.5 rounded-xl" aria-label="Detective Lanka home">
      <LogoMark size={compact ? 32 : 42} className="shrink-0" />
      <span className="font-display leading-none font-bold tracking-tight text-ink">
        <span className={compact ? 'text-lg' : 'text-xl'}>
          Detective <span className="text-brand-600">Lanka</span>
        </span>
        {!compact && <span className="mt-1 block font-mono text-[0.62rem] font-normal tracking-[0.18em] text-ink-soft uppercase">Anonymous case files</span>}
      </span>
    </Link>
  );
}

const nav: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Cases', icon: 'list', end: true },
  { to: '/my-cases', label: 'My cases', icon: 'folders' },
  { to: '/guidelines', label: 'Code of conduct', icon: 'scale' },
  { to: '/about', label: 'Privacy', icon: 'shieldCheck' },
  { to: '/status', label: 'System status', icon: 'pulse' },
];

/** Screens reached from the bottom tabs. Everything else is a "detail" screen and gets a Back button in the top bar. */
const ROOTS = ['/', '/my-cases', '/guidelines', '/about'];
const TITLES: [string, string][] = [['/case/', 'Case file'], ['/open-case', 'Open a case'], ['/edit/', 'Manage case'], ['/status', 'System status']];
/** Detail screens that bring their own bottom action bar (no tab bar). */
const NO_TABS = ['/open-case', '/edit', '/case/'];

function SideItem({ to, label, icon, end }: { to: string; label: string; icon: IconName; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('chrome flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold', isActive ? 'bg-brand-100 text-brand-800' : 'text-ink-soft active:bg-black/5')}>
      <Icon name={icon} size={20} />
      {label}
    </NavLink>
  );
}

function TabItem({ to, label, icon, end }: { to: string; label: string; icon: IconName; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('chrome flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.66rem] font-bold', isActive ? 'text-brand-700' : 'text-stone-500')}>
      {({ isActive }) => (
        <>
          <span className={cx('grid h-8 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-brand-100')}>
            <Icon name={icon} size={22} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const { installable, install, standalone } = usePwa();
  const [help, setHelp] = useState(false);
  const isRoot = ROOTS.includes(pathname);
  const hideTabs = NO_TABS.some((p) => pathname.startsWith(p));
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Back';

  const goBack = () => (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0 ? navigate(-1) : navigate('/'));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:pl-72">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-800">
        Skip to content
      </a>

      {/* Desktop / tablet: fixed left rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-black/10 bg-[#f8f4ea] p-5 lg:flex">
        <Logo />
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {nav.map((n) => <SideItem key={n.to} {...n} />)}
        </nav>
        <Link to="/open-case" className="btn-primary mt-6 w-full !min-h-14 text-base">
          <Icon name="folderPlus" size={22} /> Open Case
        </Link>
        {installable && !standalone && (
          <button className="btn-secondary mt-3 w-full" onClick={install}>
            <Icon name="download" size={18} /> Install app
          </button>
        )}
        <div className="mt-auto space-y-2 rounded-2xl bg-folder/45 p-4 text-xs text-ink-soft">
          <p className="flex items-center gap-2 font-bold text-ink"><Icon name="lock" size={14} /> No name. No email. No phone.</p>
          <p>Every case is reviewed before it is published. In an emergency call <strong className="text-brand-700">119</strong>.</p>
        </div>
      </aside>

      {/* Phones: slim FIXED top bar. Root screens show the logo; detail screens show Back + title. It never scrolls away. */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-[#f8f4ea] pt-safe lg:hidden">
        <div className="flex h-12 items-center justify-between gap-2 px-2.5">
          {isRoot ? (
            <div className="pl-1.5"><Logo compact /></div>
          ) : (
            <button onClick={goBack} className="chrome flex min-h-11 items-center gap-1 rounded-xl pr-3 pl-1.5 text-[0.95rem] font-bold text-ink active:bg-black/5" aria-label="Go back">
              <Icon name="chevronLeft" size={24} />
              <span className="truncate">{title}</span>
            </button>
          )}
          <button onClick={() => setHelp(true)} className="chrome grid h-11 w-11 place-items-center rounded-full text-ink-soft active:bg-black/5" aria-label="About this app">
            <Icon name="help" size={24} />
          </button>
        </div>
      </header>

      <div className="min-w-0 pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0">
        <OfflineBar />
        <ConnectionBanner />
        <main id="main" className={cx('mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10', hideTabs ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12')}>
          <div key={pathname} className="page-in">
            <Suspense fallback={<div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40 w-full" /></div>}>{outlet}</Suspense>
          </div>
        </main>
      </div>

      <UpdateToast />
      <HelpSheet open={help} onClose={() => setHelp(false)} />

      {/* Phones: fixed bottom tab bar (hidden on screens that have their own action bar) */}
      {!hideTabs && (
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f8f4ea] pb-safe lg:hidden">
          <div className="mx-auto flex max-w-lg items-end px-2">
            <TabItem to="/" label="Cases" icon="list" end />
            <TabItem to="/my-cases" label="My cases" icon="folders" />
            <div className="flex flex-1 justify-center">
              <Link to="/open-case" aria-label="Open a new case" className="btn-primary -mt-5 !h-14 !min-h-14 !w-14 !rounded-2xl !p-0 ring-4 ring-[#f8f4ea]">
                <Icon name="folderPlus" size={26} />
              </Link>
            </div>
            <TabItem to="/guidelines" label="Conduct" icon="scale" />
            <TabItem to="/about" label="Privacy" icon="shieldCheck" />
          </div>
        </nav>
      )}
    </div>
  );
}
