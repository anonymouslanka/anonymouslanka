import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useT } from '../lib/i18n';
import { cx } from '../lib/util';
import { Icon } from './Icon';
import { Spinner, useToast } from './ui';

interface Poll {
  total: number;
  options: { id: string; label: string; custom: boolean; count: number }[];
}

const mineKey = (id: string) => `app:vote:${id}`;
const LEGACY: Record<string, string> = { LIFE: 'po_life', LONG: 'po_long', SHORT: 'po_short', FINE: 'po_fine', SERVICE: 'po_service' };
const readMine = (id: string): string | null => {
  try {
    const v = localStorage.getItem(mineKey(id));
    return v ? LEGACY[v] ?? v : null;
  } catch {
    return null;
  }
};

/** Anonymous one-tap poll: what punishment would be fair. Visitors can also add an option that exists only for this case. */
export function PunishmentPoll({ postId }: { postId: string }) {
  const t = useT();
  const toast = useToast();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [mine, setMine] = useState<string | null>(() => readMine(postId));
  const [show, setShow] = useState(() => readMine(postId) !== null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    let alive = true;
    api.votes(postId).then((r) => alive && setPoll(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [postId]);

  const remember = (optionId: string) => {
    setMine(optionId);
    setShow(true);
    try {
      localStorage.setItem(mineKey(postId), optionId);
    } catch {
      /* ignore */
    }
  };

  const vote = async (optionId: string) => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      setPoll(await api.vote(postId, optionId));
      remember(optionId);
    } catch (e) {
      toast('error', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const addOwn = async (e: FormEvent) => {
    e.preventDefault();
    const label = text.trim();
    if (label.length < 3 || busy) return;
    setBusy(true);
    try {
      const r = await api.addVoteOption(postId, label);
      setPoll(r);
      const match = r.options.find((o) => o.label.toLowerCase() === label.toLowerCase());
      if (match) remember(match.id);
      setText('');
      setAdding(false);
      haptics.success();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const total = poll?.total ?? 0;
  return (
    <section aria-labelledby="poll-h" className="card mt-6 p-5">
      <h2 id="poll-h" className="flex items-center gap-2 font-display text-xl font-bold"><Icon name="scale" size={20} /> {t('What punishment would be fair?')}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t('Anonymous. One vote per device; you can change it.')}</p>
      {!poll ? (
        <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 w-full !rounded-2xl" />)}</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {poll.options.map((o) => {
            const pct = total ? Math.round((o.count / total) * 100) : 0;
            const picked = mine === o.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => vote(o.id)}
                  aria-pressed={picked}
                  className={cx('poll-opt relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm font-bold', picked ? 'border-brand-600 text-brand-800' : 'border-black/15 text-ink')}
                >
                  {show && <span className="poll-bar absolute inset-y-0 left-0 bg-brand-100" style={{ width: `${pct}%` }} aria-hidden="true" />}
                  <span className="relative flex min-w-0 items-center gap-2">
                    {picked && <Icon name="check" size={16} strokeWidth={3} className="shrink-0" />}
                    <span className="break-words">{o.custom ? o.label : t(o.label)}</span>
                    {o.custom && <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-ink-soft uppercase">{t('added by a visitor')}</span>}
                  </span>
                  {show && <span className="relative font-mono text-xs">{pct}%</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {poll &&
        (adding ? (
          <form onSubmit={addOwn} className="mt-3 flex gap-2">
            <input className="input flex-1" autoFocus maxLength={60} minLength={3} required value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Your idea, in a few words')} aria-label={t('Your own punishment idea')} />
            <button className="btn-primary !px-4" disabled={busy || text.trim().length < 3}>{busy ? <Spinner /> : t('Add and vote')}</button>
          </form>
        ) : (
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> {t('Add your own option for this case')}
          </button>
        ))}

      {poll && (show ? (
        <p className="mt-3 text-xs text-ink-soft">{t('{n} votes', { n: total })}</p>
      ) : (
        <button type="button" className="mt-3 block text-sm font-bold text-brand-700 underline underline-offset-4" onClick={() => setShow(true)}>{t('Show results')}</button>
      ))}
    </section>
  );
}
