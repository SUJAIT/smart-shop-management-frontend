'use client';
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from './utils';
import { setLangValue, type Lang } from './lang';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangCtx);

/**
 * Reads the saved language (or the browser's) once, then re-creates the screen when it changes.
 * Nothing is drawn before that, so the server and the browser never disagree on the text.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState<Lang>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('lang'); } catch { /* private mode */ }
    const first: Lang = saved === 'bn' || saved === 'en' ? saved : 'bn'; // Bangla unless the user chose English
    setLangValue(first);
    document.documentElement.lang = first;
    setL(first);
    setReady(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangValue(l);
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
    document.documentElement.lang = l;
    setL(l);
  }, []);

  if (!ready) return null;
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangCtx.Provider>
  );
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const opt = (l: Lang, label: string, name: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={name}
      className={cn('rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors', lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language" className={cn('inline-flex rounded-lg border bg-card p-0.5', className)}>
      {opt('bn', 'বাংলা', 'বাংলা')}
      {opt('en', 'EN', 'English')}
    </div>
  );
}
