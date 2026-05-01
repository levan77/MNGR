import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        luxe: {
          bg: '#14110d',
          surface: '#1c1915',
          border: '#2e2a24',
          cream: '#f5efe6',
          muted: '#9a9080',
          accent: '#c9a96e',
        },
      },
      fontFamily: {
        display: ['var(--font-bodoni)', 'Georgia', 'serif'],
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
