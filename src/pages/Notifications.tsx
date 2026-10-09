import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { usePwa } from '../components/Pwa';
import { EmptyState, ErrorState, Skeleton, Spinner, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { Stagger, StaggerItem } from '../lib/motion';
import { useUnread } from '../lib/notify';
import type { NotificationItem } from '../lib/types';
import { cx, timeAgo, usePageMeta } from '../lib/util';

const CACHE = 'app:notif-cache';
const KIND: Record<string, { icon: IconName; label: string; tone: string }> = {
  CASE: { icon: 'folder', label: 'New case file', tone: 'bg-folder text-[#7a5a14]' },
  STATEMENT: { icon: 'chat', label: 'New statement', tone: 'bg-brand-100 text-brand-800' },
  ANNOUNCEMENT: { icon: 'megaphone', label: 'Announcement', tone: 'bg-emerald-100 text-emerald-800' },
};

const readCache = (): NotificationItem[] => {
  try {
    return (JSON.parse(localStorage.getItem(CACHE) ?? '[]') as NotificationItem[]).slice(0, 20);
  } catch {
    return [];
  }
};

/** The notification centre. It works with or without browser push permission. */
export default function Notifications() {
  usePageMeta({ title: 'Notifications', noindex: true });
  const t = useT();
  const nav = useNavigate();
  const toast = useToast();
  const { online } = usePwa();
  const { set: setUnread } = useUnread();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    async (next?: string | null) => {
      if (next) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await api.notifications(next);
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.meta.nextCursor);
        setHasMore(page.meta.hasMore);
        if (typeof page.meta.unread === 'number') setUnread(page.meta.unread);
        setSaved(false);
        if (!next) {
          try {
            localStorage.setItem(CACHE, JSON.stringify(page.items));
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        const err = e as ApiError;
        const old = !next ? readCache() : [];
        if (err.status === 0 && old.length) {
          setItems(old);
          setSaved(true);
        } else setError(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [setUnread],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const markOne = (n: NotificationItem) => {
    if (n.read) return;
    setItems((x) => x.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread(Math.max(0, items.filter((i) => !i.read).length - 1));
    void api.markRead([n.id]).catch(() => undefined);
  };

  const open = (n: NotificationItem) => {
    markOne(n);
    nav(n.url);
  };

  const markAll = async () => {
    try {
      await api.markAllRead();
      setItems((x) => x.map((i) => ({ ...i, read: true })));
      setUnread(0);
    } catch (e) {
      toast('error', (e as ApiError).message);
    }
  };

  const unreadHere = items.filter((i) => !i.read).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('Notifications')}</h1>
        <Link to="/notifications/settings" className="btn-secondary !h-11 !w-11 !min-h-11 !p-0" aria-label={t('Notification settings')}>
          <Icon name="settings" size={21} />
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">{t('New case files, announcements and statements on cases you follow. Phone alerts are optional, everything also shows up here.')}</p>

      {!online && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-black/5 px-3.5 py-2.5 text-sm text-ink-soft"><Icon name="offline" size={16} /> {t('You are offline.')}</p>}
      {saved && <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"><Icon name="clock" size={16} /> {t('Showing the notifications saved on this device.')}</p>}

      {items.length > 0 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-xs tracking-[0.12em] text-[#9b7621] uppercase">{unreadHere > 0 ? t('{n} unread', { n: unreadHere }) : t('All caught up')}</span>
          <button className="btn-ghost !min-h-10 !px-3 !text-[0.82rem]" onClick={markAll} disabled={unreadHere === 0}><Icon name="check" size={16} /> {t('Mark all as read')}</button>
        </div>
      )}

      <div className="mt-3">
        {loading ? (
          <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full !rounded-2xl" />)}</div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => load()} />
        ) : items.length === 0 ? (
          <EmptyState icon="bell" title={t('Nothing here yet')} message={t('When a new case file is published, a moderator posts an announcement, or a case you follow gets a statement, it will appear here.')} />
        ) : (
          <>
            <Stagger as="ul" className="space-y-3">
              {items.map((n) => {
                const k = KIND[n.kind] ?? KIND.ANNOUNCEMENT!;
                return (
                  <StaggerItem as="li" key={n.id}>
                    <div className={cx('card flex items-stretch overflow-hidden', !n.read && 'border-l-[5px] border-l-brand-500')}>
                      <button className="flex min-w-0 flex-1 items-start gap-3 p-4 text-left" onClick={() => open(n)} aria-label={`${n.read ? '' : t('Unread.') + ' '}${t(k.label)}: ${n.title}`}>
                        <span className={cx('mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl', k.tone)}><Icon name={k.icon} size={20} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 font-mono text-[0.64rem] tracking-[0.14em] text-[#9b7621] uppercase">
                            {t(k.label)} · {timeAgo(n.createdAt)}
                            {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />}
                          </span>
                          <span className={cx('mt-0.5 block text-[0.98rem] leading-snug break-words', n.read ? 'font-semibold text-ink' : 'font-bold text-ink')}>{n.title}</span>
                          <span className="mt-1 line-clamp-2 block text-sm break-words text-ink-soft">{n.body}</span>
                        </span>
                      </button>
                      {!n.read && (
                        <button className="grid w-12 shrink-0 place-items-center border-l border-black/10 text-ink-soft active:bg-black/5" onClick={() => markOne(n)} aria-label={t('Mark as read')}>
                          <Icon name="check" size={18} />
                        </button>
                      )}
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
            {hasMore && (
              <button className="chrome mx-auto mt-5 flex min-h-11 items-center gap-1.5 px-3 text-xs font-bold text-brand-700 underline underline-offset-4" onClick={() => load(cursor)} disabled={loadingMore}>
                {loadingMore && <Spinner />} {t('Load more')}
              </button>
            )}
            <p className="mt-6 text-center text-xs text-ink-soft">{t('Notifications are kept for 60 days.')}</p>
          </>
        )}
      </div>
    </div>
  );
}
