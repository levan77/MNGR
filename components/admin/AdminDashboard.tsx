'use client';

import { useState } from 'react';
import {
  LayoutGrid, Calendar, List, Users, Scissors,
  Plus, X, ChevronLeft, ChevronRight, Check, Clock,
} from 'lucide-react';
import {
  PROFESSIONALS, SERVICES, DEPARTMENTS, SEED_BOOKINGS,
  INITIAL_WORKING_HOURS, ALL_TIME_SLOTS,
  type Booking, type BookingStatus, type WorkingHours,
} from '@/lib/data';
import { localDateString, getWeekDays, formatShortDate, getDayOfWeek } from '@/lib/dates';

type Tab = 'today' | 'calendar' | 'bookings' | 'staff' | 'services';

const STATUS_COLORS: Record<BookingStatus, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10',
  completed: 'text-emerald-400 bg-emerald-400/10',
  no_show: 'text-red-400 bg-red-400/10',
  cancelled: 'text-luxe-muted bg-luxe-border/30',
};

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayView({ bookings }: { bookings: Booking[] }) {
  const today = localDateString();
  const todayBks = bookings.filter(b => b.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const scheduled = todayBks.filter(b => b.status === 'scheduled').length;
  const completed = todayBks.filter(b => b.status === 'completed').length;
  const revenue = todayBks
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (SERVICES.find(s => s.id === b.serviceId)?.price ?? 0), 0);

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
            const pro = PROFESSIONALS.find(p => p.id === b.professionalId);
            const svc = SERVICES.find(s => s.id === b.serviceId);
            return (
              <div key={b.id} className="flex items-center gap-4 p-4 border border-luxe-border">
                <span className="text-luxe-muted text-sm font-mono w-12 shrink-0">{b.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-luxe-cream text-sm truncate">{b.clientName}</p>
                  <p className="text-luxe-muted text-xs truncate">{svc?.name} · {pro?.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>
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
  bookings, onStatusChange,
}: {
  bookings: Booking[];
  onStatusChange: (id: string, status: BookingStatus) => void;
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
                {new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0,2)}{' '}
                {new Date(day + 'T00:00:00').getDate()}
              </p>
              <div className="space-y-1">
                {dayBks.slice(0,3).map(b => (
                  <div key={b.id} className="text-xs px-1 py-0.5 bg-luxe-surface border border-luxe-border truncate text-luxe-muted">
                    {b.time}
                  </div>
                ))}
                {dayBks.length > 3 && <p className="text-xs text-luxe-muted">+{dayBks.length-3}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming bookings in week */}
      <div className="space-y-2 pt-2">
        {days.flatMap(day =>
          bookings
            .filter(b => b.date === day)
            .sort((a,b) => a.time.localeCompare(b.time))
            .map(b => {
              const pro = PROFESSIONALS.find(p => p.id === b.professionalId);
              const svc = SERVICES.find(s => s.id === b.serviceId);
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 border border-luxe-border text-sm">
                  <span className="text-luxe-muted font-mono w-10 shrink-0">{b.time}</span>
                  <span className="text-luxe-muted w-20 shrink-0 hidden sm:block">{formatShortDate(b.date)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-luxe-cream truncate">{b.clientName}</p>
                    <p className="text-luxe-muted text-xs truncate">{svc?.name} · {pro?.name}</p>
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
  bookings, onStatusChange,
}: {
  bookings: Booking[];
  onStatusChange: (id: string, status: BookingStatus) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'all'>('all');
  const [filterPro, setFilterPro] = useState('all');

  const filtered = bookings.filter(b =>
    (filterStatus === 'all' || b.status === filterStatus) &&
    (filterPro === 'all' || b.professionalId === filterPro)
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
          {PROFESSIONALS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-luxe-muted text-sm text-center py-8">No bookings found.</p>
        )}
        {filtered.map(b => {
          const pro = PROFESSIONALS.find(p => p.id === b.professionalId);
          const svc = SERVICES.find(s => s.id === b.serviceId);
          const dept = DEPARTMENTS.find(d => d.id === b.departmentId);
          return (
            <div key={b.id} className="border border-luxe-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-luxe-cream font-medium truncate">{b.clientName}</p>
                  <p className="text-luxe-muted text-xs">{b.clientPhone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[b.status]}`}>
                  {b.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-luxe-muted">{b.date} · {b.time}</span>
                <span className="text-luxe-muted truncate">{svc?.name}</span>
                <span className="text-luxe-muted truncate">{pro?.name}</span>
                <span className="text-luxe-muted truncate">{dept?.city}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-luxe-accent text-xs">{b.reference}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────
function StaffView() {
  const [hours, setHours] = useState<Record<string, WorkingHours[]>>(
    JSON.parse(JSON.stringify(INITIAL_WORKING_HOURS))
  );
  const [selectedPro, setSelectedPro] = useState(PROFESSIONALS[0].id);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function toggle(proId: string, dayIdx: number) {
    setHours(prev => {
      const next = { ...prev, [proId]: [...prev[proId]] };
      next[proId][dayIdx] = next[proId][dayIdx] ? null : { s: '09:00', e: '19:00' };
      return next;
    });
  }

  function updateHour(proId: string, dayIdx: number, field: 's' | 'e', value: string) {
    setHours(prev => {
      const next = { ...prev, [proId]: [...prev[proId]] };
      const cur = next[proId][dayIdx];
      if (cur) next[proId][dayIdx] = { ...cur, [field]: value };
      return next;
    });
  }

  const pro = PROFESSIONALS.find(p => p.id === selectedPro)!;
  const proHours = hours[selectedPro];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {PROFESSIONALS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPro(p.id)}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              p.id === selectedPro ? 'border-luxe-cream text-luxe-cream' : 'border-luxe-border text-luxe-muted hover:border-luxe-muted'
            }`}
          >
            {p.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="border border-luxe-border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-luxe-surface border border-luxe-border flex items-center justify-center text-luxe-muted text-xs">
            {pro.avatar}
          </div>
          <div>
            <p className="text-luxe-cream text-sm">{pro.name}</p>
            <p className="text-luxe-muted text-xs">{pro.title}</p>
          </div>
        </div>

        <div className="space-y-2">
          {days.map((day, idx) => {
            const h = proHours[idx];
            const isOn = h !== null;
            return (
              <div key={day} className="flex items-center gap-3">
                <span className="text-luxe-muted text-xs w-8">{day}</span>
                <button
                  onClick={() => toggle(selectedPro, idx)}
                  className={`w-8 h-4 rounded-full transition-colors ${isOn ? 'bg-luxe-cream' : 'bg-luxe-border'}`}
                />
                {isOn && h && (
                  <>
                    <select
                      value={h.s}
                      onChange={e => updateHour(selectedPro, idx, 's', e.target.value)}
                      className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-2 py-1"
                    >
                      {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-luxe-muted text-xs">–</span>
                    <select
                      value={h.e}
                      onChange={e => updateHour(selectedPro, idx, 'e', e.target.value)}
                      className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-2 py-1"
                    >
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
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────
function ServicesView() {
  const [active, setActive] = useState<Set<string>>(new Set(SERVICES.map(s => s.id)));

  function toggle(id: string) {
    setActive(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {SERVICES.map(svc => {
        const isActive = active.has(svc.id);
        return (
          <div key={svc.id} className={`flex items-start gap-4 p-4 border transition-colors ${isActive ? 'border-luxe-border' : 'border-luxe-border/40 opacity-50'}`}>
            <button
              onClick={() => toggle(svc.id)}
              className={`w-5 h-5 border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isActive ? 'border-luxe-cream bg-luxe-cream' : 'border-luxe-border'}`}
            >
              {isActive && <Check size={12} className="text-luxe-bg" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-luxe-cream text-sm">{svc.name}</p>
                  <p className="text-luxe-muted text-xs mt-0.5">{svc.tagline}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-luxe-accent text-sm">₾{svc.price}</p>
                  <p className="text-luxe-muted text-xs flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {svc.duration}m
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('today');
  const [bookings, setBookings] = useState<Booking[]>(SEED_BOOKINGS);

  function handleStatusChange(id: string, status: BookingStatus) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <LayoutGrid size={16} /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar size={16} /> },
    { id: 'bookings', label: 'Bookings', icon: <List size={16} /> },
    { id: 'staff', label: 'Staff', icon: <Users size={16} /> },
    { id: 'services', label: 'Services', icon: <Scissors size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
        <span className="text-luxe-muted text-xs tracking-widest uppercase">Admin</span>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-luxe-border px-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs tracking-wider uppercase whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-luxe-cream text-luxe-cream'
                : 'border-transparent text-luxe-muted hover:text-luxe-cream'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto">
        {tab === 'today' && <TodayView bookings={bookings} />}
        {tab === 'calendar' && <CalendarView bookings={bookings} onStatusChange={handleStatusChange} />}
        {tab === 'bookings' && <BookingsView bookings={bookings} onStatusChange={handleStatusChange} />}
        {tab === 'staff' && <StaffView />}
        {tab === 'services' && <ServicesView />}
      </main>
    </div>
  );
}
