import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { spring } from '../lib/motion';
import { Icon } from './Icon';

const OK = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGES = 4;
export const MAX_COMMENT_IMAGES = 2;
export const MAX_MB = 5;

interface Item {
  id: number;
  file: File;
  url: string;
}

/**
 * Local exhibit selection with previews. Validation here is only a convenience —
 * the backend re-validates by decoding the bytes and strips all EXIF/GPS metadata.
 * `compact` renders a slim attach button (used for statements).
 */
export function ImagePicker({
  slots = MAX_IMAGES,
  onChange,
  onError,
  compact = false,
  resetKey,
}: {
  slots?: number;
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  compact?: boolean;
  /** Changing this value clears the selection. */
  resetKey?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (resetKey === undefined) return;
    setItems((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
  }, [resetKey]);

  const update = (next: Item[]) => {
    setItems(next);
    onChange(next.map((i) => i.file));
  };

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...items];
    for (const file of Array.from(list)) {
      if (next.length >= slots) {
        onError(`You can add up to ${slots} image${slots === 1 ? '' : 's'}.`);
        break;
      }
      if (!OK.includes(file.type)) {
        onError('Only JPEG, PNG or WebP images are allowed.');
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        onError(`An image is larger than ${MAX_MB} MB.`);
        continue;
      }
      next.push({ id: ++counter.current, file, url: URL.createObjectURL(file) });
    }
    update(next);
    if (input.current) input.current.value = '';
  };

  const remove = (id: number) => {
    const item = items.find((i) => i.id === id);
    if (item) URL.revokeObjectURL(item.url);
    update(items.filter((i) => i.id !== id));
  };

  const hiddenInput = (
    <input ref={input} type="file" accept={OK.join(',')} multiple={slots > 1} className="sr-only" tabIndex={-1} onChange={(e) => add(e.target.files)} aria-label="Choose images" />
  );

  if (compact) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {items.map((it, i) => (
              <motion.div key={it.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={spring} className="relative h-14 w-14 overflow-hidden rounded-xl border border-stone-200">
                <img src={it.url} alt={`Selected exhibit ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => remove(it.id)} aria-label={`Remove exhibit ${i + 1}`} className="absolute top-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/80 text-white">
                  <Icon name="x" size={11} strokeWidth={2.6} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length < slots && (
            <motion.button whileTap={{ scale: 0.93 }} transition={spring} type="button" onClick={() => input.current?.click()} className="btn-ghost !min-h-10 !rounded-xl border border-dashed border-stone-300 !px-3">
              <Icon name="paperclip" size={17} /> Attach photo
            </motion.button>
          )}
        </div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div key={it.id} layout initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={spring} className="group relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
              <img src={it.url} alt={`Selected exhibit ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
              <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold tracking-widest text-white uppercase">Exhibit {String.fromCharCode(65 + i)}</span>
              <button type="button" onClick={() => remove(it.id)} aria-label={`Remove exhibit ${i + 1}`} className="absolute top-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-ink/80 text-white transition hover:bg-red-600">
                <Icon name="x" size={15} strokeWidth={2.4} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length < slots && (
          <motion.button layout whileTap={{ scale: 0.95 }} whileHover={{ y: -2 }} transition={spring} type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/60 text-center text-sm font-semibold text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-700">
            <span className="flex flex-col items-center gap-1.5">
              <Icon name="image" size={26} />
              Add exhibit
            </span>
          </motion.button>
        )}
      </div>
      {hiddenInput}
      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-soft">
        <Icon name="shieldCheck" size={14} className="mt-px shrink-0" />
        Up to {slots} photos · JPEG, PNG or WebP · {MAX_MB} MB each. Location and camera data is removed automatically.
      </p>
    </div>
  );
}
