import { notFound } from 'next/navigation';
import { getSalonBySlug } from '@/app/admin/actions';
import ClientBooking from '@/components/booking/ClientBooking';

export const dynamic = 'force-dynamic';

export default async function SalonBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const salon = await getSalonBySlug(slug);
  if (!salon) notFound();

  return (
    <ClientBooking
      salon={{
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        city: salon.city,
        address: salon.address,
      }}
    />
  );
}
