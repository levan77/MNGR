import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import '@/styles/globals.css';
import { LanguageProvider } from '@/lib/LanguageContext';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ATELIER — Luxury Beauty Salon',
  description: 'Book your appointment at ATELIER, luxury beauty salons in Tbilisi, Batumi & Kutaisi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={manrope.variable}>
      <body className="bg-luxe-bg text-luxe-cream font-sans antialiased">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
