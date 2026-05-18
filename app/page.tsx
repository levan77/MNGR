import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { getSalons } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let salons: { id: string; slug: string; name: string; city: string; address: string }[] = [];
  try {
    salons = await getSalons();
  } catch {
    salons = [];
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <span className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</span>
        <Link
          href="/admin"
          className="text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
        >
          Admin
        </Link>
      </header>

      <section className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <div className="text-center space-y-3 mb-12">
          <p className="text-luxe-muted tracking-[0.3em] uppercase text-xs">Welcome to</p>
          <h1 className="text-5xl md:text-7xl font-display font-normal tracking-widest text-luxe-cream">
            ATELIER
          </h1>
          <p className="text-luxe-muted text-sm tracking-wider">Choose your location to book</p>
        </div>

        {salons.length === 0 ? (
          <div className="text-center py-12 border border-luxe-border">
            <p className="text-luxe-muted text-sm">No salons available yet.</p>
            <Link href="/admin" className="text-luxe-cream text-xs tracking-widest uppercase mt-3 inline-block hover:text-luxe-accent transition-colors">
              Admin login →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {salons.map(s => (
              <Link
                key={s.id}
                href={`/${s.slug}`}
                className="flex items-center justify-between p-5 border border-luxe-border hover:border-luxe-cream transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <MapPin size={18} className="text-luxe-muted group-hover:text-luxe-cream mt-0.5 shrink-0 transition-colors" />
                  <div>
                    <p className="text-luxe-cream font-medium tracking-wide">{s.name}</p>
                    {(s.address || s.city) && (
                      <p className="text-luxe-muted text-sm mt-0.5">{s.address || s.city}</p>
                    )}
                  </div>
                </div>
                <ArrowRight size={16} className="text-luxe-muted group-hover:text-luxe-cream transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
