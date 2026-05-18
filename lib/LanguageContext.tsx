'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type Lang, type TranslationKey,
  translate, loadLang, saveLang, loadOverrides, saveOverrides,
} from './i18n';

// ─── Context Shape ────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  overrides: Partial<Record<TranslationKey, string>>;
  setOverride: (key: TranslationKey, value: string) => void;
  resetOverrides: () => void;
  persistOverrides: (overrides: Partial<Record<TranslationKey, string>>) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang,      setLangState]      = useState<Lang>('ka');   // SSR-safe default
  const [overrides, setOverridesState] = useState<Partial<Record<TranslationKey, string>>>({});

  // Hydrate from localStorage after mount
  useEffect(() => {
    setLangState(loadLang());
    setOverridesState(loadOverrides());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(l);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next = prev === 'ka' ? 'en' : 'ka';
      saveLang(next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(lang, key, overrides),
    [lang, overrides],
  );

  const setOverride = useCallback((key: TranslationKey, value: string) => {
    setOverridesState(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    setOverridesState({});
    saveOverrides({});
  }, []);

  const persistOverrides = useCallback((newOverrides: Partial<Record<TranslationKey, string>>) => {
    setOverridesState(newOverrides);
    saveOverrides(newOverrides);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, overrides, setOverride, resetOverrides, persistOverrides }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
