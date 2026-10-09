import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { usePwa } from '../components/Pwa';
import { ConfirmDialog, Dialog, ErrorState, Skeleton, Spinner, useToast } from '../components/ui';
import { api, ApiError, deviceStore } from '../lib/api';
import { useT } from '../lib/i18n';
import { disablePush, enablePush, permission, pushSupported } from '../lib/notify';
import type { DeviceStatus, FollowedCase, NotifPrefs } from '../lib/types';
import { cx, usePageMeta } from '../lib/util';

function Switch({ label, hint, on, disabled, onChange }: { label: string; hint: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left disabled:opacity-60">
      <span>
        <span className="block text-sm font-bold">{t(label)}</span>
        <span className="block text-xs text-ink-soft">{t(hint)}</span>
      </span>
      <span className={cx('relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 ease-out', on ? 'border-brand-700 bg-brand-600' : 'border-black/15 bg-stone-300')} aria-hidden="true">
        <span className={cx('absolute top-0.5 left-0.5 h-6.5 w-6.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out', on && 'translate-x-6')} />
      </span>
    </button>
  );
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  const t = useT();
  return (
    <section className="card mt-4 overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-black/10 px-4 py-3 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase"><Icon name={icon} size={15} /> {t(title)}</h2>
      {children}
    </section>
  );
}

const steps = 'list-decimal space-y-1.5 pl-5 text-sm text-ink-soft';

