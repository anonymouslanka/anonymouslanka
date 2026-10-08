import { useEffect, useRef, useState } from 'react';

const OK = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGES = 4;
export const MAX_MB = 5;

interface Item {
  file: File;
  url: string;
}

/**
 * Local image selection with previews. Validation here is only a convenience —
 * the backend re-validates by decoding the bytes and strips all EXIF/GPS metadata.
 */
export function ImagePicker({
  slots = MAX_IMAGES,
  onChange,
  onError,
}: {
  slots?: number;
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

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
        onError(`“${file.name}” is not a JPEG, PNG or WebP image.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        onError(`“${file.name}” is larger than ${MAX_MB} MB.`);
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    update(next);
    if (input.current) input.current.value = '';
  };

  const remove = (idx: number) => {
    const item = items[idx];
    if (item) URL.revokeObjectURL(item.url);
    update(items.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.url} className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200">
            <img src={it.url} alt={`Selected image ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove image ${i + 1}`}
              className="absolute top-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-stone-950/75 text-white transition hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length < slots && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-stone-300 text-center text-sm text-stone-500 transition hover:border-brand-500 hover:text-brand-700"
          >
            <span>
              <span className="block text-2xl" aria-hidden="true">＋</span>
              Add image
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={OK.join(',')} multiple className="sr-only" tabIndex={-1} onChange={(e) => add(e.target.files)} aria-label="Choose images" />
      <p className="mt-2 text-xs text-stone-500">
        Up to {slots} images · JPEG, PNG or WebP · max {MAX_MB} MB each. Location and camera data is automatically removed.
      </p>
    </div>
  );
}
