import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import si from './i18n/si';
import ta from './i18n/ta';

/**
 * English / Sinhala / Tamil. The English sentence IS the key: `t('Add statement')`. A missing translation simply shows the
 * English text, so nothing can ever render blank. Placeholders look like `{n}`.
 */
export type Lang = 'en' | 'si' | 'ta';

export const LANGS: { code: Lang; native: string; english: string; short: string }[] = [
  { code: 'en', native: 'English', english: 'English', short: 'EN' },
  { code: 'si', native: 'සිංහල', english: 'Sinhala', short: 'සිං' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', short: 'த' },
];

const KEY = 'app:lang';
const DICT: Record<Lang, Record<string, string>> = { en: {}, si, ta };

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'si' || saved === 'ta') return saved;
  } catch {
    /* storage blocked */
  }
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return n.startsWith('si') ? 'si' : n.startsWith('ta') ? 'ta' : 'en';
}

let current: Lang = detect();
export const currentLang = (): Lang => current;

export type Vars = Record<string, string | number>;

export function translate(text: string, vars?: Vars, lang: Lang = current): string {
  let s = DICT[lang][text] ?? text;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

/** For code outside React components (it uses the active language). */
export const t = (text: string, vars?: Vars): string => translate(text, vars);

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (text: string, vars?: Vars) => string;
}
const Ctx = createContext<I18n>({ lang: current, setLang: () => undefined, t: translate });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const setLang = useCallback((l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18n>(() => ({ lang, setLang, t: (text, vars) => translate(text, vars, lang) }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = (): I18n => useContext(Ctx);
export const useT = (): I18n['t'] => useContext(Ctx).t;

/** Locale tag for dates and relative times. */
export const localeOf = (lang: Lang = current): string => (lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB');
