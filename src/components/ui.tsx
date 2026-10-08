import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { haptics } from '../lib/haptics';
import type { ModerationStatus } from '../lib/types';
import { cx } from '../lib/util';
import { Icon, IconName } from './Icon';

/** Kept for older call sites; the global click handler (lib/haptics) already ticks on every button. */
export function haptic(pattern: number | number[] = 10): void {
  if (Array.isArray(pattern)) haptics.error();
  else haptics.tap();
}

/* ───────────── Notifications (CSS animated) ───────────── */
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  ms: number;
}
const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

/** Each kind has its own colour, icon motion (success pops, error shakes), title and how long it stays. */
const toastTone: Record<ToastKind, { title: string; card: string; bubble: string; text: string; bar: string; glyph: IconName; motion: string; ms: number }> = {
  success: { title: 'Done', card: 'border-emerald-300 bg-emerald-50', bubble: 'bg-emerald-600 text-white', text: 'text-emerald-950', bar: 'bg-emerald-500', glyph: 'check', motion: 'toast-pop', ms: 3800 },
  error: { title: 'That didn’t work', card: 'border-red-300 bg-red-50', bubble: 'bg-red-600 text-white', text: 'text-red-950', bar: 'bg-red-500', glyph: 'alert', motion: 'toast-shake', ms: 7000 },
  info: { title: 'Note', card: 'border-black/10 bg-[#fffdf8]', bubble: 'bg-brand-600 text-white', text: 'text-ink', bar: 'bg-brand-500', glyph: 'info', motion: 'toast-pop', ms: 4500 },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((x) => x.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter.current;
      const ms = toastTone[kind].ms;
      if (kind === 'error') haptics.error();
      else if (kind === 'success') haptics.success();
      setItems((x) => {
        // the same message twice is shown once (and restarts its timer)
        const same = x.find((i) => i.kind === kind && i.message === message);
        if (same) {
          const t = timers.current.get(same.id);
          if (t) clearTimeout(t);
          timers.current.delete(same.id);
        }
        return [...x.filter((i) => i !== same).slice(-2), { id, kind, message, ms }];
      });
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:inset-x-auto lg:right-0 lg:bottom-0 lg:top-auto lg:items-end lg:p-5">
        {items.map((t) => {
          const tone = toastTone[t.kind];
          return (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cx('toast-in pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border py-3 pr-2 pl-3.5', tone.card)}>
              <span className={cx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', tone.bubble, tone.motion)}>
                <Icon name={tone.glyph} size={17} strokeWidth={2.8} />
              </span>
              <div className={cx('min-w-0 flex-1 pt-0.5', tone.text)}>
                <p className="text-[0.95rem] leading-tight font-bold">{tone.title}</p>
                <p className="mt-0.5 text-sm leading-snug break-words opacity-90">{t.message}</p>
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-black/45 active:bg-black/10" aria-label="Dismiss notification" data-no-haptic>
                <Icon name="x" size={16} strokeWidth={2.6} />
              </button>
              <span className={cx('toast-bar absolute inset-x-0 bottom-0 h-1 origin-left', tone.bar)} style={{ animationDuration: `${t.ms}ms` }} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────────── Dialog / bottom sheet (native <dialog>: focus trap + Esc handled by the browser) ───────────── */
export function Dialog({
  open,
  onClose,
  title,
  children,
  dismissable = true,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissable?: boolean;
  size?: 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const width = size === 'xl' ? 'sm:max-w-5xl' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';
  return (
    <dialog
      ref={ref}
      aria-labelledby="dlg-title"
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose();
      }}
      // Bottom sheet on phones, centred dialog from sm up.
      className={cx(
        'max-h-[92dvh] w-full overflow-hidden border border-black/10 bg-[#fffdf8] p-0 text-ink',
        'max-sm:m-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-t-3xl max-sm:border-b-0',
        'sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-3xl',
        width,
      )}
    >
      {open && (
        <div className="max-h-[92dvh] overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 sm:hidden" aria-hidden="true" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-xl font-bold">
              {title}
            </h2>
            {dismissable && (
              <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost -mt-1 -mr-2 !min-h-10 !px-3">
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-sm text-ink-soft">{message}</div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner />}
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

/* ───────────── Small pieces ───────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

export function CaseRowSkeleton() {
  return (
    <div className="card flex gap-4 p-4" aria-hidden="true">
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-24 w-24 shrink-0 !rounded-xl" />
    </div>
  );
}

export function EmptyState({ title, message, action, icon = 'folder' }: { title: string; message?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="card page-in flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-folder/60 text-[#7a5a14]" aria-hidden="true">
        <Icon name={icon} size={30} />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="card page-in flex flex-col items-center border-red-200 px-6 py-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600" aria-hidden="true">
        <Icon name="alert" size={30} />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-5" onClick={onRetry}>
          <Icon name="refresh" size={18} /> Try again
        </button>
      )}
    </div>
  );
}

/** Rubber-stamp case status. Public viewers only ever see OPEN cases; authors can see all three. */
export function StatusBadge({ status }: { status: ModerationStatus }) {
  const map: Record<ModerationStatus, [string, string]> = {
    PENDING: ['Under review', 'border-amber-600/70 text-amber-700 bg-amber-50'],
    APPROVED: ['Open', 'border-emerald-600/70 text-emerald-700 bg-emerald-50'],
    REJECTED: ['Dismissed', 'border-red-600/70 text-red-700 bg-red-50'],
  };
  const [label, tone] = map[status];
  return <span className={cx('stamp', tone)}>{label}</span>;
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
      {messages.join(' · ')}
    </p>
  );
}
