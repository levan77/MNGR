'use client';

import { useEffect, useState, useTransition } from 'react';
import { Building2, ChevronRight, LogOut, ArrowLeft, Plus, Trash2, Pencil, Save, X, ExternalLink } from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import {
  getSalons, createSalon, updateSalon, deleteSalon,
  getAllBookings, getServices,
  type DBSalon, type DBBooking, type DBService,
} from '@/app/admin/actions';
import AdminDashboard from './AdminDashboard';

type EditForm = {
  name: string;
  slug: string;
  city: string;
  address: string;
  adminUsername: string;
  adminPassword: string;
};

const EMPTY_FORM: EditForm = {
  name: '', slug: '', city: '', address: '', adminUsername: '', adminPassword: '',
};

export default function SuperAdminDashboard() {
  const [view, setView] = useState<'overview' | 'salons'>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [salons, setSalons] = useState<DBSalon[]>([]);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [servicesByDept, setServicesByDept] = useState<Record<string, DBService[]>>({});
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const fresh = await getSalons();
      setSalons(fresh);
      const [allBks, perDept] = await Promise.all([
        getAllBookings(),
        Promise.all(fresh.map(s => getServices(s.id).then(svc => [s.id, svc] as const))),
      ]);
      setBookings(allBks);
      setServicesByDept(Object.fromEntries(perDept));
    } catch (e) {
      console.error('Super admin load failed', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const selectedSalon = selectedId ? salons.find(s => s.id === selectedId) ?? null : null;

  function priceOf(svc: DBService[] | undefined, serviceId: string): number {
    return svc?.find(s => s.id === serviceId)?.price ?? 0;
  }

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <div className="flex items-center gap-4">
          <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
          {selectedSalon && (
            <>
              <span className="text-luxe-border text-lg">/</span>
              <button
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
              >
                <ArrowLeft size={12} /> All Salons
              </button>
              <span className="text-luxe-border text-lg">/</span>
              <span className="text-luxe-cream text-xs tracking-wider">{selectedSalon.name}</span>
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
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Section nav */}
          <nav className="flex gap-1 border-b border-luxe-border">
            {(['overview', 'salons'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-3 text-xs tracking-wider uppercase border-b-2 transition-colors ${
                  view === v ? 'border-luxe-cream text-luxe-cream' : 'border-transparent text-luxe-muted hover:text-luxe-cream'
                }`}
              >
                {v === 'overview' ? 'Overview' : 'Manage Salons'}
              </button>
            ))}
          </nav>

          {loading ? (
            <p className="text-luxe-muted text-sm text-center py-12">Loading…</p>
          ) : view === 'overview' ? (
            <OverviewView
              salons={salons}
              bookings={bookings}
              servicesByDept={servicesByDept}
              onOpen={setSelectedId}
              priceOf={priceOf}
            />
          ) : (
            <SalonsView salons={salons} onChange={reload} />
          )}
        </main>
      )}
    </div>
  );
}

// ─── Overview View ────────────────────────────────────────────────────────────
function OverviewView({
  salons, bookings, servicesByDept, onOpen, priceOf,
}: {
  salons: DBSalon[];
  bookings: DBBooking[];
  servicesByDept: Record<string, DBService[]>;
  onOpen: (id: string) => void;
  priceOf: (svc: DBService[] | undefined, serviceId: string) => number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-luxe-muted text-xs tracking-widest uppercase mb-1">Network Overview</p>
        <h2 className="text-2xl font-display text-luxe-cream tracking-wider">All Locations</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Locations', value: salons.length },
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

      {salons.length === 0 ? (
        <div className="border border-luxe-border p-8 text-center">
          <p className="text-luxe-muted text-sm">No salons yet.</p>
          <p className="text-luxe-muted text-xs mt-2">Switch to <span className="text-luxe-cream">Manage Salons</span> to add your first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {salons.map(s => {
            const sBks = bookings.filter(b => b.department_id === s.id);
            const scheduled = sBks.filter(b => b.status === 'scheduled').length;
            const revenue = sBks
              .filter(b => b.status === 'completed')
              .reduce((sum, b) => sum + priceOf(servicesByDept[s.id], b.service_id), 0);

            return (
              <button
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="w-full flex items-center justify-between p-5 border border-luxe-border hover:border-luxe-cream transition-colors group text-left"
              >
                <div className="flex items-center gap-4">
                  <Building2 size={18} className="text-luxe-muted group-hover:text-luxe-cream transition-colors shrink-0" />
                  <div>
                    <p className="text-luxe-cream text-sm">{s.name}</p>
                    <p className="text-luxe-muted text-xs mt-0.5">/{s.slug}{s.city ? ` · ${s.city}` : ''}</p>
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
      )}
    </div>
  );
}

// ─── Salons Management View ──────────────────────────────────────────────────
function SalonsView({ salons, onChange }: { salons: DBSalon[]; onChange: () => void | Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(s: DBSalon) {
    setForm({
      name: s.name, slug: s.slug, city: s.city, address: s.address,
      adminUsername: s.admin_username, adminPassword: '',
    });
    setError(null);
    setEditingId(s.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        if (adding) {
          const result = await createSalon({
            name: form.name,
            slug: form.slug || undefined,
            city: form.city,
            address: form.address,
            adminUsername: form.adminUsername,
            adminPassword: form.adminPassword,
          });
          if (!result.ok) { setError(result.error); return; }
        } else if (editingId) {
          const result = await updateSalon(editingId, {
            name: form.name,
            slug: form.slug,
            city: form.city,
            address: form.address,
            adminUsername: form.adminUsername,
            adminPassword: form.adminPassword || undefined,
          });
          if (!result.ok) { setError(result.error); return; }
        }
        await onChange();
        cancel();
      } catch (e) {
        setError(String(e));
      }
    });
  }

  function handleDelete(s: DBSalon) {
    if (!confirm(`Delete salon "${s.name}"? This permanently removes all its bookings, staff, and services.`)) return;
    startTransition(async () => {
      try {
        await deleteSalon(s.id);
        await onChange();
      } catch (e) {
        alert('Failed to delete: ' + String(e));
      }
    });
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-luxe-muted text-xs tracking-widest uppercase mb-1">Manage Salons</p>
          <h2 className="text-2xl font-display text-luxe-cream tracking-wider">All Salons</h2>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors"
          >
            <Plus size={12} /> New Salon
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-luxe-cream p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-luxe-cream text-xs tracking-wider uppercase">{adding ? 'New Salon' : 'Edit Salon'}</p>
            <button onClick={cancel} className="text-luxe-muted hover:text-luxe-cream transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Tbilisi Flagship" />
            <Field label="URL Slug" value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="auto from name" hint="domain.ge/{slug}" />
            <Field label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Tbilisi" />
            <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Rustaveli 12" />
            <Field label="Admin Username *" value={form.adminUsername} onChange={v => setForm(f => ({ ...f, adminUsername: v }))} placeholder="tbilisi" />
            <Field
              label={adding ? 'Admin Password *' : 'New Password (leave blank to keep)'}
              value={form.adminPassword}
              onChange={v => setForm(f => ({ ...f, adminPassword: v }))}
              type="password"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:text-luxe-cream transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-luxe-cream text-luxe-bg hover:bg-luxe-accent transition-colors disabled:opacity-50"
            >
              <Save size={12} /> {adding ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {salons.length === 0 && !showForm && (
        <div className="border border-luxe-border p-8 text-center">
          <p className="text-luxe-muted text-sm">No salons yet. Click <span className="text-luxe-cream">New Salon</span> to add one.</p>
        </div>
      )}

      <div className="space-y-2">
        {salons.map(s => (
          <div key={s.id} className="border border-luxe-border p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-luxe-cream text-sm">{s.name}</p>
              <p className="text-luxe-muted text-xs mt-0.5">
                <a href={`/${s.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-luxe-cream transition-colors">
                  /{s.slug} <ExternalLink size={10} />
                </a>
                {s.city && <span> · {s.city}</span>}
                {' · '}admin: {s.admin_username}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => startEdit(s)}
                disabled={pending}
                className="p-2 text-luxe-muted hover:text-luxe-cream transition-colors disabled:opacity-40"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(s)}
                disabled={pending}
                className="p-2 text-luxe-border hover:text-red-400 transition-colors disabled:opacity-40"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, hint, type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-luxe-muted text-xs">{label}</label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream"
      />
      {hint && <p className="text-luxe-muted text-[10px]">{hint}</p>}
    </div>
  );
}
