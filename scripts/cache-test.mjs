// Run: node scripts/cache-test.mjs
// Bundles lib/api.ts for node and checks, against a tiny local server that counts requests, that going back to a page
// does not call the server again, that writes clear the right entries, and that concurrent reads share one request.
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const esbuild = createRequire(path.join(root, '../backend/package.json'))('esbuild');
const hits = {};
const server = http.createServer((req, res) => {
  const key = req.method + ' ' + req.url.split('?')[0].replace(/mock\d+/, ':id');
  hits[key] = (hits[key] ?? 0) + 1;
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/api/v1/posts?') || req.url.endsWith('/posts')) return res.end(JSON.stringify({ data: [{ id: 'mock00000001' }], meta: { hasMore: false, nextCursor: null, limit: 12 } }));
  if (req.method === 'POST' && req.url.endsWith('/comments')) { res.statusCode = 201; return res.end(JSON.stringify({ data: { comment: { id: 'c1' }, editKey: 'k' } })); }
  res.end(JSON.stringify({ data: { id: 'mock00000001', title: 'x' } }));
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/api/v1`;

const stubI18n = path.join(os.tmpdir(), 'dl-i18n-stub.mjs');
fs.writeFileSync(stubI18n, 'export const t = (s) => s;');
const out = path.join(os.tmpdir(), 'dl-api-bundle.cjs');
await esbuild.build({
  entryPoints: [path.join(root, 'src/lib/api.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: out,
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(url) },
  plugins: [{ name: 'stub', setup: (b) => b.onResolve({ filter: /^\.\/i18n$/ }, () => ({ path: stubI18n })) }],
  logLevel: 'silent',
});
globalThis.localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const { api, forget, peek } = createRequire(import.meta.url)(out);

const ok = (n, c, d = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + d));
const n = (k) => hits[k] ?? 0;
await api.getPost('mock00000001');
await api.getPost('mock00000001');
await api.getPost('mock00000001');
ok('same case opened 3 times: one request', n('GET /api/v1/posts/:id') === 1, JSON.stringify(hits));
await Promise.all([api.listPosts({}), api.listPosts({}), api.listPosts({})]);
ok('three components asking for the list at once share one request', n('GET /api/v1/posts') === 1, JSON.stringify(hits));
await api.listPosts({});
ok('coming back to the list: no new request', n('GET /api/v1/posts') === 1);
ok('peek returns the stored case at once', api.peekPost('mock00000001')?.id === 'mock00000001');
const form = new FormData(); form.append('content', 'hello');
await api.createComment('mock00000001', form);
await api.getPost('mock00000001');
ok('posting a statement clears the case (comment count) so it is fetched again', n('GET /api/v1/posts/:id') === 2, JSON.stringify(hits));
forget('feed:');
await api.listPosts({});
ok('pull to refresh (forget feed) fetches the list again', n('GET /api/v1/posts') === 2);
ok('different filters are cached separately', (await api.listPosts({ q: 'abc' })) && n('GET /api/v1/posts') === 3);
server.close();
