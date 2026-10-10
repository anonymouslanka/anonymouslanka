import { useT } from '../lib/i18n';
import { Icon } from './Icon';

/** Short, friendly advice shown wherever someone is about to post. */
export function PrivacyTip({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <p className={`flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 ${className}`}>
      <Icon name="shieldCheck" size={18} className="mt-px shrink-0" />
      <span>{t('For more privacy, post from a VPN, in a private (incognito) tab, or on public Wi-Fi or a shared device if you can. Leave out names and details only you would know.')}</span>
    </p>
  );
}
