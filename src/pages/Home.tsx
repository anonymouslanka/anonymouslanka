import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CaseCard } from '../components/CaseCard';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/Pwa';
import { CaseRowSkeleton, Dialog, EmptyState, ErrorState, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { Stagger } from '../lib/motion';
import { PullIndicator, usePullToRefresh } from '../lib/ptr';
import type { PostSummary } from '../lib/types';
import { cx, useDebounced, usePageMeta } from '../lib/util';

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

      <header className="mb-4">
        <h1 className="font-display text-3xl leading-tight font-bold sm:text-4xl">Case files</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">Open cases reported by the public. Every file is reviewed by a moderator before it is published.</p>
      </header>

      <section aria-label="Search and filters" className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="search" className="sr-only">Search cases</label>
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400"><Icon name="search" size={20} /></span>
            <input id="search" type="search" enterKeyHint="search" className="input !h-[3.25rem] !rounded-2xl !pl-11" placeholder="Search by title or case number" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
          </div>
          <button onClick={() => setSheet(true)} className="btn-secondary relative !min-h-[3.25rem] !rounded-2xl !px-4" aria-label="Filters">
            <Icon name="sliders" size={22} />
            {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white">{activeFilters}</span>}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 lg:-mx-10 lg:px-10" role="group" aria-label="Filter by case type">
          <Chip active={!category} onClick={() => setParam({ category: '' })}>All types</Chip>
          {categories.data?.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => setParam({ category: category === c.slug ? '' : c.slug })}>{c.name}</Chip>
          ))}
        </div>

        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-2">
            {sort === 'oldest' && <button className="chip chip-active" onClick={() => setParam({ sort: '' })}>Oldest first <Icon name="x" size={13} /></button>}
            {exhibits && <button className="chip chip-active" onClick={() => setParam({ exhibits: '' })}>With exhibits <Icon name="x" size={13} /></button>}
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
                title={filtered ? 'No case files match' : 'No open cases yet'}
                message={filtered ? 'Try different words or clear your filters.' : 'Case files appear here once a moderator clears them.'}
                action={filtered ? <button className="btn-secondary" onClick={clearAll}>Clear filters</button> : <Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={20} /> Open a case</Link>}
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
                <button className="btn-secondary !px-6" onClick={() => load(cursor)}>
                  {loading && <Spinner />} Load more cases
                </button>
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
            <button role="switch" aria-checked={exhibits} onClick={() => setParam({ exhibits: exhibits ? '' : 'true' })} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-black/15 bg-white px-4 text-left text-sm font-bold">
              <span className="flex items-center gap-2.5"><Icon name="image" size={20} /> Only cases with photo exhibits</span>
              <span className={cx('relative h-7 w-12 rounded-full transition-colors duration-150', exhibits ? 'bg-brand-600' : 'bg-stone-300')}>
                <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-150', exhibits ? 'translate-x-[22px]' : 'translate-x-0.5')} />
              </span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => { clearAll(); setSheet(false); }}>Reset all</button>
            <button className="btn-primary" onClick={() => setSheet(false)}>Show cases</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
