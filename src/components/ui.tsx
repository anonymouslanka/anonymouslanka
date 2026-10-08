import { AnimatePresence, motion } from 'framer-motion';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ModerationStatus } from '../lib/types';
import { ease, spring } from '../lib/motion';
import { cx } from '../lib/util';
import { Icon, IconName } from './Icon';

/** Light haptic tap where supported (Android / some browsers). Silent no-op elsewhere. */
export function haptic(pattern: number | number[] = 10): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/* ───────────── Toasts ───────────── */
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

const toastTone: Record<ToastKind, { box: string; icon: string; glyph: IconName }> = {
  success: { box: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-700', glyph: 'check' },
  error: { box: 'border-red-200', icon: 'bg-red-100 text-red-700', glyph: 'alert' },
  info: { box: 'border-stone-200', icon: 'bg-brand-100 text-brand-700', glyph: 'info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    if (kind === 'error') haptic([20, 40, 20]);
    setItems((x) => [...x.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:inset-x-auto lg:right-0 lg:bottom-0 lg:top-auto lg:items-end lg:p-5">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              role={t.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: -40, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.18 } }}
              transition={spring}
              className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white/95 px-4 py-3 text-sm shadow-lift backdrop-blur', toastTone[t.kind].box)}
            >
              <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', toastTone[t.kind].icon)}>
                <Icon name={toastTone[t.kind].glyph} size={14} strokeWidth={2.4} />
              </span>
              <span className="text-ink">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
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
        'max-h-[92dvh] w-full overflow-visible border border-stone-200 bg-white p-0 text-ink shadow-2xl',
        'max-sm:m-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-t-3xl max-sm:border-b-0',
        'sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-3xl',
        width,
      )}
    >
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          className="max-h-[92dvh] overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 sm:hidden" aria-hidden="true" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-xl font-bold">
              {title}
            </h2>
            {dismissable && (
              <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={onClose} aria-label="Close" className="btn-ghost -mt-1 -mr-2 !min-h-9 !px-2.5">
                <Icon name="x" size={18} />
              </motion.button>
            )}
          </div>
          {children}
        </motion.div>
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
      <div className="mt-6 flex justify-end gap-2">
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

function StateIcon({ name, tone }: { name: IconName; tone: string }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
      className={cx('mb-4 grid h-16 w-16 place-items-center rounded-2xl', tone)}
      aria-hidden="true"
    >
      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
        <Icon name={name} size={30} />
      </motion.span>
    </motion.div>
  );
}

export function EmptyState({ title, message, action, icon = 'folder' }: { title: string; message?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="card flex flex-col items-center px-6 py-14 text-center">
      <StateIcon name={icon} tone="bg-folder/60 text-[#7a5a14]" />
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} role="alert" className="card flex flex-col items-center border-red-200 px-6 py-12 text-center">
      <StateIcon name="alert" tone="bg-red-50 text-red-600" />
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-5" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </motion.div>
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
  return (
    <motion.span initial={{ scale: 1.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 420, damping: 18 }} className={cx('stamp', tone)}>
      {label}
    </motion.span>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  return (
    <AnimatePresence>
      {messages?.length ? (
        <motion.p initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {messages.join(' · ')}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
