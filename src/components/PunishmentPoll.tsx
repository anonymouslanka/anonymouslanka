import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useT } from '../lib/i18n';
import { cx } from '../lib/util';
import { Icon } from './Icon';
import { useToast } from './ui';

const OPTIONS = [
  { key: 'LIFE', label: 'Life in prison' },
  { key: 'LONG', label: 'Long prison sentence' },
  { key: 'SHORT', label: 'Short prison sentence' },
  { key: 'FINE', label: 'Heavy fine and repay the victims' },
  { key: 'SERVICE', label: 'Community service' },
] as const;

const mineKey = (id: string) => `app:vote:${id}`;
const readMine = (id: string): string | null => {
  try {
    return localStorage.getItem(mineKey(id));
  } catch {
    return null;
  }
};

interface Results {
  total: number;
  counts: Record<string, number>;
}

/** Anonymous one-tap poll: what punishment would be fair. Results appear after you vote (or tap "Show results"). */
export function PunishmentPoll({ postId }: { postId: string }) {
  const t = useT();
  const toast = useToast();
  const [mine, setMine] = useState<string | null>(() => readMine(postId));
  const [results, setResults] = useState<Results | null>(null);
  const [show, setShow] = useState(() => readMine(postId) !== null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    api.votes(postId).then((r) => alive && setResults(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [postId, show]);

  const vote = async (key: string) => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      const r = await api.vote(postId, key);
      setResults(r);
      setMine(key);
      setShow(true);
      try {
        localStorage.setItem(mineKey(postId), key);
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const total = results?.total ?? 0;
  return (
    <section aria-labelledby="poll-h" className="card mt-6 p-5">
      <h2 id="poll-h" className="flex items-center gap-2 font-display text-xl font-bold"><Icon name="scale" size={20} /> {t('What punishment would be fair?')}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t('Anonymous. One vote per device; you can change it.')}</p>
      <ul className="mt-4 space-y-2">
        {OPTIONS.map((o) => {
          const n = results?.counts[o.key] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const picked = mine === o.key;
          return (
            <li key={o.key}>
              <button
                type="button"
                disabled={busy}
                onClick={() => vote(o.key)}
                aria-pressed={picked}
                className={cx('poll-opt relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm font-bold', picked ? 'border-brand-600 text-brand-800' : 'border-black/15 text-ink')}
              >
                {show && <span className="poll-bar absolute inset-y-0 left-0 bg-brand-100" style={{ width: `${pct}%` }} aria-hidden="true" />}
                <span className="relative flex items-center gap-2">{picked && <Icon name="check" size={16} strokeWidth={3} />}{t(o.label)}</span>
                {show && <span className="relative font-mono text-xs">{pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {show ? (
        <p className="mt-3 text-xs text-ink-soft">{t('{n} votes', { n: total })}</p>
      ) : (
        <button type="button" className="mt-3 text-sm font-bold text-brand-700 underline underline-offset-4" onClick={() => setShow(true)}>{t('Show results')}</button>
      )}
    </section>
  );
}
