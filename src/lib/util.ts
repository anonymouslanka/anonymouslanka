import { useEffect, useState } from 'react';

/** Human case reference derived from the public id, e.g. DL-4F2K-9P7M. */
export function caseNo(id: string): string {
  const s = id.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `DL-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return rtf.format(Math.round(diff), 'second');
}

/** Sets <title> and social metadata. Never include edit keys or private data here. */
export function usePageMeta(opts: { title?: string; description?: string; image?: string; path?: string; noindex?: boolean }): void {
  const { title, description, image, path, noindex } = opts;
  useEffect(() => {
    const fullTitle = title ? `${title} · DetectiveLanka` : 'DetectiveLanka — Open a case. Stay anonymous.';
    document.title = fullTitle;
    const set = (attr: 'name' | 'property', key: string, value: string | undefined) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!value) return el?.remove();
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = value;
    };
    const url = path ? `${location.origin}${path}` : undefined;
    set('name', 'description', description);
    set('property', 'og:title', fullTitle);
    set('property', 'og:description', description);
    set('property', 'og:url', url);
    set('property', 'og:image', image);
    set('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    set('name', 'twitter:title', fullTitle);
    set('name', 'twitter:description', description);
    set('name', 'twitter:image', image);
    set('name', 'robots', noindex ? 'noindex, nofollow' : undefined);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (url) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = url;
    } else link?.remove();
  }, [title, description, image, path, noindex]);
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
