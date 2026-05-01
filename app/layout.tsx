import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import '@/styles/globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ATELIER — Luxury Beauty Salon',
  description: 'Book your appointment at ATELIER, luxury beauty salons in Tbilisi, Batumi & Kutaisi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="bg-luxe-bg text-luxe-cream font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
