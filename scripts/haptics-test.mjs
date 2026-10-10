// Run: node scripts/haptics-test.mjs  (checks the pull-to-refresh haptic patterns with a fake vibrate API)
const calls = [];
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.localStorage = { getItem: () => null, setItem: () => undefined };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p) => { calls.push(p); return true; } }, configurable: true });
const { haptics } = await import('../src/lib/haptics.ts');
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
haptics.pullTick(); ok('tick is a single very light pulse', calls.at(-1) === 9);
await wait(60); haptics.pullReady(); ok('threshold is one firm pulse', calls.at(-1) === 35);
await wait(60); haptics.refreshed(); ok('completion is two quick light taps', Array.isArray(calls.at(-1)) && calls.at(-1).length === 3 && calls.at(-1)[0] <= 12);
await wait(60); const n = calls.length; haptics.pullTick(); haptics.pullTick(); haptics.pullTick(); ok('rapid ticks are rate limited (no buzzing)', calls.length - n === 1);
await wait(60); haptics.pullTick(); haptics.pullReady(); ok('the threshold pulse is never swallowed by a tick', calls.at(-1) === 35);
