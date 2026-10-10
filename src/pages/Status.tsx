import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, IconName } from '../components/Icon';
import { Spinner } from '../components/ui';
import { API_BASE } from '../lib/api';
import { cx, usePageMeta } from '../lib/util';

const INTERVAL = 180; // seconds between automatic checks (3 minutes)
const KEEP = 30; // checks kept in the history strip

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface StatusBody { status: string; service: string; timestamp: string; uptimeSeconds: number }
interface HealthBody { status: string; checks: { database: string; redis: string; media: string } }
interface Check { t: number; ok: boolean; ms: number }

/** One timed request. Never throws; a failure is just a data point. */
async function timed<T>(path: string, signal: AbortSignal): Promise<{ ok: boolean; ms: number; body?: T }> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store', signal });
    const json = (await res.json().catch(() => null)) as ({ data?: T } & Record<string, unknown>) | null;
    const body = (json && 'data' in json ? json.data : (json as unknown as T | null)) ?? undefined; // /status is bare, /health is wrapped
    return { ok: res.ok || res.status === 503, ms: Math.round(performance.now() - t0), body };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

function human(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [d && `${d}d`, (d || h) && `${h}h`, (d || h || m) && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function Row({ icon, label, state }: { icon: IconName; label: string; state: 'up' | 'down' | 'degraded' | 'unknown' }) {
  const tone = state === 'up' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : state === 'down' ? 'text-red-700 bg-red-50 border-red-200' : state === 'degraded' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-stone-500 bg-black/5 border-black/10';
  const text = state === 'up' ? 'Operational' : state === 'down' ? 'Down' : state === 'degraded' ? 'Degraded' : 'Checking…';
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex items-center gap-3 text-sm font-bold"><Icon name={icon} size={20} className="text-ink-soft" /> {label}</span>
      <span className={cx('rounded-full border px-3 py-1 text-xs font-bold', tone)}>{text}</span>
    </li>
  );
}

export default function Status() {
  usePageMeta({ title: 'System status', description: 'Live status of the Detective Lanka service: availability, response time and uptime.', path: '/status' });
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem('app:status-auto') === '1'; // off until someone switches it on
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState<StatusBody | null>(null);
  const [health, setHealth] = useState<HealthBody | null>(null);
  const [history, setHistory] = useState<Check[]>([]);
  const [last, setLast] = useState<Check | null>(null);
  const [left, setLeft] = useState(INTERVAL);
  const running = useRef(false);
  const deadline = useRef(0);

  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 65_000); // a sleeping free host can take ~a minute
    const [s, h] = await Promise.all([timed<StatusBody>('/status', ctl.signal), timed<HealthBody>('/health', ctl.signal)]);
    clearTimeout(timer);
    const point: Check = { t: Date.now(), ok: s.ok && !!s.body, ms: s.ms };
    setLast(point);
    setHistory((p) => [...p.slice(-(KEEP - 1)), point]);
    if (s.body) setStatus(s.body);
    setHealth(h.body ?? null);
    setLeft(INTERVAL);
    deadline.current = Date.now() + INTERVAL * 1000; // a manual check also restarts the 3 minute wait
    setBusy(false);
    running.current = false;
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Automatic check every 3 minutes while it is switched on. It keeps running in a background tab (that is the point:
  // a regular call stops the free server from going to sleep). The deadline is a timestamp, so browser timer throttling
  // in background tabs only makes a check a little late, never skips it.
  useEffect(() => {
    if (!auto) return;
    deadline.current = Date.now() + INTERVAL * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !running.current) {
        deadline.current = Date.now() + INTERVAL * 1000;
        void check();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [auto, check]);

  const toggle = () => {
    const next = !auto;
    setAuto(next);
    setLeft(INTERVAL);
    try {
      localStorage.setItem('app:status-auto', next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const down = last !== null && !last.ok;
  const degraded = !down && (health?.status === 'degraded' || (last?.ms ?? 0) > 4000);
  const overall = last === null ? 'checking' : down ? 'down' : degraded ? 'degraded' : 'ok';
  const headline = { checking: 'Checking…', down: 'Service unavailable', degraded: 'Running with reduced performance', ok: 'All systems operational' }[overall];
  const tone = { checking: 'bg-black/5 text-stone-600', down: 'bg-red-50 text-red-700 border-red-200', degraded: 'bg-amber-50 text-amber-800 border-amber-200', ok: 'bg-emerald-50 text-emerald-800 border-emerald-200' }[overall];
  const dot = { checking: 'bg-stone-400', down: 'bg-red-500', degraded: 'bg-amber-500', ok: 'bg-emerald-500' }[overall];
  const dep = (v?: string): 'up' | 'down' | 'degraded' | 'unknown' => (!health ? (down ? 'down' : 'unknown') : v === 'up' || v === 'configured' ? 'up' : v === 'disabled' ? 'degraded' : 'down');
  const max = Math.max(500, ...history.map((c) => c.ms));

  return (
    <div className="mx-auto max-w-2xl xl:max-w-4xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">System status</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Live availability of the Detective Lanka service. It checks when you open it. Switch on auto-refresh to keep checking every 3 minutes.</p>

      <section className={cx('card mt-6 border p-5', tone)} aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="relative grid h-4 w-4 place-items-center">
            {overall === 'ok' && <span className="absolute h-4 w-4 animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={cx('relative h-3 w-3 rounded-full', dot)} />
          </span>
          <h2 className="font-display text-xl font-bold">{headline}</h2>
        </div>
        {last && last.ms > 4000 && !down && <p className="mt-2 text-sm">The server was asleep and has just woken up, the first request after a quiet period is slow. This is normal.</p>}
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><dt className="font-mono text-[0.64rem] tracking-[0.14em] uppercase opacity-70">Response</dt><dd className="mt-0.5 text-lg font-bold">{last ? `${last.ms} ms` : '-'}</dd></div>
          <div><dt className="font-mono text-[0.64rem] tracking-[0.14em] uppercase opacity-70">Uptime</dt><dd className="mt-0.5 text-lg font-bold">{status ? human(status.uptimeSeconds) : '-'}</dd></div>
          <div className="col-span-2"><dt className="font-mono text-[0.64rem] tracking-[0.14em] uppercase opacity-70">Service</dt><dd className="mt-0.5 truncate text-lg font-bold">{status?.service ?? '-'}</dd></div>
        </dl>
        <p className="mt-4 text-xs opacity-80">
          Server time {status ? new Date(status.timestamp).toLocaleTimeString() : '-'} · last checked {last ? new Date(last.t).toLocaleTimeString() : '-'}
        </p>
      </section>

      <div className="card mt-3 divide-y divide-black/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3 text-sm font-bold">
            {busy ? <Spinner className="text-brand-600" /> : <Icon name="clock" size={19} className="text-ink-soft" />}
            <span aria-live="polite">{busy ? 'Checking now…' : auto ? `Next check in ${clock(left)}` : 'Auto-refresh is off'}</span>
          </div>
          <button className="btn-secondary !min-h-10 !px-3.5" onClick={() => void check()} disabled={busy}><Icon name="refresh" size={17} /> Check now</button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          onClick={toggle}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
        >
          <span>
            <span className="block text-sm font-bold">Auto-refresh</span>
            <span className="block text-xs text-ink-soft">Check again every 3 minutes, even in a background tab, while this page stays open. Off by default.</span>
          </span>
          <span className={cx('relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 ease-out', auto ? 'border-brand-700 bg-brand-600' : 'border-black/15 bg-stone-300')} aria-hidden="true">
            <span className={cx('absolute top-0.5 left-0.5 h-6.5 w-6.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out', auto && 'translate-x-6')} />
          </span>
        </button>
      </div>

      <section className="card mt-4 overflow-hidden">
        <h2 className="border-b border-black/10 px-4 py-3 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">Components</h2>
        <ul className="divide-y divide-black/10">
          <Row icon="pulse" label="API" state={last === null ? 'unknown' : down ? 'down' : 'up'} />
          <Row icon="folders" label="Case database" state={dep(health?.checks.database)} />
          <Row icon="clock" label="Cache" state={dep(health?.checks.redis)} />
          <Row icon="image" label="Photo storage" state={dep(health?.checks.media)} />
        </ul>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-3 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">Recent checks (this visit)</h2>
        <div className="flex h-16 items-end gap-1" role="img" aria-label="Response time of recent checks">
          {history.length === 0 && <p className="text-sm text-ink-soft">Waiting for the first result…</p>}
          {history.map((c) => (
            <span key={c.t} title={`${new Date(c.t).toLocaleTimeString()} · ${c.ok ? `${c.ms} ms` : 'failed'}`} className={cx('flex-1 rounded-sm', c.ok ? (c.ms > 4000 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-red-500')} style={{ height: `${c.ok ? Math.max(12, (c.ms / max) * 100) : 100}%` }} />
          ))}
        </div>
      </section>
    </div>
  );
}
