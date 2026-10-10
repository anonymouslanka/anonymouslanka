import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigationType, useSearchParams } from 'react-router-dom';
import { CaseCard } from '../components/CaseCard';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/Pwa';
import { CaseRowSkeleton, Dialog, EmptyState, ErrorState } from '../components/ui';
import { api, ApiError, forget } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { Stagger } from '../lib/motion';
import { PullIndicator, usePullToRefresh } from '../lib/ptr';
import type { PostSummary } from '../lib/types';
import { cx, useDebounced, usePageMeta } from '../lib/util';

/** What the list looked like when you left (per filter combination), so coming back is instant and lands where you were. */
interface HomeSnap {
  items: PostSummary[];
  cursor: string | null;
  hasMore: boolean;
  scroll: number;
  at: number;
}
const homeSnap = new Map<string, HomeSnap>();
const SNAP_FRESH_MS = 60_000;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={cx('chip', active && 'chip-active')} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-2xl bg-black/5 p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={cx('min-h-11 rounded-xl px-3 text-sm font-bold', o.value === value ? 'bg-white text-ink' : 'text-ink-soft')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const qParam = params.get('q') ?? '';
  const sort = (params.get('sort') === 'oldest' ? 'oldest' : 'newest') as 'newest' | 'oldest';
  const exhibits = params.get('exhibits') === 'true';
  const [q, setQ] = useState(qParam);
  const debounced = useDebounced(q.trim(), 350);
  const [sheet, setSheet] = useState(false);

  usePageMeta({ description: 'Browse moderated, anonymous case files about crime in Sri Lanka, or open a case yourself without an account.', path: '/' });

  const categories = useAsync(() => api.categories(), [], api.peekCategories());

  const setParam = useCallback(
    (patch: Record<string, string>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      }, { replace: true });
    },
    [setParams],
  );
  useEffect(() => {
    if (debounced !== qParam) setParam({ q: debounced });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const navType = useNavigationType();
  const snapKey = `${qParam}|${category}|${tag}|${sort}|${exhibits}`;
  const snap = useRef(homeSnap.get(snapKey));
  const fetchedAt = useRef(snap.current?.at ?? 0);
  const firstRun = useRef(true);
  const [instant, setInstant] = useState(Boolean(snap.current)); // restored lists do not replay the entrance animation
  const [items, setItems] = useState<PostSummary[]>(snap.current?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(snap.current?.cursor ?? null);
  const [hasMore, setHasMore] = useState(snap.current?.hasMore ?? false);
  const [loading, setLoading] = useState(!snap.current);
  const [error, setError] = useState<ApiError | null>(null);
  const [moreError, setMoreError] = useState(false);
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (next: string | null) => {
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      setMoreError(false);
      try {
        const page = await api.listPosts({ cursor: next, q: qParam, category, tag, sort, exhibits, limit: 12 });
        if (id !== seq.current) return;
        fetchedAt.current = Date.now();
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.meta.nextCursor);
        setHasMore(page.meta.hasMore);
      } catch (e) {
        if (id === seq.current) {
          if (next) setMoreError(true);
          else setError(e as ApiError);
        }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [qParam, category, tag, sort, exhibits],
  );

  useEffect(() => {
    const restored = firstRun.current ? homeSnap.get(snapKey) : undefined;
    firstRun.current = false;
    if (restored && Date.now() - restored.at < SNAP_FRESH_MS) return; // fresh copy already on screen: no request at all
    if (!restored) {
      setItems([]);
      setInstant(false);
    }
    void load(null); // stale copy stays visible while the new first page arrives
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // remember the list for the next visit (position is kept up to date by the scroll listener below)
  useEffect(() => {
    if (items.length === 0) return;
    homeSnap.set(snapKey, { items, cursor, hasMore, scroll: homeSnap.get(snapKey)?.scroll ?? 0, at: fetchedAt.current || Date.now() });
  }, [items, cursor, hasMore, snapKey]);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = homeSnap.get(snapKey);
        if (s) s.scroll = window.scrollY;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [snapKey]);
  // Back / forward returns to where you were; tapping a tab starts at the top (the list itself is still instant)
  useLayoutEffect(() => {
    if (navType === 'POP' && snap.current && snap.current.scroll > 0) window.scrollTo(0, snap.current.scroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Endless scroll: the next page is requested while the reader is still ~1.5 screens away from the end, so they never wait or press anything.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || moreError) return;
    if (!('IntersectionObserver' in window)) {
      void load(cursor);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void load(cursor);
      }
    }, { rootMargin: '0px 0px 1400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, moreError, cursor, load, items.length]);

  const { pull, refreshing } = usePullToRefresh(() => { forget('feed:'); return load(null); });

  const activeFilters = (sort === 'oldest' ? 1 : 0) + (exhibits ? 1 : 0) + (tag ? 1 : 0);
  const filtered = Boolean(qParam || category || activeFilters);
  const gridKey = `${qParam}|${category}|${tag}|${sort}|${exhibits}`;
  const clearAll = () => {
    setQ('');
    setParams({}, { replace: true });
  };

  return (
    <div>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <InstallCard />

      <header className="mb-4">
        <h1 className="font-display text-3xl leading-tight font-bold sm:text-4xl">{t('Case files')}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">{t('Open cases reported by the public. Every file is reviewed by a moderator before it is published.')}</p>
        <p className="mt-3 flex max-w-xl items-start gap-2.5 rounded-2xl border border-folder-deep/60 bg-folder/40 p-3.5 text-sm text-[#5d430c]"><Icon name="scale" size={20} className="mt-0.5 shrink-0" /> <span>{t('Serious crimes that the law has not answered fairly. Read the facts, share what you know, and say, anonymously, what punishment would be just.')}</span></p>
      </header>

      <section aria-label={t('Search and filters')} className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="search" className="sr-only">{t('Search cases')}</label>
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400"><Icon name="search" size={20} /></span>
            <input id="search" type="search" enterKeyHint="search" className="input !h-[3.25rem] !rounded-2xl !pl-11" placeholder={t('Search by title or case number')} value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
          </div>
          <button onClick={() => setSheet(true)} className="btn-secondary relative !min-h-[3.25rem] !rounded-2xl !px-4" aria-label={t('Filters')}>
            <Icon name="sliders" size={22} />
            {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white">{activeFilters}</span>}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 lg:-mx-10 lg:px-10" role="group" aria-label={t('Filter by case type')}>
          <Chip active={!category} onClick={() => setParam({ category: '' })}>{t('All types')}</Chip>
          {categories.data?.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => setParam({ category: category === c.slug ? '' : c.slug })}>{t(c.name)}</Chip>
          ))}
        </div>

        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-2">
            {sort === 'oldest' && <button className="chip chip-active" onClick={() => setParam({ sort: '' })}>{t('Oldest first')} <Icon name="x" size={13} /></button>}
            {exhibits && <button className="chip chip-active" onClick={() => setParam({ exhibits: '' })}>{t('With exhibits')} <Icon name="x" size={13} /></button>}
            {tag && <button className="chip chip-active" onClick={() => setParam({ tag: '' })}>#{tag} <Icon name="x" size={13} /></button>}
          </div>
        )}
      </section>

      <section aria-live="polite">
        {error ? (
          <ErrorState message={error.message} onRetry={() => load(null)} />
        ) : (
          <>
            {!loading && items.length === 0 && (
              <EmptyState
                icon={filtered ? 'search' : 'inbox'}
                title={filtered ? t('No case files match') : t('No open cases yet')}
                message={filtered ? t('Try different words or clear your filters.') : t('Case files appear here once a moderator clears them.')}
                action={filtered ? <button className="btn-secondary" onClick={clearAll}>{t('Clear filters')}</button> : <Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={20} /> {t('Open a case')}</Link>}
              />
            )}
            {items.length > 0 && (
              <Stagger key={gridKey} className={cx('grid gap-3.5 xl:grid-cols-2 2xl:grid-cols-3', instant && 'stagger-instant')}>
                {items.map((p) => <CaseCard key={p.id} post={p} />)}
              </Stagger>
            )}
            {loading && (
              <div className={cx('grid gap-3.5 xl:grid-cols-2 2xl:grid-cols-3', items.length > 0 && 'mt-3.5')}>
                {Array.from({ length: items.length ? 2 : 5 }, (_, i) => <CaseRowSkeleton key={`s${i}`} />)}
              </div>
            )}
            {hasMore && !loading && !moreError && <div ref={sentinel} aria-hidden="true" className="h-px" />}
            {moreError && (
              <div className="mt-6 flex justify-center">
                <button className="btn-secondary !px-6" onClick={() => load(cursor)}>{t('Could not load more. Tap to retry')}</button>
              </div>
            )}
            {!hasMore && !loading && items.length > 6 && <p className="mt-8 text-center text-xs text-ink-soft">{t('You have reached the end')}</p>}
          </>
        )}
      </section>

      <Dialog open={sheet} onClose={() => setSheet(false)} title={t('Filter case files')}>
        <div className="space-y-6">
          <div>
            <p className="label">{t('Order')}</p>
            <Segmented value={sort} onChange={(v) => setParam({ sort: v === 'oldest' ? 'oldest' : '' })} options={[{ value: 'newest', label: t('Newest first') }, { value: 'oldest', label: t('Oldest first') }]} />
          </div>
          <div>
            <p className="label">{t('Evidence')}</p>
            <button role="switch" aria-checked={exhibits} onClick={() => setParam({ exhibits: exhibits ? '' : 'true' })} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-black/15 bg-white px-4 text-left text-sm font-bold">
              <span className="flex items-center gap-2.5"><Icon name="image" size={20} /> {t('Only cases with photo exhibits')}</span>
              <span className={cx('relative h-7 w-12 rounded-full transition-colors duration-150', exhibits ? 'bg-brand-600' : 'bg-stone-300')}>
                <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-150', exhibits ? 'translate-x-[22px]' : 'translate-x-0.5')} />
              </span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => { clearAll(); setSheet(false); }}>{t('Reset all')}</button>
            <button className="btn-primary" onClick={() => setSheet(false)}>{t('Show cases')}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
