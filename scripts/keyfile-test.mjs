// Run: node scripts/keyfile-test.mjs  (checks the access-file format, wrong password, tampering and hostile inputs)
import { sealKeyFile, readKeyFile, KeyFileError } from '../src/lib/keyfile.ts';
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const key = 'A'.repeat(43);
const toFile = async (b, name = 'x.txt') => new File([await b.text()], name);
const BEGIN = '-----BEGIN DETECTIVE LANKA ACCESS-----';
const END = '-----END DETECTIVE LANKA ACCESS-----';

let { name, blob } = await sealKeyFile({ kind: 'case', id: 'abc123def456', key });
ok('file name has kind, id, date, time', /^case-abc123def456_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.txt$/.test(name));
let parsed = await readKeyFile(await toFile(blob));
ok('plain file parses', parsed.kind === 'case' && parsed.id === 'abc123def456' && !parsed.passwordProtected);
let p = await parsed.open();
ok('plain file opens with the same key', p.key === key);

({ blob } = await sealKeyFile({ kind: 'statement', id: 'stmt12345678', postId: 'case12345678', key }, 'hunter22'));
parsed = await readKeyFile(await toFile(blob));
ok('password file detected', parsed.passwordProtected && parsed.kind === 'statement');
try { await parsed.open(); ok('needs password', false); } catch (e) { ok('needs password', e instanceof KeyFileError && e.code === 'NEEDS_PASSWORD'); }
try { await parsed.open('wrong-pass'); ok('wrong password rejected', false); } catch (e) { ok('wrong password rejected', e instanceof KeyFileError && e.code === 'WRONG_PASSWORD'); }
p = await parsed.open('hunter22');
ok('right password opens (statement keeps its case id)', p.key === key && p.postId === 'case12345678');

const bad = async (n, f, code) => { try { await readKeyFile(f); ok(n, false); } catch (e) { ok(n, e instanceof KeyFileError && (!code || e.code === code)); } };
await bad('oversized file rejected', new File(['a'.repeat(5000)], 'big.txt'), 'TOO_BIG');
await bad('binary/zip bytes rejected', new File([new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 1, 2, 3])], 'z.txt'));
await bad('random text rejected', new File(['hello world'], 'a.txt'), 'BAD_FORMAT');
await bad('sql text rejected', new File(["'; DROP TABLE posts;--"], 'a.txt'), 'BAD_FORMAT');

const text = await blob.text();
const inner = (t) => JSON.parse(atob(t.slice(t.indexOf(BEGIN) + BEGIN.length, t.indexOf(END)).replace(/\s+/g, '')));
const rebuild = (o) => `${BEGIN}\n${btoa(JSON.stringify(o))}\n${END}`;
const fails = async (n, t, pw) => { try { const q = await readKeyFile(new File([t], 'f.txt')); await q.open(pw); ok(n, false); } catch (e) { ok(n, e instanceof KeyFileError); } };
const o = inner(text);
await fails('tampered ciphertext rejected', rebuild({ ...o, d: o.d.slice(0, 20) + (o.d[20] === 'A' ? 'B' : 'A') + o.d.slice(21) }), 'hunter22');
await fails('wrong-id swap rejected (id is part of the sealed data)', rebuild({ ...o, id: 'other1234567' }), 'hunter22');
await fails('kind swap rejected', rebuild({ ...o, k: 'case' }), 'hunter22');
const evil = btoa(JSON.stringify({ v: 1, k: 'case', id: "x'; DROP TABLE--", c: '2026-10-10T00:00:00Z', p: false, s: 'A'.repeat(22) + '==', i: 'A'.repeat(16), d: 'A'.repeat(60) }));
await bad('bad id (injection) rejected', new File([`${BEGIN}\n${evil}\n${END}`], 'e.txt'), 'BAD_FORMAT');
const huge = btoa(JSON.stringify({ v: 1, k: 'case', id: 'abc123def456', c: '2026-10-10T00:00:00Z', p: false, s: 'A'.repeat(22) + '==', i: 'A'.repeat(16), d: 'A'.repeat(3500) }));
await bad('oversized block rejected', new File([`${BEGIN}\n${huge}\n${END}`], 'h.txt'));
