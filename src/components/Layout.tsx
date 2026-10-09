import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { resyncPush, UnreadCtx, useUnreadProvider } from '../lib/notify';
import { cx } from '../lib/util';
import { ConnectionBanner } from './ConnectionBanner';
import { Icon, IconName, LogoMark } from './Icon';
import { LanguageSheet } from './LanguageSheet';
import { OfflineBar, UpdateToast, usePwa } from './Pwa';

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="chrome flex items-center gap-2.5 rounded-xl" aria-label={t('Detective Lanka home')}>
      <LogoMark size={compact ? 32 : 42} className="shrink-0" />
      <span className="font-display leading-none font-bold tracking-tight text-ink">
        <span className={compact ? 'text-lg' : 'text-xl'}>
          Detective <span className="text-brand-600">Lanka</span>
        </span>
        {!compact && <span className="mt-1 block font-mono text-[0.62rem] font-normal tracking-[0.18em] text-ink-soft uppercase">{t('Anonymous case files')}</span>}
      </span>
    </Link>
  );
}

const nav: { to: string; label: string; icon: IconName; end?: boolean; motion: string }[] = [
  { to: '/', label: 'Cases', icon: 'list', end: true, motion: 'slide' },
  { to: '/my-cases', label: 'My cases', icon: 'folders', motion: 'tilt' },
  { to: '/guidelines', label: 'Code of conduct', icon: 'scale', motion: 'sway' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', motion: 'ring' },
  { to: '/about', label: 'Privacy', icon: 'shieldCheck', motion: 'pop' },
  { to: '/status', label: 'System status', icon: 'pulse', motion: 'beat' },
];

/** Screens reached from the bottom tabs. Everything else is a "detail" screen and gets a Back button in the top bar. */
const ROOTS = ['/', '/my-cases', '/guidelines', '/about'];
const TITLES: [string, string][] = [['/notifications/settings', 'Settings'], ['/notifications', 'Notifications'], ['/announcement/', 'Announcement'], ['/case/', 'Case file'], ['/open-case', 'Open a case'], ['/edit/', 'Manage case'], ['/status', 'System status']];
/** Detail screens that bring their own bottom action bar (no tab bar). */
const NO_TABS = ['/open-case', '/edit', '/case/'];

function SideItem({ to, label, icon, end, motion, badge = 0 }: { to: string; label: string; icon: IconName; end?: boolean; motion: string; badge?: number }) {
  const { t } = useI18n();
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('chrome flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold', isActive ? 'bg-brand-100 text-brand-800' : 'text-ink-soft active:bg-black/5')}>
      {({ isActive }) => (
        <>
          <span className={cx('mo', isActive && 'on')} data-motion={motion}><Icon name={icon} size={20} /></span>
          {t(label)}
      {badge > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[0.68rem] font-bold text-white" aria-label={t('{n} unread', { n: badge })}>{badge > 9 ? '9+' : badge}</span>}
        </>
      )}
    </NavLink>
  );
}

