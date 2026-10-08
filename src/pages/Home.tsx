import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { EmptyState, ErrorState, PostCardSkeleton, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { ease, FloatingBlob, spring, Stagger } from '../lib/motion';
import type { PostSummary } from '../lib/types';
import { cx, useDebounced, usePageMeta } from '../lib/util';

const words = ['Speak', 'up.', 'Stay', 'anonymous.'];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.93 }} transition={spring} className={cx('chip', active && 'chip-active')} onClick={onClick} aria-pressed={active}>
      {active && <motion.span layoutId="chip-bg" className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 shadow-brand" transition={spring} />}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const qParam = params.get('q') ?? '';
  const [q, setQ] = useState(qParam);
  const debounced = useDebounced(q.trim(), 350);

  usePageMeta({ description: 'Read moderated, anonymous reports about crime and criminals in Sri Lanka — or share one safely without an account.', path: '/' });

  const categories = useAsync(() => api.categories(), []);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      }, { replace: true });
    },
    [setParams],
  );
  useEffect(() => {
    if (debounced !== qParam) setParam('q', debounced);
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
        const page = await api.listPosts({ cursor: next, q: qParam, category, tag });
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
    [qParam, category, tag],
  );

  useEffect(() => {
    setItems([]);
    void load(null);
  }, [load]);

  const filtered = Boolean(qParam || category || tag);
  // Re-key the grid when filters change so the stagger animation replays.
  const gridKey = `${qParam}|${category}|${tag}`;

  return (
    <div>
      <section className="relative overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-brand-50 via-white to-amber-50 px-6 py-12 shadow-soft sm:px-12 sm:py-16">
        <FloatingBlob className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl" />
        <FloatingBlob className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-200/60 blur-3xl" delay={2} duration={17} />
        <FloatingBlob className="pointer-events-none absolute top-10 left-[-3rem] h-56 w-56 rounded-full bg-teal-200/50 blur-3xl" delay={4} duration={19} />

        <div className="relative max-w-2xl">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1 text-xs font-bold tracking-widest text-brand-700 uppercase backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Anonymous · Moderated · No accounts
          </motion.p>
          <h1 className="font-display text-4xl leading-[1.1] font-bold sm:text-6xl" aria-label="Speak up. Stay anonymous.">
            {words.map((w, i) => (
              <motion.span
                key={w}
                aria-hidden="true"
                initial={{ opacity: 0, y: 30, rotateX: -50 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.65, ease, delay: 0.15 + i * 0.1 }}
                className={cx('mr-[0.25em] inline-block', i >= 2 && 'bg-gradient-to-r from-brand-600 via-brand-500 to-amber-500 bg-clip-text text-transparent')}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.6 }} className="mt-5 max-w-xl text-lg text-stone-600">
            Report crimes and the people behind them without giving up who you are. Every post is reviewed by a moderator before it is published.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.75 }} className="mt-8 flex flex-wrap gap-3">
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }} transition={spring}>
              <Link to="/new" className="btn-primary !px-6 !py-3 text-base">Share a report →</Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.96 }} transition={spring}>
              <Link to="/about" className="btn-secondary !px-5 !py-3">How your privacy is protected</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease, delay: 0.35 }} aria-label="Search and filters" className="mt-8 space-y-4">
        <div className="relative">
          <label htmlFor="search" className="sr-only">Search reports</label>
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true">🔎</span>
          <input id="search" type="search" className="input !rounded-2xl !py-3 !pl-10" placeholder="Search reports…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <Chip active={!category} onClick={() => setParam('category', '')}>All</Chip>
          {categories.data?.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => setParam('category', category === c.slug ? '' : c.slug)}>{c.name}</Chip>
          ))}
          <AnimatePresence>
            {tag && (
              <motion.button initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={spring} className="chip border-teal-300 bg-teal-50 text-teal-800" onClick={() => setParam('tag', '')} aria-label={`Remove tag filter ${tag}`}>
                #{tag} ✕
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      <section aria-live="polite" className="mt-6">
        {error ? (
          <ErrorState message={error.message} onRetry={() => load(null)} />
        ) : (
          <>
            {!loading && items.length === 0 && (
              <EmptyState
                title={filtered ? 'No reports match your filters' : 'No published reports yet'}
                message={filtered ? 'Try a different search term or clear the filters.' : 'Reports appear here after a moderator approves them.'}
                action={filtered ? <button className="btn-secondary" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button> : <Link to="/new" className="btn-primary">Share a report</Link>}
              />
            )}
            {items.length > 0 && (
              <Stagger key={gridKey} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => <PostCard key={p.id} post={p} />)}
              </Stagger>
            )}
            {loading && (
              <div className={cx('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', items.length > 0 && 'mt-5')}>
                {Array.from({ length: items.length ? 3 : 6 }, (_, i) => <PostCardSkeleton key={`s${i}`} />)}
              </div>
            )}
            {hasMore && !loading && (
              <div className="mt-8 flex justify-center">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={spring} className="btn-secondary !px-6" onClick={() => load(cursor)}>{loading && <Spinner />}Load more</motion.button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
