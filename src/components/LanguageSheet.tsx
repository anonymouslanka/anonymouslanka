import { LANGS, useI18n } from '../lib/i18n';
import { cx } from '../lib/util';
import { Icon } from './Icon';
import { Dialog } from './ui';

/** Language picker: English, සිංහල, தமிழ். */
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t('Language')}>
      <div role="radiogroup" aria-label={t('Language')} className="-mx-1 space-y-1.5">
        {LANGS.map((l) => (
          <button
            key={l.code}
            role="radio"
            aria-checked={lang === l.code}
            lang={l.code}
            onClick={() => {
              setLang(l.code);
              onClose();
            }}
            className={cx('flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left', lang === l.code ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-black/10 bg-white')}
          >
            <span>
              <span className="block text-lg font-bold">{l.native}</span>
              <span className="block text-xs text-ink-soft">{l.english}</span>
            </span>
            {lang === l.code && <Icon name="check" size={22} strokeWidth={2.8} />}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
