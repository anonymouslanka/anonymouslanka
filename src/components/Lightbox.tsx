import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import type { ImageDto } from '../lib/types';
import { Icon } from './Icon';

/** Full-screen exhibit viewer with keyboard + button navigation. */
export function Lightbox({ images, index, onIndex, onClose }: { images: ImageDto[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null && images[index] !== undefined;
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

  return (
    <AnimatePresence>
      {open && index !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Exhibit viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex flex-col bg-ink/95 pt-safe pb-safe backdrop-blur-sm"
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs font-bold tracking-[0.16em] uppercase">Exhibit {String.fromCharCode(65 + index)} · {index + 1}/{images.length}</span>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={onClose} aria-label="Close viewer"><Icon name="x" size={20} /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <motion.img
              key={images[index]!.id}
              src={images[index]!.large}
              crossOrigin="anonymous"
              alt={`Exhibit ${String.fromCharCode(65 + index)}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) onIndex(Math.min(images.length - 1, index + 1));
                else if (info.offset.x > 80) onIndex(Math.max(0, index - 1));
              }}
            />
            {index > 0 && <button className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25" onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} aria-label="Previous exhibit"><Icon name="chevronLeft" size={22} /></button>}
            {index < images.length - 1 && <button className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25" onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} aria-label="Next exhibit"><Icon name="chevronRight" size={22} /></button>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
