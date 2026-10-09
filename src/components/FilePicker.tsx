import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { DOC_ACCEPT, DOC_EXT, extOf, fmtBytes, MAX_FILE_MB } from '../lib/files';
import type { FileDto } from '../lib/types';
import { cx } from '../lib/util';
import { Icon } from './Icon';

/** A document row: type badge, name, size, optional open / remove actions. */
export function FileRow({ file, onOpen, onRemove, className }: { file: Pick<FileDto, 'name' | 'ext' | 'bytes'>; onOpen?: () => void; onRemove?: () => void; className?: string }) {
  const t = useT();
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-folder font-mono text-[0.6rem] font-bold tracking-wider text-[#7a5a14] uppercase">{file.ext}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-bold">{file.name}.{file.ext}</span>
        <span className="block text-xs text-ink-soft">{fmtBytes(file.bytes)}</span>
      </span>
    </>
  );
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-2.5', className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" aria-label={t('Open {name}', { name: `${file.name}.${file.ext}` })}>{body}<Icon name="chevronRight" size={18} className="shrink-0 text-ink-soft" /></button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('Remove {name}', { name: `${file.name}.${file.ext}` })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5 text-ink-soft active:bg-red-100 active:text-red-700">
          <Icon name="x" size={17} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

interface Item {
  id: number;
  file: File;
}

/**
 * Local document selection (PDF, DOCX, XLSX, PPTX, TXT). Checks here are only a convenience, the backend validates
 * the real file contents, removes author details and refuses macros.
 */
export function FilePicker({
  slots,
  onChange,
  onError,
  compact = false,
  resetKey,
}: {
  slots: number;
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  compact?: boolean;
  resetKey?: number;
}) {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (resetKey !== undefined) setItems([]);
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
        onError(slots === 1 ? t('You can add up to 1 document.') : t('You can add up to {n} documents.', { n: slots }));
        break;
      }
      if (!DOC_EXT.includes(extOf(file.name))) {
        onError(t('Only PDF, DOCX, XLSX, PPTX or TXT documents are allowed.'));
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        onError(t('“{name}” is larger than {n} MB.', { name: file.name, n: MAX_FILE_MB }));
        continue;
      }
      if (file.size === 0) {
        onError(t('“{name}” is empty.', { name: file.name }));
        continue;
      }
      next.push({ id: ++counter.current, file });
    }
    update(next);
    if (input.current) input.current.value = '';
  };

  const rows = items.map((it) => {
    const ext = extOf(it.file.name);
    return <FileRow key={it.id} file={{ name: it.file.name.replace(/\.[^.]*$/, ''), ext, bytes: it.file.size }} onRemove={() => update(items.filter((i) => i.id !== it.id))} />;
  });
  const hidden = <input ref={input} type="file" accept={DOC_ACCEPT} multiple={slots > 1} className="sr-only" tabIndex={-1} onChange={(e) => add(e.target.files)} aria-label={t('Choose documents')} />;

  if (compact) {
    return (
      <div className="space-y-2">
        {rows}
        {items.length < slots && (
          <button type="button" onClick={() => input.current?.click()} className="btn-secondary !min-h-11 !rounded-xl !px-3.5">
            <Icon name="file" size={18} /> {t('Attach document')}
          </button>
        )}
        {hidden}
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2.5">{rows}</div>
      {items.length < slots && (
        <button type="button" onClick={() => input.current?.click()} className={cx('flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-black/20 bg-white/60 px-4 py-5 text-sm font-bold text-ink-soft transition-transform duration-100 active:scale-[0.98]', items.length > 0 && 'mt-2.5')}>
          <Icon name="file" size={22} /> {t('Add document')}
        </button>
      )}
      {hidden}
      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-soft">
        <Icon name="shieldCheck" size={14} className="mt-px shrink-0" />
        {t('Up to {slots} · PDF, DOCX, XLSX, PPTX or TXT · {mb} MB each. Author details inside the file are removed, but the file name is public, don’t put real names in it.', { slots, mb: MAX_FILE_MB })}
      </p>
    </div>
  );
}
