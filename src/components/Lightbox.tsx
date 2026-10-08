import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ImageDto } from '../lib/types';
import { Icon } from './Icon';

/** Full-screen exhibit viewer: keyboard, buttons and touch swipe. (Framer Motion fades it in/out.) */
export function Lightbox({ images, index, onIndex, onClose }: { images: ImageDto[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null && images[index] !== undefined;
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(images.length - 1, (index ?? 0) + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, (index ?? 0) - 1));
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = '';
    };
  }, [open, index, images.length, onClose, onIndex]);

  const go = (d: number) => index !== null && onIndex(Math.max(0, Math.min(images.length - 1, index + d)));

  return (
    <AnimatePresence>
      {open && index !== null && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Exhibit viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[95] flex flex-col bg-black/95 pt-safe pb-safe"
          onClick={onClose}
          onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const x0 = touchX.current;
            const x1 = e.changedTouches[0]?.clientX;
            touchX.current = null;
            if (x0 === null || x1 === undefined) return;
            if (x1 - x0 < -60) go(1);
            else if (x1 - x0 > 60) go(-1);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs tracking-[0.16em] uppercase">Exhibit {String.fromCharCode(65 + index)} · {index + 1}/{images.length}</span>
            <button className="grid h-11 w-11 place-items-center rounded-full bg-white/15 active:bg-white/30" onClick={onClose} aria-label="Close viewer"><Icon name="x" size={22} /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <img key={images[index]!.id} src={images[index]!.large} crossOrigin="anonymous" alt={`Exhibit ${String.fromCharCode(65 + index)}`} className="page-in max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
            {index > 0 && <button className="absolute left-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white active:bg-white/30" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous exhibit"><Icon name="chevronLeft" size={24} /></button>}
            {index < images.length - 1 && <button className="absolute right-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white active:bg-white/30" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next exhibit"><Icon name="chevronRight" size={24} /></button>}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
