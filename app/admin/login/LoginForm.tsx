'use client';

import { useSearchParams } from 'next/navigation';
import { loginAction } from './actions';

export default function LoginForm() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-luxe-bg">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</h1>
          <p className="text-luxe-muted text-xs tracking-widest uppercase">Admin Access</p>
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="text-luxe-muted text-xs tracking-widest uppercase">
              Password
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
            <p className="text-red-400 text-xs tracking-wider">Incorrect password.</p>
          )}

          <button
            type="submit"
            className="w-full bg-luxe-cream text-luxe-bg py-3 text-sm tracking-widest uppercase hover:bg-luxe-accent transition-colors duration-200"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