/** Marker that slides under the active tab (its position is measured, so it also works at any width or language). */
function TabWorm({ watch }: { watch: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const bar = el?.parentElement;
    if (!el || !bar) return;
    let first = true;
    const place = () => {
      const icon = bar.querySelector<HTMLElement>('a[aria-current="page"] .tab-icon');
      if (!icon) {
        el.style.opacity = '0';
        return;
      }
      const b = bar.getBoundingClientRect();
      const r = icon.getBoundingClientRect();
      el.style.opacity = '1';
      el.style.transform = `translateX(${Math.round(r.left - b.left + r.width / 2 - 14)}px)`;
      if (!first) {
        el.classList.remove('go');
        void el.offsetWidth;
        el.classList.add('go');
      }
      first = false;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [watch]);
  return <span ref={ref} className="tab-worm" aria-hidden="true" />;
}

function TabItem({ to, label, icon, end, motion }: { to: string; label: string; icon: IconName; end?: boolean; motion: string }) {
  const { t } = useI18n();
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('chrome flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.66rem] font-bold', isActive ? 'text-brand-700' : 'text-stone-500')}>
      {({ isActive }) => (
        <>
          <span className={cx('tab-icon mo', isActive && 'on')} data-motion={motion}>
            <Icon name={icon} size={22} />
          </span>
          <span className="tab-label max-w-full truncate px-0.5">{t(label)}</span>
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
  const unread = useUnreadProvider();
  const { t, lang } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const isRoot = ROOTS.includes(pathname);
  const hideTabs = NO_TABS.some((p) => pathname.startsWith(p));
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Back';
  const heading = t(title);

  const goBack = () => (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0 ? navigate(-1) : navigate('/'));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // The service worker tells the open app when a push arrives or a notification is tapped; the app re-checks, or opens that screen.
  useEffect(() => {
    void resyncPush();
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: unknown } | null;
      if (d?.type === 'push-received') unread.refresh();
      else if (d?.type === 'push-resubscribe') {
        try {
          sessionStorage.removeItem('app:push-synced');
        } catch {
          /* ignore */
        }
        void resyncPush();
      } else if (d?.type === 'navigate' && typeof d.url === 'string' && /^\/(case\/[a-z0-9]{8,24}|announcement\/[a-z0-9]{20,30}|notifications)$/.test(d.url)) navigate(d.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, unread.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <UnreadCtx.Provider value={unread}>
    <div className="min-h-dvh lg:pl-72">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-800">
        {t('Skip to content')}
      </a>

      {/* Desktop / tablet: fixed left rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-black/10 bg-[#f8f4ea] p-5 lg:flex">
        <Logo />
        <nav aria-label={t('Main')} className="mt-8 flex flex-col gap-1">
          {nav.map((n) => <SideItem key={n.to} {...n} badge={n.to === '/notifications' ? unread.count : 0} />)}
        </nav>
        <Link to="/open-case" className="btn-primary mt-6 w-full !min-h-14 text-base">
          <Icon name="folderPlus" size={22} /> {t('Open Case')}
        </Link>
        {installable && !standalone && (
          <button className="btn-secondary mt-3 w-full" onClick={install}>
            <Icon name="download" size={18} /> {t('Install app')}
          </button>
        )}
        <button className="btn-secondary mt-3 w-full" onClick={() => setLangOpen(true)}>
          <Icon name="globe" size={18} /> {t('Language')} · <span lang={lang}>{lang === 'en' ? 'English' : lang === 'si' ? 'සිංහල' : 'தமிழ்'}</span>
        </button>
        <div className="mt-auto space-y-2 rounded-2xl bg-folder/45 p-4 text-xs text-ink-soft">
          <p className="flex items-center gap-2 font-bold text-ink"><Icon name="lock" size={14} /> {t('No name. No email. No phone.')}</p>
          <p>{t('Every case is reviewed before it is published.')} {t('In an emergency call')} <strong className="text-brand-700">119</strong>.</p>
        </div>
      </aside>

      {/* Phones: slim FIXED top bar. Root screens show the logo; detail screens show Back + title. It never scrolls away. */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-[#f8f4ea] pt-safe lg:hidden">
        <div className="flex h-12 items-center justify-between gap-2 px-2.5">
          {isRoot ? (
            <div className="pl-1.5"><Logo compact /></div>
          ) : (
            <button onClick={goBack} className="chrome flex min-h-11 items-center gap-1 rounded-xl pr-3 pl-1.5 text-[0.95rem] font-bold text-ink active:bg-black/5" aria-label={t('Go back')}>
              <Icon name="chevronLeft" size={24} />
              <span className="truncate">{heading}</span>
            </button>
          )}
          <div className="flex items-center">
          <button onClick={() => setLangOpen(true)} className="chrome mo mo-press grid h-11 w-11 place-items-center rounded-full text-ink-soft active:bg-black/5" data-motion="spin" aria-label={t('Language')}>
            <Icon name="globe" size={23} />
          </button>
          <Link to="/notifications" data-motion="ring" className="chrome mo mo-press relative grid h-11 w-11 place-items-center rounded-full text-ink-soft active:bg-black/5" aria-label={unread.count > 0 ? t('Notifications, {n} unread', { n: unread.count }) : t('Notifications')}>
            <Icon name="bell" size={24} />
            {unread.count > 0 && <span className="absolute top-1 right-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-brand-600 px-1 text-[0.62rem] leading-none font-bold text-white" aria-hidden="true">{unread.count > 9 ? '9+' : unread.count}</span>}
          </Link>
          </div>
        </div>
      </header>

      <div className="min-w-0 pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0">
        <OfflineBar />
        <ConnectionBanner />
        <main id="main" className={cx('mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10 2xl:max-w-[88rem]', hideTabs ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12')}>
          <div key={pathname + lang} className="page-in">
            <Suspense fallback={<div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40 w-full" /></div>}>{outlet}</Suspense>
          </div>
        </main>
      </div>

      <UpdateToast />
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      {/* Phones: fixed bottom tab bar (hidden on screens that have their own action bar) */}
      {!hideTabs && (
        <nav aria-label={t('Primary')} className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f8f4ea] pb-safe lg:hidden">
          <div className="relative mx-auto flex max-w-lg items-end px-2">
            <TabWorm watch={pathname + lang} />
            <TabItem to="/" label="Cases" icon="list" end motion="slide" />
            <TabItem to="/my-cases" label="My cases" icon="folders" motion="tilt" />
            <div className="flex flex-1 justify-center">
              <Link to="/open-case" aria-label={t('Open a new case')} data-motion="spin" className="mo mo-press btn-primary -mt-5 !h-14 !min-h-14 !w-14 !rounded-2xl !p-0 ring-4 ring-[#f8f4ea]">
                <Icon name="folderPlus" size={26} />
              </Link>
            </div>
            <TabItem to="/guidelines" label="Conduct" icon="scale" motion="sway" />
            <TabItem to="/about" label="Privacy" icon="shieldCheck" motion="pop" />
          </div>
        </nav>
      )}
    </div>
    </UnreadCtx.Provider>
  );
}
