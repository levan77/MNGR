import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center space-y-3">
        <p className="text-luxe-muted tracking-[0.3em] uppercase text-xs">Welcome to</p>
        <h1 className="text-5xl md:text-7xl font-display font-normal tracking-widest text-luxe-cream">
          ATELIER
        </h1>
        <p className="text-luxe-muted text-sm tracking-wider">
          Luxury Beauty · Tbilisi · Batumi · Kutaisi
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Link
          href="/booking"
          className="px-10 py-4 bg-luxe-cream text-luxe-bg text-sm tracking-widest uppercase hover:bg-luxe-accent transition-colors duration-200"
        >
          Book Appointment
        </Link>
        <Link
          href="/admin"
          className="px-10 py-4 border border-luxe-border text-luxe-muted text-sm tracking-widest uppercase hover:border-luxe-cream hover:text-luxe-cream transition-colors duration-200"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}
