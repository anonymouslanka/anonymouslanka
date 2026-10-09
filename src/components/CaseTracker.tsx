import type { ModerationStatus } from '../lib/types';
import { useT } from '../lib/i18n';
import { cx } from '../lib/util';
import { Icon } from './Icon';

/** Three-step progress for a case: Filed → Under review → Open (or Dismissed). */
export function CaseTracker({ status }: { status: ModerationStatus }) {
  const t = useT();
  const dismissed = status === 'REJECTED';
  const step = status === 'PENDING' ? 1 : 2;
  const steps = [
    { label: 'Filed', done: true },
    { label: 'Under review', done: step >= 2 || dismissed, current: status === 'PENDING' },
    { label: dismissed ? 'Dismissed' : 'Open to public', done: status === 'APPROVED' || dismissed, current: false, bad: dismissed },
  ];
  return (
    <ol className="flex items-center gap-1.5 text-[0.68rem] font-bold" aria-label={t('Case progress: {state}', { state: status === 'PENDING' ? t('Under review') : dismissed ? t('Dismissed') : t('Open') })}>
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-1.5">
          <span
            className={cx(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2',
              s.bad ? 'border-red-500 bg-red-500 text-white' : s.done ? 'border-emerald-600 bg-emerald-600 text-white' : s.current ? 'border-amber-500 bg-amber-100 text-amber-700' : 'border-black/15 bg-white text-stone-400',
            )}
          >
            {s.bad ? <Icon name="x" size={12} strokeWidth={3} /> : s.done ? <Icon name="check" size={12} strokeWidth={3} /> : <span className={cx('h-2 w-2 rounded-full', s.current ? 'bg-amber-500' : 'bg-stone-300')} />}
          </span>
          <span className={cx('truncate', s.done || s.current ? 'text-ink' : 'text-stone-400')}>{t(s.label)}</span>
          {i < steps.length - 1 && <span className={cx('h-0.5 flex-1 rounded', s.done ? 'bg-emerald-500' : 'bg-black/10')} />}
        </li>
      ))}
    </ol>
  );
}
