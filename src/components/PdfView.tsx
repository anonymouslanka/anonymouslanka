import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { Spinner } from './ui';

/** One page. Rendered only while near the screen and released again when far away, so long PDFs stay light. */
function Page({ doc, n, width, ratio }: { doc: PDFDocumentProxy; n: number; width: number; ratio: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(n <= 2);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setNear(e.isIntersecting);
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    if (!near || !width) {
      c.width = 0; // free the bitmap
      return;
    }
    let task: RenderTask | undefined;
    let dead = false;
    (async () => {
      const page = await doc.getPage(n);
      if (dead) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
    })().catch(() => undefined);
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [near, width, doc, n]);

  return (
    <div ref={wrap} className="mx-auto overflow-hidden rounded-md bg-white" style={{ width, height: Math.round(width * ratio) }}>
      <canvas ref={canvas} className="block h-full w-full" aria-label={`Page ${n}`} />
    </div>
  );
}

/** Scrollable PDF reader (pdf.js, loaded only when a PDF is opened). */
export default function PdfView({ url, onFail }: { url: string; onFail: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    let task: PDFDocumentLoadingTask | undefined;
    (async () => {
      const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.min.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch');
      const data = new Uint8Array(await res.arrayBuffer());
      const loading = pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false });
      task = loading;
      const d = await loading.promise;
      const first = (await d.getPage(1)).getViewport({ scale: 1 });
      if (dead) return;
      setRatio(first.height / first.width);
      setDoc(d);
    })().catch(() => {
      if (!dead) {
        setFailed(true);
        onFail();
      }
    });
    return () => {
      dead = true;
      void task?.destroy();
    };
  }, [url, onFail]);

  // current page = the first page whose bottom edge is below 40% of the screen
  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      const line = el.scrollTop + el.clientHeight * 0.4;
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i] as HTMLElement;
        if (c.offsetTop + c.offsetHeight > line) return setPage(i + 1);
      }
    });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(Math.floor(el.clientWidth) - 16, 920)));
    ro.observe(el);
    setWidth(Math.min(Math.floor(el.clientWidth) - 16, 920));
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative h-full">
      <div ref={box} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto overscroll-contain bg-neutral-800 p-2 pb-16" style={{ touchAction: 'pan-y' }}>
        {!doc && !failed && (
          <div className="grid h-full place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2.5"><Spinner /> {t('Opening document…')}</span>
          </div>
        )}
        {doc && Array.from({ length: doc.numPages }, (_, i) => <Page key={i} doc={doc} n={i + 1} width={width} ratio={ratio} />)}
      </div>
      {doc && doc.numPages > 1 && (
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3.5 py-1.5 font-mono text-xs tracking-wider text-white">
          {t('Page {n} / {total}', { n: page, total: doc.numPages })}
        </span>
      )}
    </div>
  );
}
