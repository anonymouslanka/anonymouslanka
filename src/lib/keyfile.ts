/**
 * Access files: a small text file that holds the secret key of one case or statement, sealed with AES-GCM.
 *
 *  - Everything happens in the browser. The file is never uploaded: the app reads it, unseals the key, and the key
 *    is then checked with the normal owner request (X-Edit-Key header) before anything is saved.
 *  - The reader is strict: tiny size limit, text only, one base64 block, a fixed JSON shape with exact patterns. No zip,
 *    no archive, no nested formats, no values ever reach the server or a query.
 *  - With a password the file is protected by PBKDF2 (210k rounds) + AES-GCM. Without a password the file is sealed
 *    with a built-in value, which only hides the key from casual reading: anyone holding such a file can manage the
 *    case, exactly like holding the key.
 */
export type KeyKind = 'case' | 'statement';

export interface KeyPayload {
  kind: KeyKind;
  /** case id, or statement id */
  id: string;
  /** the case a statement belongs to */
  postId?: string;
  key: string;
}

const MAX_BYTES = 4096;
const BUILT_IN = 'detective-lanka/access-file/v1';
const ID_RE = /^[a-z0-9]{8,24}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const BEGIN = '-----BEGIN DETECTIVE LANKA ACCESS-----';
const END = '-----END DETECTIVE LANKA ACCESS-----';

const enc = new TextEncoder();
const toB64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function deriveKey(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;

/** e.g. case-6ymtxzwge5ns_2026-10-10_14-25.txt */
export function keyFileName(kind: KeyKind, id: string, when = new Date()): string {
  return `${kind}-${id}_${stamp(when)}.txt`;
}

export async function sealKeyFile(p: KeyPayload, password?: string): Promise<{ name: string; blob: Blob }> {
  const now = new Date();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const secret = password ? password : `${BUILT_IN}/${p.id}`;
  const aes = await deriveKey(secret, salt);
  const plain = enc.encode(JSON.stringify({ key: p.key, postId: p.postId ?? null }));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`${p.kind}:${p.id}`) }, aes, plain));
  const body = JSON.stringify({ v: 1, k: p.kind, id: p.id, c: now.toISOString(), p: Boolean(password), s: toB64(salt), i: toB64(iv), d: toB64(cipher) });
  const label = p.kind === 'case' ? 'Case' : 'Statement';
  const text = [
    'DETECTIVE LANKA ACCESS FILE',
    `${label}: ${p.id}`,
    `Created: ${now.toLocaleString()}`,
    '',
    `Keep this file private. Whoever has it can manage this ${p.kind}. We do not keep a copy and cannot recover it.`,
    'To use it on another device: open Detective Lanka, go to My cases and choose "Import access file".',
    '',
    BEGIN,
    toB64(enc.encode(body)).replace(/(.{64})/g, '$1\n'),
    END,
    '',
  ].join('\n');
  return { name: keyFileName(p.kind, p.id, now), blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) };
}

type KeyFileCode = 'TOO_BIG' | 'NOT_TEXT' | 'BAD_FORMAT' | 'NEEDS_PASSWORD' | 'WRONG_PASSWORD';
export class KeyFileError extends Error {
  readonly code: KeyFileCode;
  constructor(code: KeyFileCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ParsedKeyFile {
  kind: KeyKind;
  id: string;
  passwordProtected: boolean;
  open: (password?: string) => Promise<KeyPayload>;
}

/** Validates the file shape without decrypting it. Throws KeyFileError for anything unexpected. */
export async function readKeyFile(file: File): Promise<ParsedKeyFile> {
  if (file.size > MAX_BYTES) throw new KeyFileError('TOO_BIG', 'This file is too big to be an access file.');
  const text = await file.text();
  if (text.length > MAX_BYTES || /\u0000/.test(text)) throw new KeyFileError('NOT_TEXT', 'This is not a text access file.');
  const a = text.indexOf(BEGIN);
  const b = text.indexOf(END);
  if (a < 0 || b < a) throw new KeyFileError('BAD_FORMAT', 'This is not a Detective Lanka access file.');
  const block = text.slice(a + BEGIN.length, b).replace(/\s+/g, '');
  if (block.length < 40 || block.length > 3000 || !B64_RE.test(block)) throw new KeyFileError('BAD_FORMAT', 'The access file is damaged.');
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(new TextDecoder().decode(fromB64(block))) as Record<string, unknown>;
  } catch {
    throw new KeyFileError('BAD_FORMAT', 'The access file is damaged.');
  }
  const str = (k: string, re: RegExp): string => {
    const v = obj[k];
    if (typeof v !== 'string' || !re.test(v)) throw new KeyFileError('BAD_FORMAT', 'The access file is damaged.');
    return v;
  };
  if (obj.v !== 1 || (obj.k !== 'case' && obj.k !== 'statement') || typeof obj.p !== 'boolean') throw new KeyFileError('BAD_FORMAT', 'This access file version is not supported.');
  const kind = obj.k as KeyKind;
  const id = str('id', ID_RE);
  str('c', /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  const salt = str('s', /^[A-Za-z0-9+/]{22,24}={0,2}$/);
  const iv = str('i', /^[A-Za-z0-9+/]{16}$/);
  const data = str('d', /^[A-Za-z0-9+/]{40,400}={0,2}$/);
  const protectedFile = obj.p;
  return {
    kind,
    id,
    passwordProtected: protectedFile,
    open: async (password?: string) => {
      if (protectedFile && !password) throw new KeyFileError('NEEDS_PASSWORD', 'This file needs its password.');
      try {
        const aes = await deriveKey(protectedFile ? (password as string) : `${BUILT_IN}/${id}`, fromB64(salt));
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv), additionalData: enc.encode(`${kind}:${id}`) }, aes, fromB64(data));
        const inner = JSON.parse(new TextDecoder().decode(plain)) as { key?: unknown; postId?: unknown };
        if (typeof inner.key !== 'string' || !KEY_RE.test(inner.key)) throw new Error('bad key');
        const postId = typeof inner.postId === 'string' && ID_RE.test(inner.postId) ? inner.postId : undefined;
        if (kind === 'statement' && !postId) throw new Error('missing case');
        return { kind, id, key: inner.key, postId };
      } catch {
        throw new KeyFileError(protectedFile ? 'WRONG_PASSWORD' : 'BAD_FORMAT', protectedFile ? 'That password is not correct.' : 'The access file is damaged.');
      }
    },
  };
}

/** Browser download of the sealed file. */
export function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
