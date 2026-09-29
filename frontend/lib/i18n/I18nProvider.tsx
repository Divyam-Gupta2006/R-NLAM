'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Dict, Lang, LANGS, translate } from './citizen';

const KEY = 'rnlam.lang';
type Paise = number | string | bigint;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof Dict | string, vars?: Record<string, string | number>) => string;
  /** 12 March 2026, in the chosen language (IST). */
  date: (iso: string | Date | null | undefined) => string;
  dateTime: (iso: string | Date | null | undefined) => string;
  /** ₹12,34,567 from paise, Indian grouping, Latin digits. */
  money: (paise: Paise) => string;
  number: (n: number, digits?: number) => string;
}

const Ctx = createContext<I18n | null>(null);

// Latin digits in every language, so amounts read the same as survey numbers, phone numbers and OTPs.
const locale = (l: Lang) => `${l}-IN-u-nu-latn`;

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((x) => x.code === saved)) return saved;
    const nav = navigator.language.slice(0, 2);
    if (nav === 'hi' || nav === 'mr') return nav;
  } catch {
    /* no storage */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => setLangState(initialLang()), []);
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const d = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const dt = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const inr = new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key as string, vars),
      date: (iso) => (iso ? d.format(new Date(iso)) : '—'),
      dateTime: (iso) => (iso ? dt.format(new Date(iso)) : '—'),
      money: (paise) => inr.format(Math.round(Number(paise) / 100)),
      number: (n, digits = 0) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** EN | हिन्दी | मराठी, large enough to tap. */
export function LanguageSwitcher({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('language')} className={`inline-flex overflow-hidden rounded-lg border ${tone === 'dark' ? 'border-white/40' : 'border-line'} ${className ?? ''}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`min-h-[40px] px-3 text-sm font-semibold ${
            lang === l.code ? (tone === 'dark' ? 'bg-white text-navy' : 'bg-navy text-white') : tone === 'dark' ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-surface'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
