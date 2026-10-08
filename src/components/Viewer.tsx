import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtBytes, KIND_LABEL, ViewerItem } from '../lib/files';
import { haptics } from '../lib/haptics';
import { cx } from '../lib/util';
import { Icon } from './Icon';
import { Spinner } from './ui';

const PdfView = lazy(() => import('./PdfView'));

type FileItem = Extract<ViewerItem, { kind: 'file' }>;

function ImageSlide({ item }: { item: Extract<ViewerItem, { kind: 'image' }> }) {
  const [zoom, setZoom] = useState(false);
  const lastTap = useRef(0);
  return (
    <div className={cx('h-full w-full', zoom ? 'overflow-auto' : 'grid place-items-center overflow-hidden')}>
      <img
        src={item.src}
        crossOrigin="anonymous"
        alt={item.label}
        draggable={false}
        onClick={() => {
          const now = Date.now();
          if (now - lastTap.current < 320) setZoom((z) => !z); // double tap / double click
          lastTap.current = now;
        }}
        className={cx('select-none', zoom ? 'max-w-none w-[220%] cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
      />
    </div>
  );
}

function TextSlide({ item }: { item: FileItem }) {
  const [text, setText] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let dead = false;
    fetch(item.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('x'))))
      .then((t) => !dead && setText(t.slice(0, 300_000)))
      .catch(() => !dead && setBad(true));
    return () => {
      dead = true;
    };
  }, [item.url]);
  if (bad) return <Unavailable item={item} />;
  if (text === null) return <Center><Spinner /> Loading…</Center>;
  return <pre className="h-full overflow-auto overscroll-contain bg-neutral-900 p-4 font-code text-[0.82rem] leading-relaxed break-words whitespace-pre-wrap text-white/90" data-selectable>{text}</pre>;
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="grid h-full place-items-center px-6 text-center text-sm text-white/80"><span className="flex items-center gap-2.5">{children}</span></div>;

/** Word / Excel / PowerPoint cannot be drawn safely inside the app, and files are not offered for download. */
function Unavailable({ item, note }: { item: FileItem; note?: string }) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/10 p-6 text-center text-white">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15"><Icon name="file" size={32} /></span>
        <p className="mt-4 font-display text-lg font-bold break-words">{item.name}.{item.ext}</p>
        <p className="mt-1 text-sm text-white/70">{KIND_LABEL[item.ext] ?? 'Document'} · {fmtBytes(item.bytes)}</p>
        <p className="mt-3 text-xs text-white/70">{note ?? 'This file type cannot be previewed in the app. Moderators have reviewed it.'}</p>
      </div>
    </div>
  );
}

function Slide({ item }: { item: ViewerItem }) {
  const [pdfFailed, setPdfFailed] = useState(false);
  const fail = useCallback(() => setPdfFailed(true), []);
  if (item.kind === 'image') return <ImageSlide item={item} />;
  if (item.ext === 'pdf') {
    if (pdfFailed) return <Unavailable item={item} note="This PDF could not be shown here. Please try again later." />;
    return (
      <Suspense fallback={<Center><Spinner /> Opening document…</Center>}>
        <PdfView url={item.url} onFail={fail} />
      </Suspense>
    );
  }
  if (item.ext === 'txt') return <TextSlide item={item} />;
  return <Unavailable item={item} />;
}

/**
 * Full-screen viewer for a case's exhibits: photos and documents in ONE swipeable strip.
 * Swipe (or use the arrows / arrow keys) to move between files; a PDF scrolls up and down page by page.
 */
export function Viewer({ items, index, onIndex, onClose }: { items: ViewerItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null && items[index] !== undefined;
  const track = useRef<HTMLDivElement>(null);
  const settle = useRef<number>(0);
  const current = index ?? 0;

  // Jump (no animation) on open; animate when the index changes from the arrows / keys.
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = track.current;
    if (!open || !el) {
      first.current = true;
      return;
    }
    const target = current * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [open, current]);

  const go = useCallback((d: number) => onIndex(Math.max(0, Math.min(items.length - 1, current + d))), [onIndex, items.length, current]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [open, go, onClose]);

  if (!open || index === null) return null;
  const item = items[index]!;

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = track.current;
      if (!el) return;
      const page = Math.round(el.scrollLeft / el.clientWidth);
      if (page !== current && items[page]) {
        haptics.select();
        onIndex(page);
      }
    }, 90);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Exhibit viewer" className="page-in fixed inset-0 z-[95] flex flex-col bg-black pt-safe pb-safe">
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs tracking-[0.14em] uppercase">{item.label}</p>
          <p className="text-[0.7rem] text-white/60">{index + 1} of {items.length}{item.kind === 'file' ? ` · ${KIND_LABEL[item.ext] ?? 'Document'}` : ''}</p>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/15 active:bg-white/30" onClick={onClose} aria-label="Close viewer"><Icon name="x" size={22} /></button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={track} onScroll={onScroll} className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}>
          {items.map((it, i) => (
            <div key={`${it.kind}:${it.id}`} className="h-full w-full shrink-0 snap-center snap-always overflow-hidden">
              {Math.abs(i - current) <= 1 ? <Slide item={it} /> : null}
            </div>
          ))}
        </div>
        {items.length > 1 && index > 0 && (
          <button className="absolute top-1/2 left-2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white active:bg-white/35 sm:grid" onClick={() => go(-1)} aria-label="Previous file"><Icon name="chevronLeft" size={24} /></button>
        )}
        {items.length > 1 && index < items.length - 1 && (
          <button className="absolute top-1/2 right-2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white active:bg-white/35 sm:grid" onClick={() => go(1)} aria-label="Next file"><Icon name="chevronRight" size={24} /></button>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5" aria-hidden="true">
          {items.map((it, i) => <span key={`${it.kind}:${it.id}`} className={cx('h-1.5 rounded-full transition-all duration-150', i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/35')} />)}
        </div>
      )}
    </div>
  );
}
