import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getStaffProfile, getStaffBookings } from '@/app/admin/actions';
import ProDashboard from '@/components/pro/ProDashboard';
import { localDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ProPage() {
  const session = await getSession();
  if (!session || session.role !== 'professional') redirect('/admin/login');

  const { staff_id, department_id } = session;

  const [profile, todayBookings] = await Promise.all([
    getStaffProfile(staff_id, department_id).catch(() => null),
    getStaffBookings(staff_id, department_id, localDateString(), localDateString()).catch(() => []),
  ]);

  if (!profile) redirect('/admin/login');

  return (
    <ProDashboard
      profile={profile}
      todayBookings={todayBookings}
      staffId={staff_id}
      departmentId={department_id}
    />
  );
}
