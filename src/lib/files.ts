import { API_BASE } from './api';
import type { FileDto, ImageDto } from './types';

export const DOC_EXT = ['pdf', 'docx', 'xlsx', 'pptx', 'txt'];
export const DOC_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.txt';
export const MAX_FILES = 3;
export const MAX_COMMENT_FILES = 2;
export const MAX_FILE_MB = 8;

export const extOf = (name: string): string => (name.split('.').pop() ?? '').toLowerCase();

export const fmtBytes = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Documents are always streamed through the API (they are private storage, never public CDN links). */
export const fileUrl = (f: Pick<FileDto, 'id'>): string => `${API_BASE}/files/${f.id}`;

export const KIND_LABEL: Record<string, string> = { pdf: 'PDF document', docx: 'Word document', xlsx: 'Excel spreadsheet', pptx: 'PowerPoint deck', txt: 'Text file' };

export type ViewerItem =
  | { kind: 'image'; id: string; src: string; label: string }
  | { kind: 'file'; id: string; label: string; name: string; ext: string; bytes: number; url: string };

const letter = (i: number): string => String.fromCharCode(65 + i);

/** Photos first, then documents — the order the viewer swipes through. */
export const viewerItems = (images: ImageDto[], files: FileDto[]): ViewerItem[] => [
  ...images.map((img, i): ViewerItem => ({ kind: 'image', id: img.id, src: img.large, label: `Exhibit ${letter(i)}` })),
  ...files.map((f): ViewerItem => ({ kind: 'file', id: f.id, label: `${f.name}.${f.ext}`, name: f.name, ext: f.ext, bytes: f.bytes, url: fileUrl(f) })),
];

/** Saves a document through a blob so the browser keeps the proper file name (works for installed apps too). */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('download failed');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
