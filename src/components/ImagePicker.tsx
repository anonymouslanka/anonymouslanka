import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
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
 * Local exhibit selection with previews. Validation here is only a convenience, * the backend re-validates by decoding the bytes and strips all EXIF/GPS metadata.
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
  const t = useT();
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
        onError(slots === 1 ? t('You can add up to 1 image.') : t('You can add up to {n} images.', { n: slots }));
        break;
      }
      if (!OK.includes(file.type)) {
        onError(t('Only JPEG, PNG or WebP images are allowed.'));
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        onError(t('An image is larger than {n} MB.', { n: MAX_MB }));
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
    <input ref={input} type="file" accept={OK.join(',')} multiple={slots > 1} className="sr-only" tabIndex={-1} onChange={(e) => add(e.target.files)} aria-label={t('Choose images')} />
  );

  if (compact) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {items.map((it, i) => (
            <div key={it.id} className="relative h-14 w-14 overflow-hidden rounded-xl border border-black/10">
              <img src={it.url} alt={t('Selected exhibit {n}', { n: i + 1 })} className="h-full w-full object-cover" />
              <button type="button" onClick={() => remove(it.id)} aria-label={t('Remove exhibit {n}', { n: i + 1 })} className="absolute top-0.5 right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/85 text-white">
                <Icon name="x" size={12} strokeWidth={2.8} />
              </button>
            </div>
          ))}
          {items.length < slots && (
            <button type="button" onClick={() => input.current?.click()} className="btn-secondary !min-h-11 !rounded-xl !px-3.5">
              <Icon name="paperclip" size={18} /> {t('Attach photo')}
            </button>
          )}
        </div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.id} className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5">
            <img src={it.url} alt={t('Selected exhibit {n}', { n: i + 1 })} className="h-full w-full rounded-xl object-cover" />
            <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/85 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-widest text-white uppercase">{t('Exhibit {x}', { x: String.fromCharCode(65 + i) })}</span>
            <button type="button" onClick={() => remove(it.id)} aria-label={t('Remove exhibit {n}', { n: i + 1 })} className="absolute top-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-ink/85 text-white active:bg-red-600">
              <Icon name="x" size={16} strokeWidth={2.6} />
            </button>
          </div>
        ))}
        {items.length < slots && (
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-black/20 bg-white/60 text-center text-sm font-bold text-ink-soft transition-transform duration-100 active:scale-[0.97]">
            <span className="flex flex-col items-center gap-1.5">
              <Icon name="image" size={28} />
              {t('Add exhibit')}
            </span>
          </button>
        )}
      </div>
      {hiddenInput}
      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-soft">
        <Icon name="shieldCheck" size={14} className="mt-px shrink-0" />
        {t('Up to {slots} photos · JPEG, PNG or WebP · {mb} MB each. Location and camera data is removed automatically.', { slots, mb: MAX_MB })}
      </p>
    </div>
  );
}
