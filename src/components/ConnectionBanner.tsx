import { useEffect, useState } from 'react';
import { subscribeSlow } from '../lib/api';
import { useT } from '../lib/i18n';
import { Icon } from './Icon';
import { Spinner } from './ui';

/**
 * The API runs on a free host that sleeps when idle; the first request can take up to a minute.
 * If any request is still pending after a few seconds we say so instead of looking frozen.
 */
export function ConnectionBanner() {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => subscribeSlow(setSlow), []);
  if (!slow) return null;
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-semibold text-amber-900">
      <span className="inline-flex items-center gap-2">
        <Spinner className="h-3.5 w-3.5" /> <Icon name="clock" size={14} /> {t('Waking up the server — the first load can take up to a minute. Hang tight.')}
      </span>
    </div>
  );
}
