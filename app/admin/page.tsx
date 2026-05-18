import { getSession } from '@/lib/session';
import AdminDashboard from '@/components/admin/AdminDashboard';
import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';
import { getSalonBranches } from '@/app/admin/actions';

export default async function AdminPage() {
  const session = await getSession();
  if (session?.role === 'super_admin') return <SuperAdminDashboard />;
  if (session?.role === 'salon_admin') {
    // Fetch branches — gracefully fall back if migration hasn't run yet
    const branches = await getSalonBranches(session.salon_id).catch(() => []);
    const initialBranchId = branches[0]?.id ?? session.salon_id;
    return <AdminDashboard salonId={session.salon_id} initialBranchId={initialBranchId} initialBranches={branches} />;
  }
  return null;
}