/** Push on/off, categories, followed cases and platform guidance. Browser permission is requested only after an explicit tap. */
export default function NotificationSettings() {
  usePageMeta({ title: 'Notification settings', noindex: true });
  const t = useT();
  const toast = useToast();
  const { isIOS, standalone, installable, install, setShowIOSHelp } = usePwa();
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [follows, setFollows] = useState<FollowedCase[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState(false);
  const [forget, setForget] = useState(false);
  const [perm, setPerm] = useState(permission());

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, f] = await Promise.all([api.deviceMe(), api.follows().catch(() => [] as FollowedCase[])]);
      setStatus(s);
      setFollows(f);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const supported = pushSupported();
  const needsInstall = isIOS && !standalone; // iPhone / iPad: Web Push only works from the Home Screen app (iOS 16.4+)
  const subscribed = status?.push.subscribed === true && perm === 'granted';

  const turnOn = async () => {
    setExplain(false);
    setBusy(true);
    const r = await enablePush();
    setPerm(permission());
    setBusy(false);
    if (r === 'ok') {
      toast('success', t('Push notifications are on for this device.'));
      await load();
    } else if (r === 'denied') toast('error', t('Notifications are blocked. You can allow them in your browser’s site settings.'));
    else if (r === 'dismissed') toast('info', t('No problem — you can turn them on later. Everything still appears in your notification centre.'));
    else if (r === 'no-service-worker') toast('error', t('Push needs the installed or published app. Open the live site and try again.'));
    else if (r === 'unavailable') toast('error', t('Push notifications are not available on the server right now.'));
    else toast('error', t('Could not turn on push notifications. Please try again.'));
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    toast('success', t('Push notifications are off. You can still read everything in the app.'));
    await load();
  };

  const setPref = async (patch: Partial<NotifPrefs>) => {
    if (!status) return;
    const prev = status;
    setStatus({ ...status, prefs: { ...status.prefs, ...patch } });
    try {
      await api.setPrefs(patch);
    } catch (e) {
      setStatus(prev);
      toast('error', (e as ApiError).message);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await api.testPush();
      toast(r.sent ? 'success' : 'error', r.sent ? t('Test notification sent — it should appear in a moment.') : t('Could not send a test. Try turning push off and on again.'));
    } catch (e) {
      toast('error', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const unfollow = async (c: FollowedCase) => {
    setFollows((x) => x.filter((i) => i.id !== c.id));
    try {
      await api.unfollow(c.id);
    } catch (e) {
      toast('error', (e as ApiError).message);
      void load();
    }
  };

  const forgetAll = async () => {
    setBusy(true);
    await disablePush();
    await api.forgetDevice();
    deviceStore.clear();
    setForget(false);
    setBusy(false);
    toast('success', t('Notification data was deleted from this device and our server.'));
    await load();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/notifications" className="chrome mb-3 hidden items-center gap-1 py-1 text-sm font-bold text-ink-soft lg:inline-flex"><Icon name="chevronLeft" size={18} /> {t('Notifications')}</Link>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('Notification settings')}</h1>
      <p className="mt-1.5 text-sm text-ink-soft">{t('Choose what you hear about. No account is needed — settings belong to this browser only.')}</p>

      {error ? (
        <div className="mt-6"><ErrorState message={error.message} onRetry={load} /></div>
      ) : !status ? (
        <div className="mt-6 space-y-4"><Skeleton className="h-40 w-full !rounded-2xl" /><Skeleton className="h-48 w-full !rounded-2xl" /></div>
      ) : (
        <>
          <Card icon="bell" title="Phone & browser alerts">
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className={cx('h-2.5 w-2.5 rounded-full', subscribed ? 'bg-emerald-500' : perm === 'denied' ? 'bg-red-500' : 'bg-stone-400')} aria-hidden="true" />
                {subscribed ? t('On for this device') : perm === 'denied' ? t('Blocked in this browser') : t('Off')}
              </p>

              {needsInstall ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <p className="font-bold">{t('Install Detective Lanka first')}</p>
                  <p className="mt-1">{t('On iPhone and iPad, alerts only work from the app on your Home Screen (iOS 16.4 or newer).')}</p>
                  <ol className={cx(steps, '!text-amber-900 mt-2')}>
                    <li>{t('Open this site in')} <strong>Safari</strong>.</li>
                    <li>{t('Tap the')} <strong>{t('Share')}</strong> {t('button, then')} <strong>{t('Add to Home Screen')}</strong>.</li>
                    <li>{t('Open Detective Lanka from your Home Screen and come back to this page.')}</li>
                  </ol>
                  <button className="btn-secondary mt-3" onClick={() => setShowIOSHelp(true)}><Icon name="download" size={17} /> {t('Show me how')}</button>
                </div>
              ) : !supported ? (
                <p className="rounded-xl bg-black/5 p-3.5 text-sm text-ink-soft">{t('This browser can’t receive push notifications')}{isIOS ? ` ${t('(iOS 16.4 or newer is required)')}` : ''}. {t('You will still see everything in your notification centre.')}</p>
              ) : perm === 'denied' ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
                  <p className="font-bold">{t('Notifications are blocked')}</p>
                  <p className="mt-1">{t('Detective Lanka will not ask again. To allow alerts, open your browser’s site settings for this page (the lock or tune icon next to the address, or the app’s settings on your phone) and set Notifications to Allow, then reload.')}</p>
                </div>
              ) : subscribed ? (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={test} disabled={busy}>{busy ? <Spinner /> : <Icon name="bell" size={17} />} {t('Send a test')}</button>
                  <button className="btn-ghost !text-red-600" onClick={turnOff} disabled={busy}>{t('Turn off')}</button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">{t('Get an alert on this device for the categories you choose below, even when the app is closed.')}</p>
                  <button className="btn-primary" onClick={() => setExplain(true)} disabled={busy || !status.push.available}>{busy ? <Spinner /> : <Icon name="bell" size={18} />} {t('Turn on push notifications')}</button>
                  {!status.push.available && <p className="text-xs text-ink-soft">{t('Push is not switched on for this service yet. The notification centre works as normal.')}</p>}
                </>
              )}

              {!standalone && !isIOS && installable && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-folder/50 p-3 text-sm">
                  <span className="text-[#7a5a14]">{t('Alerts are most reliable when Detective Lanka is installed.')}</span>
                  <button className="btn-secondary !min-h-10 shrink-0 !px-3.5" onClick={install}><Icon name="download" size={16} /> {t('Install')}</button>
                </div>
              )}
            </div>
          </Card>

          <Card icon="sliders" title="What to notify me about">
            <div className="divide-y divide-black/10">
              <Switch label="New case files" hint="When a moderator publishes a case" on={status.prefs.newCases} onChange={(v) => setPref({ newCases: v })} />
              <Switch label="Statements on cases I follow" hint="Only for cases you follow" on={status.prefs.statements} onChange={(v) => setPref({ statements: v })} />
              <Switch label="Announcements" hint="Updates from the moderators" on={status.prefs.announcements} onChange={(v) => setPref({ announcements: v })} />
            </div>
            <p className="border-t border-black/10 px-4 py-3 text-xs text-ink-soft">{t('These choices apply to the notification centre and to push alerts.')}</p>
          </Card>

          <Card icon="folders" title="Cases I follow">
            {follows.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">{t('You are not following any case. Open a case file and tap')} <strong>{t('Follow this case')}</strong>.</p>
            ) : (
              <ul className="divide-y divide-black/10">
                {follows.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Link to={`/case/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-bold">{c.title}</Link>
                    <button className="btn-ghost !min-h-9 !px-3 !text-xs" onClick={() => unfollow(c)}>{t('Unfollow')}</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card icon="shieldCheck" title="Privacy">
            <div className="space-y-3 p-4 text-sm text-ink-soft">
              <p>{t('There are no accounts. This browser gets a random code (stored here, and only a one-way fingerprint of it on our server) so we can remember your choices and followed cases.')}</p>
              <p>{t('Phone alerts use your browser’s push service (Google, Apple or Mozilla, depending on your device). To deliver them we keep that service’s address and encryption keys for this device — nothing else — and alerts contain only a case title, a short excerpt and a link. Those services, your network and our hosts may still see technical connection details; this is not protection from them.')}</p>
              <button className="btn-ghost !px-0 !text-red-600" onClick={() => setForget(true)}><Icon name="trash" size={16} /> {t('Delete my notification data')}</button>
            </div>
          </Card>
        </>
      )}

      <Dialog open={explain} onClose={() => setExplain(false)} title={t('Turn on push notifications?')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">{t('Your browser will ask for permission next. We ask so Detective Lanka can alert you about the categories you choose — new case files, announcements and statements on cases you follow — even when the app is closed.')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>{t('No account, name or phone number is involved.')}</li>
            <li>{t('You can turn alerts off here at any time.')}</li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setExplain(false)}>{t('Not now')}</button>
            <button className="btn-primary" onClick={turnOn}>{t('Continue')}</button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog open={forget} title={t('Delete notification data?')} message={t('This removes your settings, followed cases, read marks and any push registration for this browser — here and on our server.')} confirmLabel={t('Delete')} danger busy={busy} onConfirm={forgetAll} onClose={() => setForget(false)} />
    </div>
  );
}
