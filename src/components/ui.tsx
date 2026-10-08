import { AnimatePresence, motion } from 'framer-motion';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ModerationStatus } from '../lib/types';
import { ease, spring } from '../lib/motion';
import { cx } from '../lib/util';

/* ───────────── Toasts ───────────── */
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

const toastTone: Record<ToastKind, { box: string; icon: string; glyph: string }> = {
  success: { box: 'border-emerald-200 bg-white', icon: 'bg-emerald-100 text-emerald-700', glyph: '✓' },
  error: { box: 'border-red-200 bg-white', icon: 'bg-red-100 text-red-700', glyph: '!' },
  info: { box: 'border-stone-200 bg-white', icon: 'bg-brand-100 text-brand-700', glyph: 'i' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    setItems((x) => [...x.slice(-3), { id, kind, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              role={t.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.2 } }}
              transition={spring}
              className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lift', toastTone[t.kind].box)}
            >
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.1 }} className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold', toastTone[t.kind].icon)}>
                {toastTone[t.kind].glyph}
              </motion.span>
              <span className="text-stone-700">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────────── Dialog (native <dialog>: focus trap + Esc handled by the browser) ───────────── */
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
  const width = size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
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
      className={cx('m-auto w-[calc(100%-2rem)] overflow-visible rounded-3xl border border-stone-200 bg-white p-0 text-ink shadow-2xl', width)}
    >
      {open && (
        <motion.div initial={{ opacity: 0, y: 28, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }} className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-xl font-semibold">
              {title}
            </h2>
            {dismissable && (
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} type="button" onClick={onClose} aria-label="Close" className="btn-ghost -mt-1 -mr-2 !min-h-9 !px-2.5">
                ✕
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
      <div className="text-sm text-stone-600">{message}</div>
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

export function PostCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <Skeleton className="aspect-[16/10] w-full !rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function StateIcon({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
      className={cx('mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl', tone)}
      aria-hidden="true"
    >
      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
        {children}
      </motion.span>
    </motion.div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="card flex flex-col items-center px-6 py-14 text-center">
      <StateIcon tone="bg-gradient-to-br from-brand-50 to-amber-50">🗂️</StateIcon>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-stone-600">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} role="alert" className="card flex flex-col items-center border-red-200 px-6 py-12 text-center">
      <StateIcon tone="bg-red-50">⚠️</StateIcon>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-stone-600">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: ModerationStatus }) {
  const map: Record<ModerationStatus, [string, string]> = {
    PENDING: ['Awaiting review', 'bg-amber-100 text-amber-800 ring-amber-200'],
    APPROVED: ['Published', 'bg-emerald-100 text-emerald-800 ring-emerald-200'],
    REJECTED: ['Not published', 'bg-red-100 text-red-800 ring-red-200'],
  };
  const [label, tone] = map[status];
  return (
    <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tone)}>
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
