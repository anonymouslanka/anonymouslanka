import { AnimatePresence, motion } from 'framer-motion';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ModerationStatus } from '../lib/types';
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    setItems((x) => [...x.slice(-3), { id, kind, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  const tone: Record<ToastKind, string> = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
    info: 'border-stone-300 bg-white text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={cx('pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg', tone[t.kind])}
            >
              {t.message}
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
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/60 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
        width,
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-xl font-semibold">
              {title}
            </h2>
            {dismissable && (
              <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost -mt-1 -mr-2 !min-h-9 !px-2.5">
                ✕
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
      <div className="text-sm text-stone-600 dark:text-stone-300">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
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
  return <div className={cx('animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800', className)} aria-hidden="true" />;
}

export function PostCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-2xl dark:bg-brand-900/30" aria-hidden="true">
        🗂️
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-stone-600 dark:text-stone-400">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="card flex flex-col items-center border-red-200 px-6 py-12 text-center dark:border-red-900">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl dark:bg-red-950" aria-hidden="true">
        ⚠️
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-stone-600 dark:text-stone-400">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: ModerationStatus }) {
  const map: Record<ModerationStatus, [string, string]> = {
    PENDING: ['Awaiting review', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'],
    APPROVED: ['Published', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'],
    REJECTED: ['Not published', 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'],
  };
  const [label, tone] = map[status];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>{label}</span>;
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      {messages.join(' · ')}
    </p>
  );
}
