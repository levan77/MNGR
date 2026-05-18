import { notFound } from 'next/navigation';
import { getSalonBySlug, getBranchBySlug, getSalonBranches } from '@/app/admin/actions';
import ClientBooking from '@/components/booking/ClientBooking';
import BranchSelector from '@/components/booking/BranchSelector';

export const dynamic = 'force-dynamic';

export default async function SalonBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // ── 1. Salon slug takes priority (main entry point for that brand) ──────────
  const salon = await getSalonBySlug(slug).catch(() => null);
  if (salon) {
    const branches = await getSalonBranches(salon.id).catch(() => []);

    // Filter out the "primary" auto-seeded branch (id === salon.id) from the picker
    // so only real additional branches are listed alongside the flagship
    const additionalBranches = branches.filter(b => b.id !== salon.id);
    const primaryBranch = branches.find(b => b.id === salon.id) ?? null;

    if (additionalBranches.length > 0) {
      // Show picker: flagship + all additional branches
      const allBranches = [
        // Flagship first (use salon data)
        {
          id: salon.id,
          salon_id: salon.id,
          name: primaryBranch?.name ?? salon.name,
          slug: salon.slug,
          city: primaryBranch?.city ?? salon.city ?? null,
          address: primaryBranch?.address ?? salon.address ?? null,
          phone: primaryBranch?.phone ?? null,
          created_at: primaryBranch?.created_at ?? '',
        },
        ...additionalBranches,
      ];
      return <BranchSelector salonName={salon.name} branches={allBranches} />;
    }

    // Single branch or no branches → book directly (use primary branch id if exists)
    const deptId = primaryBranch?.id ?? salon.id;
    return (
      <ClientBooking
        salon={{
          id: deptId,
          slug: salon.slug,
          name: salon.name,
          city: salon.city,
          address: salon.address,
        }}
      />
    );
  }

  // ── 2. Branch-specific slug (direct link to a non-flagship branch) ──────────
  const branch = await getBranchBySlug(slug).catch(() => null);
  if (branch) {
    return (
      <ClientBooking
        salon={{
          id: branch.id,
          slug: branch.slug,
          name: branch.name,
          city: branch.city ?? '',
          address: branch.address ?? '',
        }}
      />
    );
  }

  notFound();
}
