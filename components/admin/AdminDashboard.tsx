'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  LayoutGrid, Calendar, List, Users, Scissors,
  ChevronLeft, ChevronRight, Clock, LogOut, Plus, Trash2, X, Save,
} from 'lucide-react';
import {
  DEPARTMENTS, ALL_TIME_SLOTS,
  type BookingStatus, type WorkingHours,
} from '@/lib/data';
import { localDateString, getWeekDays, formatShortDate } from '@/lib/dates';
import { logoutAction } from '@/app/admin/login/actions';
import {
  getServices, addService, deleteService,
  getStaff, addStaffMember, deleteStaffMember, updateStaffHours,
  getBookings, updateBookingStatus, deleteBooking,
  type DBService, type DBStaff, type DBBooking,
} from '@/app/admin/actions';

type Tab = 'today' | 'calendar' | 'bookings' | 'staff' | 'services';

const STATUS_COLORS: Record<BookingStatus, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10',
  completed: 'text-emerald-400 bg-emerald-400/10',
  no_show: 'text-red-400 bg-red-400/10',
  cancelled: 'text-luxe-muted bg-luxe-border/30',
};

const DEFAULT_HOURS: WorkingHours[] = [
  null,
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '18:00' },
];

function parseHours(raw: string): WorkingHours[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 7) return parsed as WorkingHours[];
  } catch {}
  return [...DEFAULT_HOURS];
}

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayView({
  bookings, services, professionals,
}: {
  bookings: DBBooking[];
  services: DBService[];
  professionals: DBStaff[];
}) {
  const today = localDateString();
  const todayBks = bookings.filter(b => b.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const scheduled = todayBks.filter(b => b.status === 'scheduled').length;
  const completed = todayBks.filter(b => b.status === 'completed').length;
  const revenue = todayBks
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (services.find(s => s.id === b.service_id)?.price ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Scheduled', value: scheduled },
          { label: 'Completed', value: completed },
          { label: 'Revenue', value: `₾${revenue}` },
        ].map(stat => (
          <div key={stat.label} className="border border-luxe-border p-4 text-center">
            <p className="text-2xl font-display text-luxe-cream">{stat.value}</p>
            <p className="text-luxe-muted text-xs tracking-wider uppercase mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      {todayBks.length === 0 ? (
        <p className="text-luxe-muted text-center py-12 text-sm">No appointments today.</p>
      ) : (
        <div className="space-y-2">
          {todayBks.map(b => {
            const pro = professionals.find(p => p.id === b.professional_id);
            const svc = services.find(s => s.id === b.service_id);
            return (
              <div key={b.id} className="flex items-center gap-4 p-4 border border-luxe-border">
                <span className="text-luxe-muted text-sm font-mono w-12 shrink-0">{b.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-luxe-cream text-sm truncate">{b.client_name}</p>
                  <p className="text-luxe-muted text-xs truncate">{svc?.name ?? '—'} · {pro?.name ?? '—'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status as BookingStatus] ?? ''}`}>
                  {b.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarView({
  bookings, onStatusChange, services, professionals,
}: {
  bookings: DBBooking[];
  onStatusChange: (id: string, status: BookingStatus) => void;
  services: DBService[];
  professionals: DBStaff[];
}) {
  const today = localDateString();
  const [weekStart, setWeekStart] = useState(today);
  const days = getWeekDays(weekStart);

  function shift(n: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + n * 7);
    setWeekStart(localDateString(d));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="p-1.5 text-luxe-muted hover:text-luxe-cream transition-colors">
          <ChevronLeft size={18} />
        </button>
        <p className="text-luxe-cream text-sm tracking-wider">
          {formatShortDate(days[0])} — {formatShortDate(days[6])}
        </p>
        <button onClick={() => shift(1)} className="p-1.5 text-luxe-muted hover:text-luxe-cream transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map(day => {
          const dayBks = bookings.filter(b => b.date === day);
          const isToday = day === today;
          return (
            <div key={day} className={`border ${isToday ? 'border-luxe-cream' : 'border-luxe-border'} p-2 min-h-[80px]`}>
              <p className={`text-xs mb-2 ${isToday ? 'text-luxe-cream' : 'text-luxe-muted'}`}>
                {new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}{' '}
                {new Date(day + 'T00:00:00').getDate()}
              </p>
              <div className="space-y-1">
                {dayBks.slice(0, 3).map(b => (
                  <div key={b.id} className="text-xs px-1 py-0.5 bg-luxe-surface border border-luxe-border truncate text-luxe-muted">
                    {b.time}
                  </div>
                ))}
                {dayBks.length > 3 && <p className="text-xs text-luxe-muted">+{dayBks.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 pt-2">
        {days.flatMap(day =>
          bookings
            .filter(b => b.date === day)
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(b => {
              const pro = professionals.find(p => p.id === b.professional_id);
              const svc = services.find(s => s.id === b.service_id);
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 border border-luxe-border text-sm">
                  <span className="text-luxe-muted font-mono w-10 shrink-0">{b.time}</span>
                  <span className="text-luxe-muted w-20 shrink-0 hidden sm:block">{formatShortDate(b.date)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-luxe-cream truncate">{b.client_name}</p>
                    <p className="text-luxe-muted text-xs truncate">{svc?.name ?? '—'} · {pro?.name ?? '—'}</p>
                  </div>
                  <select
                    value={b.status}
                    onChange={e => onStatusChange(b.id, e.target.value as BookingStatus)}
                    className="bg-luxe-bg border border-luxe-border text-luxe-muted text-xs px-2 py-1 focus:outline-none"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="completed">completed</option>
                    <option value="no_show">no_show</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────
function BookingsView({
  bookings, professionals, services, onStatusChange, onDelete,
}: {
  bookings: DBBooking[];
  professionals: DBStaff[];
  services: DBService[];
  onStatusChange: (id: string, status: BookingStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'all'>('all');
  const [filterPro, setFilterPro] = useState('all');

  const filtered = bookings.filter(b =>
    (filterStatus === 'all' || b.status === filterStatus) &&
    (filterPro === 'all' || b.professional_id === filterPro)
  ).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BookingStatus | 'all')}
          className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-3 py-2 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPro}
          onChange={e => setFilterPro(e.target.value)}
          className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-3 py-2 focus:outline-none"
        >
          <option value="all">All professionals</option>
          {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-luxe-muted text-sm text-center py-8">No bookings found.</p>
        )}
        {filtered.map(b => {
          const pro = professionals.find(p => p.id === b.professional_id);
          const svc = services.find(s => s.id === b.service_id);
          const dept = DEPARTMENTS.find(d => d.id === b.department_id);
          return (
            <div key={b.id} className="border border-luxe-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-luxe-cream font-medium truncate">{b.client_name}</p>
                  <p className="text-luxe-muted text-xs">{b.client_phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[b.status as BookingStatus] ?? ''}`}>
                  {b.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-luxe-muted">{b.date} · {b.time}</span>
                <span className="text-luxe-muted truncate">{svc?.name ?? '—'}</span>
                <span className="text-luxe-muted truncate">{pro?.name ?? '—'}</span>
                <span className="text-luxe-muted truncate">{dept?.city ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-luxe-accent text-xs">{b.reference}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={b.status}
                    onChange={e => onStatusChange(b.id, e.target.value as BookingStatus)}
                    className="bg-luxe-bg border border-luxe-border text-luxe-muted text-xs px-2 py-1 focus:outline-none"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="completed">completed</option>
                    <option value="no_show">no_show</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <button
                    onClick={() => { if (confirm('Delete this booking?')) onDelete(b.id); }}
                    className="text-luxe-border hover:text-red-400 transition-colors"
                    title="Delete booking"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────
function StaffView({
  staff, departmentId, onAdd, onRemove, onHoursSaved,
}: {
  staff: DBStaff[];
  departmentId: string;
  onAdd: (p: DBStaff) => void;
  onRemove: (id: string) => void;
  onHoursSaved: (id: string, raw: string) => void;
}) {
  const [hoursMap, setHoursMap] = useState<Record<string, WorkingHours[]>>({});
  const [savedRaw, setSavedRaw] = useState<Record<string, string>>({});
  const [selectedPro, setSelectedPro] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', title: '' });
  const [pending, startTransition] = useTransition();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Sync hoursMap with the staff prop when it changes (after fetch or mutations)
  useEffect(() => {
    setHoursMap(prev => {
      const next: Record<string, WorkingHours[]> = {};
      const sav: Record<string, string> = {};
      for (const p of staff) {
        next[p.id] = prev[p.id] ?? parseHours(p.working_hours);
        sav[p.id] = p.working_hours;
      }
      setSavedRaw(sav);
      return next;
    });
    if (!selectedPro && staff[0]) setSelectedPro(staff[0].id);
    if (selectedPro && !staff.find(p => p.id === selectedPro)) setSelectedPro(staff[0]?.id ?? '');
  }, [staff, selectedPro]);

  function toggle(proId: string, dayIdx: number) {
    setHoursMap(prev => {
      const cur = prev[proId] ?? [...DEFAULT_HOURS];
      const next = [...cur];
      next[dayIdx] = next[dayIdx] ? null : { s: '09:00', e: '19:00' };
      return { ...prev, [proId]: next };
    });
  }

  function updateHour(proId: string, dayIdx: number, field: 's' | 'e', value: string) {
    setHoursMap(prev => {
      const cur = [...(prev[proId] ?? DEFAULT_HOURS)];
      const h = cur[dayIdx];
      if (h) cur[dayIdx] = { ...h, [field]: value };
      return { ...prev, [proId]: cur };
    });
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    const initials = form.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    startTransition(async () => {
      try {
        const newMember = await addStaffMember({
          departmentId,
          name: form.name.trim(),
          title: form.title.trim() || 'Stylist',
          avatar: initials,
        });
        onAdd(newMember);
        setSelectedPro(newMember.id);
        setForm({ name: '', title: '' });
        setAdding(false);
      } catch (e) {
        alert('Failed to save staff member: ' + String(e));
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm('Remove this staff member? Existing bookings stay but lose their professional reference.')) return;
    startTransition(async () => {
      try {
        await deleteStaffMember(id, departmentId);
        onRemove(id);
        if (selectedPro === id) setSelectedPro(staff.find(p => p.id !== id)?.id ?? '');
      } catch (e) {
        alert('Failed to remove staff: ' + String(e));
      }
    });
  }

  function handleSaveHours(id: string) {
    const hours = hoursMap[id];
    if (!hours) return;
    startTransition(async () => {
      try {
        await updateStaffHours(id, departmentId, hours);
        const raw = JSON.stringify(hours);
        setSavedRaw(prev => ({ ...prev, [id]: raw }));
        onHoursSaved(id, raw);
      } catch (e) {
        alert('Failed to save hours: ' + String(e));
      }
    });
  }

  const pro = staff.find(p => p.id === selectedPro);
  const proHours = hoursMap[selectedPro] ?? DEFAULT_HOURS;
  const dirty = pro ? JSON.stringify(proHours) !== savedRaw[pro.id] : false;

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap items-center">
        {staff.map(p => (
          <div key={p.id} className={`flex items-center gap-1 border transition-colors ${p.id === selectedPro ? 'border-luxe-cream' : 'border-luxe-border'}`}>
            <button
              onClick={() => setSelectedPro(p.id)}
              className={`px-3 py-1.5 text-xs transition-colors ${p.id === selectedPro ? 'text-luxe-cream' : 'text-luxe-muted hover:text-luxe-cream'}`}
            >
              {p.name.split(' ')[0]}
            </button>
            <button
              onClick={() => handleRemove(p.id)}
              disabled={pending}
              className="pr-2 text-luxe-border hover:text-red-400 transition-colors disabled:opacity-40"
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors"
        >
          <Plus size={12} /> Add Staff
        </button>
      </div>

      {adding && (
        <div className="border border-luxe-border p-4 space-y-3">
          <p className="text-luxe-cream text-xs tracking-wider uppercase">New Staff Member</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">Full Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ana Kvaratskhelia"
                className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream"
              />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Senior Stylist"
                className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ name: '', title: '' }); }} className="px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:text-luxe-cream transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={pending} className="px-4 py-2 text-xs bg-luxe-cream text-luxe-bg hover:bg-luxe-accent transition-colors disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {pro && (
        <div className="border border-luxe-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-luxe-surface border border-luxe-border flex items-center justify-center text-luxe-muted text-xs">
                {pro.avatar}
              </div>
              <div>
                <p className="text-luxe-cream text-sm">{pro.name}</p>
                <p className="text-luxe-muted text-xs">{pro.title}</p>
              </div>
            </div>
            <button
              onClick={() => handleSaveHours(pro.id)}
              disabled={!dirty || pending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={12} /> {dirty ? 'Save Hours' : 'Saved'}
            </button>
          </div>
          <div className="space-y-2">
            {days.map((day, idx) => {
              const h = proHours[idx];
              const isOn = h !== null && h !== undefined;
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-luxe-muted text-xs w-8">{day}</span>
                  <button
                    onClick={() => toggle(selectedPro, idx)}
                    className={`w-8 h-4 rounded-full transition-colors ${isOn ? 'bg-luxe-cream' : 'bg-luxe-border'}`}
                  />
                  {isOn && h && (
                    <>
                      <select value={h.s} onChange={e => updateHour(selectedPro, idx, 's', e.target.value)} className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-2 py-1">
                        {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-luxe-muted text-xs">–</span>
                      <select value={h.e} onChange={e => updateHour(selectedPro, idx, 'e', e.target.value)} className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-2 py-1">
                        {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </>
                  )}
                  {!isOn && <span className="text-luxe-muted text-xs">Off</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {staff.length === 0 && !adding && (
        <p className="text-luxe-muted text-sm text-center py-8">No staff at this location yet.</p>
      )}
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────
function ServicesView({
  services, departmentId, onAdd, onRemove,
}: {
  services: DBService[];
  departmentId: string;
  onAdd: (s: DBService) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', tagline: '', duration: '60', price: '' });
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!form.name.trim() || !form.price) return;
    startTransition(async () => {
      try {
        const newSvc = await addService({
          departmentId,
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          duration: parseInt(form.duration) || 60,
          price: parseInt(form.price) || 0,
        });
        onAdd(newSvc);
        setForm({ name: '', tagline: '', duration: '60', price: '' });
        setAdding(false);
      } catch (e) {
        alert('Failed to save service: ' + String(e));
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm('Delete this service?')) return;
    startTransition(async () => {
      try {
        await deleteService(id, departmentId);
        onRemove(id);
      } catch (e) {
        alert('Failed to delete service: ' + String(e));
      }
    });
  }

  return (
    <div className="space-y-3">
      {services.map(svc => (
        <div key={svc.id} className="flex items-start gap-4 p-4 border border-luxe-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-luxe-cream text-sm">{svc.name}</p>
                {svc.tagline && <p className="text-luxe-muted text-xs mt-0.5">{svc.tagline}</p>}
              </div>
              <div className="flex items-start gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-luxe-accent text-sm">₾{svc.price}</p>
                  <p className="text-luxe-muted text-xs flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {svc.duration}m
                  </p>
                </div>
                <button onClick={() => handleRemove(svc.id)} disabled={pending} className="text-luxe-border hover:text-red-400 transition-colors mt-0.5 disabled:opacity-40" title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="border border-luxe-border p-4 space-y-3">
          <p className="text-luxe-cream text-xs tracking-wider uppercase">New Service</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-luxe-muted text-xs">Service Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Signature Cut & Style" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-luxe-muted text-xs">Tagline</label>
              <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short description" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">Duration (min)</label>
              <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">Price (₾)</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="120" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ name: '', tagline: '', duration: '60', price: '' }); }} className="px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:text-luxe-cream transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={pending} className="px-4 py-2 text-xs bg-luxe-cream text-luxe-bg hover:bg-luxe-accent transition-colors disabled:opacity-50">Add</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-3 w-full border border-dashed border-luxe-border text-luxe-muted text-xs hover:border-luxe-cream hover:text-luxe-cream transition-colors">
          <Plus size={14} /> Add Service
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
interface AdminDashboardProps {
  departmentId: string;
  showHeader?: boolean;
}

export default function AdminDashboard({ departmentId, showHeader = true }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('today');
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [services, setServices] = useState<DBService[]>([]);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStaff(departmentId),
      getServices(departmentId),
      getBookings(departmentId),
    ]).then(([s, sv, b]) => {
      if (cancelled) return;
      setStaff(s);
      setServices(sv);
      setBookings(b);
    }).catch(e => {
      console.error('Admin data load failed', e);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [departmentId]);

  const dept = DEPARTMENTS.find(d => d.id === departmentId) ?? null;

  function handleStatusChange(id: string, status: BookingStatus) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    startTransition(async () => {
      try {
        await updateBookingStatus(id, departmentId, status);
      } catch (e) {
        alert('Failed to update status: ' + String(e));
        const fresh = await getBookings(departmentId);
        setBookings(fresh);
      }
    });
  }

  function handleDeleteBooking(id: string) {
    setBookings(prev => prev.filter(b => b.id !== id));
    startTransition(async () => {
      try {
        await deleteBooking(id, departmentId);
      } catch (e) {
        alert('Failed to delete booking: ' + String(e));
        const fresh = await getBookings(departmentId);
        setBookings(fresh);
      }
    });
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <LayoutGrid size={16} /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar size={16} /> },
    { id: 'bookings', label: 'Bookings', icon: <List size={16} /> },
    { id: 'staff', label: 'Staff', icon: <Users size={16} /> },
    { id: 'services', label: 'Services', icon: <Scissors size={16} /> },
  ];

  return (
    <div className={showHeader ? 'min-h-screen bg-luxe-bg flex flex-col' : 'flex flex-col'}>
      {showHeader && (
        <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
          <div>
            <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
            {dept && <p className="text-luxe-muted text-xs mt-0.5">{dept.name}</p>}
          </div>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors">
              <LogOut size={14} /> Logout
            </button>
          </form>
        </header>
      )}

      <nav className="flex border-b border-luxe-border px-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs tracking-wider uppercase whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-luxe-cream text-luxe-cream' : 'border-transparent text-luxe-muted hover:text-luxe-cream'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto">
        {loading && <p className="text-luxe-muted text-sm text-center py-8">Loading…</p>}
        {!loading && tab === 'today' && <TodayView bookings={bookings} services={services} professionals={staff} />}
        {!loading && tab === 'calendar' && <CalendarView bookings={bookings} onStatusChange={handleStatusChange} services={services} professionals={staff} />}
        {!loading && tab === 'bookings' && <BookingsView bookings={bookings} professionals={staff} services={services} onStatusChange={handleStatusChange} onDelete={handleDeleteBooking} />}
        {!loading && tab === 'staff' && (
          <StaffView
            staff={staff}
            departmentId={departmentId}
            onAdd={p => setStaff(prev => [...prev, p])}
            onRemove={id => setStaff(prev => prev.filter(p => p.id !== id))}
            onHoursSaved={(id, raw) => setStaff(prev => prev.map(p => p.id === id ? { ...p, working_hours: raw } : p))}
          />
        )}
        {!loading && tab === 'services' && (
          <ServicesView
            services={services}
            departmentId={departmentId}
            onAdd={s => setServices(prev => [...prev, s])}
            onRemove={id => setServices(prev => prev.filter(s => s.id !== id))}
          />
        )}
      </main>
    </div>
  );
}
