import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { EmptyState, ErrorState, PostCardSkeleton, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import type { PostSummary } from '../lib/types';
import { cx, useDebounced, usePageMeta } from '../lib/util';

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

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-sm font-semibold tracking-widest text-gold uppercase">Anonymous · Moderated · No accounts</p>
          <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">Speak up. Stay anonymous.</h1>
          <p className="mt-4 text-lg text-brand-100">
            Report crimes and the people behind them without giving up who you are. Every post is reviewed by a moderator before it is published.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/new" className="btn bg-white !px-5 text-brand-800 hover:bg-brand-50">Share a report</Link>
            <Link to="/about" className="btn border border-white/30 text-white hover:bg-white/10">How your privacy is protected</Link>
          </div>
        </div>
      </section>

      <section aria-label="Search and filters" className="mt-8 space-y-4">
        <div className="relative">
          <label htmlFor="search" className="sr-only">Search reports</label>
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true">🔎</span>
          <input id="search" type="search" className="input !pl-10" placeholder="Search reports…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button className={cx('chip', !category && 'chip-active')} onClick={() => setParam('category', '')} aria-pressed={!category}>All</button>
          {categories.data?.map((c) => (
            <button key={c.slug} className={cx('chip', category === c.slug && 'chip-active')} onClick={() => setParam('category', category === c.slug ? '' : c.slug)} aria-pressed={category === c.slug}>
              {c.name}
            </button>
          ))}
          {tag && (
            <button className="chip chip-active" onClick={() => setParam('tag', '')} aria-label={`Remove tag filter ${tag}`}>#{tag} ✕</button>
          )}
        </div>
      </section>

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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
              {loading && Array.from({ length: items.length ? 3 : 6 }, (_, i) => <PostCardSkeleton key={`s${i}`} />)}
            </div>
            {hasMore && !loading && (
              <div className="mt-8 flex justify-center">
                <button className="btn-secondary" onClick={() => load(cursor)}>{loading && <Spinner />}Load more</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
