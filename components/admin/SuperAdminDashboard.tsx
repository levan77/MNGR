'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronRight, LogOut, ArrowLeft } from 'lucide-react';
import { DEPARTMENTS } from '@/lib/data';
import { logoutAction } from '@/app/admin/login/actions';
import { getAllBookings, getServices, type DBBooking, type DBService } from '@/app/admin/actions';
import AdminDashboard from './AdminDashboard';

export default function SuperAdminDashboard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [servicesByDept, setServicesByDept] = useState<Record<string, DBService[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getAllBookings(),
      Promise.all(DEPARTMENTS.map(d => getServices(d.id).then(s => [d.id, s] as const))),
    ]).then(([allBks, perDept]) => {
      if (cancelled) return;
      setBookings(allBks);
      setServicesByDept(Object.fromEntries(perDept));
    }).catch(e => {
      console.error('Super admin data load failed', e);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const selectedDept = selectedId ? DEPARTMENTS.find(d => d.id === selectedId) : null;

  function priceOf(svc: DBService[] | undefined, serviceId: string): number {
    return svc?.find(s => s.id === serviceId)?.price ?? 0;
  }

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <div className="flex items-center gap-4">
          <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
          {selectedDept && (
            <>
              <span className="text-luxe-border text-lg">/</span>
              <button
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
              >
                <ArrowLeft size={12} /> All Salons
              </button>
              <span className="text-luxe-border text-lg">/</span>
              <span className="text-luxe-cream text-xs tracking-wider">{selectedDept.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-luxe-muted text-xs tracking-widest uppercase hidden sm:block">Master Admin</span>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors">
              <LogOut size={14} /> Logout
            </button>
          </form>
        </div>
      </header>

      {selectedId ? (
        <AdminDashboard departmentId={selectedId} showHeader={false} />
      ) : (
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-8">
          <div>
            <p className="text-luxe-muted text-xs tracking-widest uppercase mb-1">Network Overview</p>
            <h2 className="text-2xl font-display text-luxe-cream tracking-wider">All Locations</h2>
          </div>

          {loading ? (
            <p className="text-luxe-muted text-sm text-center py-12">Loading network data…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Locations', value: DEPARTMENTS.length },
                  { label: 'Scheduled', value: bookings.filter(b => b.status === 'scheduled').length },
                  {
                    label: 'Network Revenue',
                    value: `₾${bookings
                      .filter(b => b.status === 'completed')
                      .reduce((sum, b) => sum + priceOf(servicesByDept[b.department_id], b.service_id), 0)}`,
                  },
                ].map(stat => (
                  <div key={stat.label} className="border border-luxe-border p-4 text-center">
                    <p className="text-2xl font-display text-luxe-cream">{stat.value}</p>
                    <p className="text-luxe-muted text-xs tracking-wider uppercase mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {DEPARTMENTS.map(dept => {
                  const deptBks = bookings.filter(b => b.department_id === dept.id);
                  const scheduled = deptBks.filter(b => b.status === 'scheduled').length;
                  const revenue = deptBks
                    .filter(b => b.status === 'completed')
                    .reduce((sum, b) => sum + priceOf(servicesByDept[dept.id], b.service_id), 0);

                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSelectedId(dept.id)}
                      className="w-full flex items-center justify-between p-5 border border-luxe-border hover:border-luxe-cream transition-colors group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <Building2 size={18} className="text-luxe-muted group-hover:text-luxe-cream transition-colors shrink-0" />
                        <div>
                          <p className="text-luxe-cream text-sm">{dept.name}</p>
                          <p className="text-luxe-muted text-xs mt-0.5">{dept.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-luxe-cream text-sm">{scheduled}</p>
                          <p className="text-luxe-muted text-xs">Scheduled</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-luxe-accent text-sm">₾{revenue}</p>
                          <p className="text-luxe-muted text-xs">Revenue</p>
                        </div>
                        <ChevronRight size={16} className="text-luxe-muted group-hover:text-luxe-cream transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
