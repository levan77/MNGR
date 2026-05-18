'use client';

import { useSearchParams } from 'next/navigation';
import { loginAction } from './actions';
import { useLanguage } from '@/lib/LanguageContext';
import { Globe } from 'lucide-react';

export default function LoginForm() {
  const error = useSearchParams().get('error');
  const { t, toggleLang, lang } = useLanguage();

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-luxe-bg">
      <div className="w-full max-w-sm space-y-8">

        {/* Language toggle */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
          >
            <Globe size={13} />
            {lang === 'ka' ? 'EN' : 'KA'}
          </button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</h1>
          <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('admin_access')}</p>
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="text-luxe-muted text-xs tracking-widest uppercase">
              {t('username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream px-4 py-3 text-sm focus:outline-none focus:border-luxe-cream transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-luxe-muted text-xs tracking-widest uppercase">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream px-4 py-3 text-sm focus:outline-none focus:border-luxe-cream transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs tracking-wider">{t('invalid_credentials')}</p>
          )}

          <button
            type="submit"
            className="w-full bg-luxe-cream text-luxe-bg py-3 text-sm tracking-widest uppercase hover:bg-luxe-accent transition-colors duration-200"
          >
            {t('enter')}
          </button>
        </form>
      </div>
    </main>
  );
}
