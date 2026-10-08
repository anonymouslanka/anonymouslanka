import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CaseCard } from '../components/CaseCard';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/Pwa';
import { CaseRowSkeleton, Dialog, EmptyState, ErrorState, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { spring, Stagger } from '../lib/motion';
import { PullIndicator, usePullToRefresh } from '../lib/ptr';
import type { PostSummary } from '../lib/types';
import { cx, useDebounced, usePageMeta } from '../lib/util';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.93 }} transition={spring} className={cx('chip', active && 'chip-active')} onClick={onClick} aria-pressed={active}>
      {active && <motion.span layoutId="chip-bg" className="absolute inset-0 rounded-full bg-gradient-to-b from-[#34457f] to-ink shadow-[0_6px_14px_-6px_rgb(28_37_65/0.7)]" transition={spring} />}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={cx('relative rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors', o.value === value ? 'text-ink' : 'text-ink-soft')}>
          {o.value === value && <motion.span layoutId="seg-sort" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={spring} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const qParam = params.get('q') ?? '';
  const sort = (params.get('sort') === 'oldest' ? 'oldest' : 'newest') as 'newest' | 'oldest';
  const exhibits = params.get('exhibits') === 'true';
  const [q, setQ] = useState(qParam);
  const debounced = useDebounced(q.trim(), 350);
  const [sheet, setSheet] = useState(false);

  usePageMeta({ description: 'Browse moderated, anonymous case files about crime in Sri Lanka — or open a case yourself without an account.', path: '/' });

  const categories = useAsync(() => api.categories(), []);

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

  const [items, setItems] = useState<PostSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (next: string | null) => {
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.listPosts({ cursor: next, q: qParam, category, tag, sort, exhibits });
        if (id !== seq.current) return;
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.meta.nextCursor);
        setHasMore(page.meta.hasMore);
      } catch (e) {
        if (id === seq.current) setError(e as ApiError);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [qParam, category, tag, sort, exhibits],
  );

  useEffect(() => {
    setItems([]);
    void load(null);
  }, [load]);

  const { pull, refreshing } = usePullToRefresh(() => load(null));

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

      <header className="mb-5">
        <h1 className="font-display text-3xl leading-tight font-bold sm:text-4xl">Case files</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">Open cases reported by the public. Every file is reviewed by a moderator before it is published.</p>
      </header>

      <section aria-label="Search and filters" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 space-y-3 bg-paper/90 px-4 pt-2 pb-3 backdrop-blur-xl lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="search" className="sr-only">Search cases</label>
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400"><Icon name="search" size={18} /></span>
            <input id="search" type="search" enterKeyHint="search" className="input !rounded-2xl !pl-10" placeholder="Search case files" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
          </div>
          <motion.button whileTap={{ scale: 0.92 }} transition={spring} onClick={() => setSheet(true)} className="btn-secondary relative !min-h-12 !rounded-2xl !px-3.5" aria-label="Filters">
            <Icon name="sliders" size={20} />
            <AnimatePresence>
              {activeFilters > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white">
                  {activeFilters}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:-mx-10 lg:px-10" role="group" aria-label="Filter by case type">
          <Chip active={!category} onClick={() => setParam({ category: '' })}>All types</Chip>
          {categories.data?.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => setParam({ category: category === c.slug ? '' : c.slug })}>{c.name}</Chip>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {activeFilters > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap gap-2 overflow-hidden">
              {sort === 'oldest' && <button className="chip !border-brand-300 !bg-brand-50 !text-brand-800" onClick={() => setParam({ sort: '' })}>Oldest first <Icon name="x" size={12} /></button>}
              {exhibits && <button className="chip !border-brand-300 !bg-brand-50 !text-brand-800" onClick={() => setParam({ exhibits: '' })}>With exhibits <Icon name="x" size={12} /></button>}
              {tag && <button className="chip !border-brand-300 !bg-brand-50 !text-brand-800" onClick={() => setParam({ tag: '' })}>#{tag} <Icon name="x" size={12} /></button>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section aria-live="polite" className="mt-3">
        {error ? (
          <ErrorState message={error.message} onRetry={() => load(null)} />
        ) : (
          <>
            {!loading && items.length === 0 && (
              <EmptyState
                icon={filtered ? 'search' : 'inbox'}
                title={filtered ? 'No case files match' : 'No open cases yet'}
                message={filtered ? 'Try different words or clear your filters.' : 'Case files appear here once a moderator clears them.'}
                action={filtered ? <button className="btn-secondary" onClick={clearAll}>Clear filters</button> : <Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={18} /> Open a case</Link>}
              />
            )}
            {items.length > 0 && (
              <Stagger key={gridKey} className="grid gap-3.5 xl:grid-cols-2">
                {items.map((p) => <CaseCard key={p.id} post={p} />)}
              </Stagger>
            )}
            {loading && (
              <div className={cx('grid gap-3.5 xl:grid-cols-2', items.length > 0 && 'mt-3.5')}>
                {Array.from({ length: items.length ? 2 : 5 }, (_, i) => <CaseRowSkeleton key={`s${i}`} />)}
              </div>
            )}
            {hasMore && !loading && (
              <div className="mt-6 flex justify-center">
                <motion.button whileTap={{ scale: 0.95 }} transition={spring} className="btn-secondary !px-6" onClick={() => load(cursor)}>
                  {loading && <Spinner />} Load more cases
                </motion.button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog open={sheet} onClose={() => setSheet(false)} title="Filter case files">
        <div className="space-y-6">
          <div>
            <p className="label">Order</p>
            <Segmented value={sort} onChange={(v) => setParam({ sort: v === 'oldest' ? 'oldest' : '' })} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} />
          </div>
          <div>
            <p className="label">Evidence</p>
            <button
              role="switch"
              aria-checked={exhibits}
              onClick={() => setParam({ exhibits: exhibits ? '' : 'true' })}
              className="flex w-full items-center justify-between rounded-xl border border-stone-300/80 bg-white px-4 py-3 text-left text-sm font-semibold"
            >
              <span className="flex items-center gap-2.5"><Icon name="image" size={18} /> Only cases with photo exhibits</span>
              <span className={cx('relative h-6 w-11 rounded-full transition-colors', exhibits ? 'bg-brand-600' : 'bg-stone-300')}>
                <motion.span layout transition={spring} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: exhibits ? 22 : 2 }} />
              </span>
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => { clearAll(); setSheet(false); }}>Reset all</button>
            <button className="btn-navy flex-1" onClick={() => setSheet(false)}>Show cases</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
