import { getSession } from '@/lib/session';
import AdminDashboard from '@/components/admin/AdminDashboard';
import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';

export default async function AdminPage() {
  const session = await getSession();
  if (session?.role === 'super_admin') return <SuperAdminDashboard />;
  if (session?.role === 'salon_admin') return <AdminDashboard departmentId={session.salon_id} />;
  return null;
}
