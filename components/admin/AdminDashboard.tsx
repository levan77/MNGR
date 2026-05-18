'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import {
  LayoutGrid, Calendar, List, Users, Scissors, BarChart2,
  ChevronLeft, ChevronRight, Clock, LogOut, Plus, Trash2, X, Save, Check, Globe, MapPin,
} from 'lucide-react';
import { ALL_TIME_SLOTS, parseSpecialties, type BookingStatus, type WorkingHours } from '@/lib/data';
import { localDateString, getWeekDays, formatShortDate } from '@/lib/dates';
import { logoutAction } from '@/app/admin/login/actions';
import {
  getServices, addService, deleteService, updateServiceBuffer,
  getStaff, addStaffMember, deleteStaffMember, updateStaffHours, updateStaffSpecialties, updateStaffCompensation, updateStaffBufferExtra,
  updateStaffCredentials,
  getBookings, updateBookingStatus, deleteBooking,
  getServiceAddons, addServiceAddon, deleteServiceAddon,
  getAddonExclusions, toggleAddonExclusion,
  seedDemoAddons, seedBranchDemoData,
  getSalonById,
  getSalonBranches,
  type DBService, type DBStaff, type DBBooking, type DBSalon, type CompType, type DBServiceAddon, type AddonExclusion, type BranchRow,
} from '@/app/admin/actions';
import DayCalendar from './DayCalendar';
import FinancialsTab from './FinancialsTab';
import NewBookingModal from './NewBookingModal';
import { useLanguage } from '@/lib/LanguageContext';

type Tab = 'today' | 'calendar' | 'bookings' | 'staff' | 'services' | 'financials';

// ─── Seed Demo Button ─────────────────────────────────────────────────────────
function SeedDemoButton({ branchId, onSeeded }: { branchId: string; onSeeded: () => void }) {
  const { t } = useLanguage();
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    const result = await seedBranchDemoData(branchId);
    setSeeding(false);
    if (result.ok) { setDone(true); onSeeded(); }
    else alert('Seed failed: ' + result.error);
  }

  if (done) return null;
  return (
    <div className="border border-dashed border-luxe-border rounded-sm p-6 mb-6 text-center space-y-3">
      <p className="text-luxe-muted text-xs tracking-wider uppercase">
        {t('no_staff_yet')}
      </p>
      <button
        onClick={handleSeed}
        disabled={seeding}
        className="px-4 py-2 border border-luxe-border text-luxe-cream text-xs tracking-widest uppercase hover:border-luxe-cream/60 transition-colors disabled:opacity-40"
      >
        {seeding ? t('loading') : '✦ დემო მონაცემების დამატება'}
      </button>
    </div>
  );
}

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
  bookings, services, professionals, onStatusChange,
}: {
  bookings: DBBooking[];
  services: DBService[];
  professionals: DBStaff[];
  onStatusChange: (id: string, status: BookingStatus) => void;
}) {
  const { t } = useLanguage();
  const today = localDateString();
  const todayBks = bookings.filter(b => b.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const scheduled = todayBks.filter(b => b.status === 'scheduled').length;
  const completed = todayBks.filter(b => b.status === 'completed').length;
  const revenue = todayBks
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (services.find(s => s.id === b.service_id)?.price ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('scheduled'), value: scheduled },
          { label: t('completed'), value: completed },
          { label: t('revenue'),   value: `₾${revenue}` },
        ].map(stat => (
          <div key={stat.label} className="border border-luxe-border p-4 text-center">
            <p className="text-2xl font-display text-luxe-cream">{stat.value}</p>
            <p className="text-luxe-muted text-xs tracking-wider uppercase mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {todayBks.length === 0 ? (
        <p className="text-luxe-muted text-center py-12 text-sm">{t('no_appointments_today')}</p>
      ) : (
        <div className="space-y-2">
          {todayBks.map(b => {
            const pro = professionals.find(p => p.id === b.professional_id);
            const svc = services.find(s => s.id === b.service_id);
            const isScheduled = b.status === 'scheduled';
            const isCompleted = b.status === 'completed';
            const isNoShow   = b.status === 'no_show';
            return (
              <div
                key={b.id}
                className={`flex items-center gap-3 p-4 border transition-colors ${
                  isCompleted ? 'border-emerald-900/60 bg-emerald-950/10' :
                  isNoShow    ? 'border-red-900/40 bg-red-950/5 opacity-60' :
                  'border-luxe-border'
                }`}
              >
                {/* Time */}
                <span className="text-luxe-muted text-sm font-mono w-12 shrink-0">{b.time}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate font-medium ${isCompleted ? 'text-emerald-300' : 'text-luxe-cream'}`}>
                    {b.client_name}
                  </p>
                  <p className="text-luxe-muted text-xs truncate">
                    {svc?.name ?? '—'} · {pro?.name ?? '—'}
                    {svc && <span className="text-amber-500/70 ml-1">₾{svc.price}</span>}
                  </p>
                </div>

                {/* Action buttons — only for scheduled */}
                {isScheduled && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onStatusChange(b.id, 'completed')}
                      title={t('completed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs rounded-sm hover:bg-emerald-900/50 hover:border-emerald-600 transition-colors font-medium"
                    >
                      <Check size={13} />
                      <span className="hidden sm:inline">{t('completed')}</span>
                    </button>
                    <button
                      onClick={() => onStatusChange(b.id, 'no_show')}
                      title={t('no_show')}
                      className="flex items-center gap-1 px-2 py-1.5 border border-luxe-border text-luxe-muted text-xs rounded-sm hover:border-red-800/60 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Completed badge */}
                {isCompleted && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <Check size={13} /> {t('completed')}
                    </span>
                    <button
                      onClick={() => onStatusChange(b.id, 'scheduled')}
                      title="Undo"
                      className="text-luxe-muted/40 hover:text-luxe-muted text-[10px] ml-1 transition-colors"
                    >
                      ↩
                    </button>
                  </div>
                )}

                {/* No-show / cancelled badge */}
                {(isNoShow || b.status === 'cancelled') && (
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[b.status as BookingStatus]}`}>
                    {t(('status_' + b.status) as Parameters<typeof t>[0])}
                  </span>
                )}
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
  const { t, lang } = useLanguage();
  const today = localDateString();
  const [weekStart, setWeekStart] = useState(today);
  const days = getWeekDays(weekStart);
  const locale = lang === 'ka' ? 'ka-GE' : 'en';

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
                {new Date(day + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}{' '}
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
              const isScheduled = b.status === 'scheduled';
              const isCompleted = b.status === 'completed';
              return (
                <div key={b.id} className={`flex items-center gap-3 p-3 border text-sm transition-colors ${isCompleted ? 'border-emerald-900/50 bg-emerald-950/10' : 'border-luxe-border'}`}>
                  <span className="text-luxe-muted font-mono w-10 shrink-0">{b.time}</span>
                  <span className="text-luxe-muted w-20 shrink-0 hidden sm:block">{formatShortDate(b.date)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${isCompleted ? 'text-emerald-300' : 'text-luxe-cream'}`}>{b.client_name}</p>
                    <p className="text-luxe-muted text-xs truncate">{svc?.name ?? '—'} · {pro?.name ?? '—'}</p>
                  </div>
                  {isScheduled ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onStatusChange(b.id, 'completed')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs rounded-sm hover:bg-emerald-900/50 transition-colors"
                      >
                        <Check size={12} /> <span className="hidden sm:inline">{t('completed')}</span>
                      </button>
                      <button onClick={() => onStatusChange(b.id, 'no_show')} className="px-2 py-1 border border-luxe-border text-luxe-muted text-xs rounded-sm hover:border-red-800/60 hover:text-red-400 transition-colors">
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status as BookingStatus] ?? ''}`}>
                        {t(('status_' + b.status) as Parameters<typeof t>[0])}
                      </span>
                      {isCompleted && (
                        <button onClick={() => onStatusChange(b.id, 'scheduled')} className="text-luxe-muted/40 hover:text-luxe-muted text-[10px] transition-colors" title="Undo">↩</button>
                      )}
                    </div>
                  )}
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
  const { t } = useLanguage();
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
          <option value="all">{t('all_statuses')}</option>
          <option value="scheduled">{t('scheduled')}</option>
          <option value="completed">{t('completed')}</option>
          <option value="no_show">{t('no_show')}</option>
          <option value="cancelled">{t('cancelled')}</option>
        </select>
        <select
          value={filterPro}
          onChange={e => setFilterPro(e.target.value)}
          className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-3 py-2 focus:outline-none"
        >
          <option value="all">{t('all_professionals')}</option>
          {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-luxe-muted text-sm text-center py-8">{t('no_bookings_found')}</p>
        )}
        {filtered.map(b => {
          const pro = professionals.find(p => p.id === b.professional_id);
          const svc = services.find(s => s.id === b.service_id);
          const isScheduled = b.status === 'scheduled';
          const isCompleted = b.status === 'completed';
          return (
            <div key={b.id} className={`border p-4 space-y-3 transition-colors ${isCompleted ? 'border-emerald-900/50 bg-emerald-950/10' : 'border-luxe-border'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={`font-medium truncate ${isCompleted ? 'text-emerald-300' : 'text-luxe-cream'}`}>{b.client_name}</p>
                  <p className="text-luxe-muted text-xs">{b.client_phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[b.status as BookingStatus] ?? ''}`}>
                  {t(('status_' + b.status) as Parameters<typeof t>[0])}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-luxe-muted">{b.date} · {b.time}</span>
                <span className="text-luxe-muted truncate">{svc?.name ?? '—'}{svc && <span className="text-amber-500/70 ml-1">₾{svc.price}</span>}</span>
                <span className="text-luxe-muted truncate">{pro?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-luxe-accent text-xs">{b.reference}</span>
                <div className="flex items-center gap-2">
                  {isScheduled && (
                    <>
                      <button
                        onClick={() => onStatusChange(b.id, 'completed')}
                        className="flex items-center gap-1 px-3 py-1 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs rounded-sm hover:bg-emerald-900/50 transition-colors font-medium"
                      >
                        <Check size={12} /> {t('completed')}
                      </button>
                      <button
                        onClick={() => onStatusChange(b.id, 'no_show')}
                        className="px-2 py-1 border border-luxe-border text-luxe-muted text-xs rounded-sm hover:border-red-800/60 hover:text-red-400 transition-colors"
                        title={t('no_show')}
                      >
                        <X size={11} />
                      </button>
                    </>
                  )}
                  {isCompleted && (
                    <button onClick={() => onStatusChange(b.id, 'scheduled')} className="text-luxe-muted/50 hover:text-luxe-muted text-xs transition-colors" title="Undo">↩ undo</button>
                  )}
                  {!isScheduled && !isCompleted && (
                    <button onClick={() => onStatusChange(b.id, 'scheduled')} className="px-2 py-1 border border-luxe-border text-luxe-muted text-xs rounded-sm hover:border-luxe-cream/40 transition-colors">↩</button>
                  )}
                  <button
                    onClick={() => { if (confirm(t('delete_booking_confirm'))) onDelete(b.id); }}
                    className="text-luxe-border hover:text-red-400 transition-colors"
                    title={t('delete')}
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
function CredentialsSection({
  pro, branchId, pending, startTransition,
}: {
  pro: DBStaff;
  branchId: string;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function handleSave() {
    if (!username.trim() || !password) return;
    setError('');
    startTransition(async () => {
      try {
        const res = await updateStaffCredentials(pro.id, branchId, username, password);
        if (res.ok) { setSaved(true); setPassword(''); setTimeout(() => setSaved(false), 3000); }
        else setError(res.error ?? 'Error');
      } catch (e) { setError(String(e)); }
    });
  }

  return (
    <div className="border-t border-luxe-border pt-4 space-y-3">
      <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('portal_login')}</p>
      {pro.pro_username && !saved && (
        <p className="text-emerald-400 text-[11px]">✓ {t('username_active')}: {pro.pro_username}</p>
      )}
      {saved && <p className="text-emerald-400 text-[11px]">✓ {t('credentials_saved')}</p>}
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
      <div className="flex gap-2">
        <input
          placeholder={t('pro_username')}
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="flex-1 bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream min-w-0"
        />
        <input
          type="password"
          placeholder={t('pro_password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="flex-1 bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream min-w-0"
        />
        <button
          onClick={handleSave}
          disabled={!username.trim() || !password || pending}
          className="px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40 shrink-0"
        >
          {t('save_credentials')}
        </button>
      </div>
    </div>
  );
}

function StaffView({
  staff, services, branchId, allAddons, exclusions,
  onAdd, onRemove, onHoursSaved, onSpecialtiesSaved, onExclusionToggled,
}: {
  staff: DBStaff[];
  services: DBService[];
  branchId: string;
  allAddons: DBServiceAddon[];
  exclusions: AddonExclusion[];
  onAdd: (p: DBStaff) => void;
  onRemove: (id: string) => void;
  onHoursSaved: (id: string, raw: string) => void;
  onSpecialtiesSaved: (id: string, raw: string) => void;
  onExclusionToggled: (staffId: string, addonId: string, excluded: boolean) => void;
}) {
  const { t } = useLanguage();
  const [hoursMap, setHoursMap] = useState<Record<string, WorkingHours[]>>({});
  const [savedRaw, setSavedRaw] = useState<Record<string, string>>({});
  const [specialtiesMap, setSpecialtiesMap] = useState<Record<string, string[]>>({});
  const [savedSpecRaw, setSavedSpecRaw] = useState<Record<string, string>>({});
  const [compMap, setCompMap] = useState<Record<string, { type: CompType; base: number; pct: number }>>({});
  const [selectedPro, setSelectedPro] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', title: '' });
  const [pending, startTransition] = useTransition();

  const days = [t('day_sun'), t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat')];

  const hoursMapRef = useRef(hoursMap);
  hoursMapRef.current = hoursMap;
  const specialtiesMapRef = useRef(specialtiesMap);
  specialtiesMapRef.current = specialtiesMap;

  useEffect(() => {
    const newHours: Record<string, WorkingHours[]> = {};
    const savedHours: Record<string, string> = {};
    const newSpecs: Record<string, string[]> = {};
    const savedSpecs: Record<string, string> = {};
    for (const p of staff) {
      newHours[p.id] = hoursMapRef.current[p.id] ?? parseHours(p.working_hours);
      savedHours[p.id] = p.working_hours;
      newSpecs[p.id] = specialtiesMapRef.current[p.id] ?? parseSpecialties(p.specialties);
      savedSpecs[p.id] = p.specialties;
    }
    setCompMap(prev => {
      const next = { ...prev };
      for (const p of staff) {
        if (!next[p.id]) next[p.id] = { type: p.comp_type, base: p.comp_base, pct: p.comp_percentage };
      }
      return next;
    });
    setHoursMap(newHours);
    setSavedRaw(savedHours);
    setSpecialtiesMap(newSpecs);
    setSavedSpecRaw(savedSpecs);
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
          departmentId: branchId,
          name: form.name.trim(),
          title: form.title.trim() || 'Stylist',
          avatar: initials,
        });
        onAdd(newMember);
        setSelectedPro(newMember.id);
        setForm({ name: '', title: '' });
        setAdding(false);
      } catch (e) {
        alert(t('failed_save_staff') + String(e));
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm(t('remove_staff_confirm'))) return;
    startTransition(async () => {
      try {
        await deleteStaffMember(id, branchId);
        onRemove(id);
        if (selectedPro === id) setSelectedPro(staff.find(p => p.id !== id)?.id ?? '');
      } catch (e) {
        alert(t('failed_remove_staff') + String(e));
      }
    });
  }

  function handleSaveHours(id: string) {
    const hours = hoursMap[id];
    if (!hours) return;
    startTransition(async () => {
      try {
        await updateStaffHours(id, branchId, hours);
        const raw = JSON.stringify(hours);
        setSavedRaw(prev => ({ ...prev, [id]: raw }));
        onHoursSaved(id, raw);
      } catch (e) {
        alert(t('failed_save_hours') + String(e));
      }
    });
  }

  function handleSaveComp(id: string) {
    const c = compMap[id];
    if (!c) return;
    startTransition(async () => {
      try {
        await updateStaffCompensation(id, branchId, { compType: c.type, compBase: c.base, compPercentage: c.pct });
      } catch (e) {
        alert(t('failed_save_comp') + String(e));
      }
    });
  }

  function handleSaveBufferExtra(id: string, bufferExtra: number) {
    startTransition(async () => {
      try { await updateStaffBufferExtra(id, branchId, bufferExtra); }
      catch (e) { alert(t('failed_save_buffer') + String(e)); }
    });
  }

  function handleToggleAddonCap(staffId: string, addonId: string, currentlyExcluded: boolean) {
    startTransition(async () => {
      try {
        await toggleAddonExclusion(staffId, addonId, branchId, !currentlyExcluded);
        onExclusionToggled(staffId, addonId, !currentlyExcluded);
      } catch (e) { alert(t('failed_update_exclusion') + String(e)); }
    });
  }

  function toggleSpecialty(proId: string, serviceId: string) {
    setSpecialtiesMap(prev => {
      const cur = prev[proId] ?? [];
      const next = cur.includes(serviceId) ? cur.filter(id => id !== serviceId) : [...cur, serviceId];
      return { ...prev, [proId]: next };
    });
  }

  function handleSaveSpecialties(id: string) {
    const specs = specialtiesMap[id] ?? [];
    startTransition(async () => {
      try {
        await updateStaffSpecialties(id, branchId, specs);
        const raw = JSON.stringify(specs);
        setSavedSpecRaw(prev => ({ ...prev, [id]: raw }));
        onSpecialtiesSaved(id, raw);
      } catch (e) {
        alert(t('failed_save_services') + String(e));
      }
    });
  }

  const pro = staff.find(p => p.id === selectedPro);
  const proHours = hoursMap[selectedPro] ?? DEFAULT_HOURS;
  const proSpecs = specialtiesMap[selectedPro] ?? [];
  const dirty = pro ? JSON.stringify(proHours) !== savedRaw[pro.id] : false;
  const specDirty = pro ? JSON.stringify(proSpecs) !== savedSpecRaw[pro.id] : false;

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
              title={t('remove')}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors"
        >
          <Plus size={12} /> {t('add_staff')}
        </button>
      </div>

      {adding && (
        <div className="border border-luxe-border p-4 space-y-3">
          <p className="text-luxe-cream text-xs tracking-wider uppercase">{t('new_staff_member')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">{t('full_name')}</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ana Kvaratskhelia"
                className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream"
              />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">{t('title')}</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Senior Stylist"
                className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ name: '', title: '' }); }} className="px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:text-luxe-cream transition-colors">{t('cancel')}</button>
            <button onClick={handleAdd} disabled={pending} className="px-4 py-2 text-xs bg-luxe-cream text-luxe-bg hover:bg-luxe-accent transition-colors disabled:opacity-50">{t('add')}</button>
          </div>
        </div>
      )}

      {pro && (
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
            <div className="flex items-center justify-between">
              <p className="text-luxe-muted text-xs tracking-wider uppercase">{t('working_hours')}</p>
              <button
                onClick={() => handleSaveHours(pro.id)}
                disabled={!dirty || pending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={12} /> {dirty ? t('save_hours') : t('saved')}
              </button>
            </div>
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
                        {ALL_TIME_SLOTS.map(t_ => <option key={t_} value={t_}>{t_}</option>)}
                      </select>
                      <span className="text-luxe-muted text-xs">–</span>
                      <select value={h.e} onChange={e => updateHour(selectedPro, idx, 'e', e.target.value)} className="bg-luxe-surface border border-luxe-border text-luxe-muted text-xs px-2 py-1">
                        {ALL_TIME_SLOTS.map(t_ => <option key={t_} value={t_}>{t_}</option>)}
                      </select>
                    </>
                  )}
                  {!isOn && <span className="text-luxe-muted text-xs">{t('off')}</span>}
                </div>
              );
            })}
          </div>

          {services.length > 0 && (
            <div className="border-t border-luxe-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-luxe-muted text-xs tracking-wider uppercase">{t('services')}</p>
                <button
                  onClick={() => handleSaveSpecialties(pro.id)}
                  disabled={!specDirty || pending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={12} /> {specDirty ? t('save_services') : t('saved')}
                </button>
              </div>
              <p className="text-luxe-muted text-[10px]">{t('unchecked_can_perform_all')}</p>
              <div className="grid grid-cols-2 gap-2">
                {services.map(svc => {
                  const checked = proSpecs.includes(svc.id);
                  return (
                    <label key={svc.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={checked} onChange={() => toggleSpecialty(selectedPro, svc.id)} className="sr-only" />
                      <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-luxe-cream bg-luxe-cream' : 'border-luxe-border group-hover:border-luxe-muted'}`}>
                        {checked && <Check size={10} className="text-luxe-bg" />}
                      </div>
                      <span className={`text-xs truncate transition-colors ${checked ? 'text-luxe-cream' : 'text-luxe-muted group-hover:text-luxe-cream'}`}>{svc.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-on Capabilities */}
          {pro && (() => {
            const proSvcIds = specialtiesMap[pro.id] ?? [];
            const proExclusionSet = new Set(
              exclusions.filter(e => e.staff_id === pro.id).map(e => e.addon_id)
            );
            const relevantServices = services.filter(svc =>
              proSvcIds.length === 0 || proSvcIds.includes(svc.id)
            );
            const relevantAddons = allAddons.filter(a =>
              proSvcIds.length === 0 || proSvcIds.includes(a.service_id)
            );
            if (relevantAddons.length === 0) return null;
            return (
              <div className="border-t border-luxe-border pt-4 space-y-3">
                <div>
                  <p className="text-luxe-muted text-xs tracking-wider uppercase">{t('addon_capabilities')}</p>
                  <p className="text-luxe-muted text-[10px] mt-0.5">{t('addon_capabilities_note')}</p>
                </div>
                {relevantServices.map(svc => {
                  const svcAddons = relevantAddons.filter(a => a.service_id === svc.id);
                  if (svcAddons.length === 0) return null;
                  return (
                    <div key={svc.id} className="space-y-1.5">
                      <p className="text-luxe-muted text-[10px] uppercase tracking-wider opacity-60">{svc.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {svcAddons.map(addon => {
                          const excluded = proExclusionSet.has(addon.id);
                          return (
                            <label key={addon.id} className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" checked={!excluded} onChange={() => handleToggleAddonCap(pro.id, addon.id, excluded)} disabled={pending} className="sr-only" />
                              <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${!excluded ? 'border-luxe-cream bg-luxe-cream' : 'border-luxe-border group-hover:border-luxe-muted'}`}>
                                {!excluded && <Check size={10} className="text-luxe-bg" />}
                              </div>
                              <span className={`text-xs truncate transition-colors ${!excluded ? 'text-luxe-cream' : 'text-luxe-muted line-through group-hover:text-luxe-cream'}`}>{addon.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Compensation */}
          {pro && compMap[pro.id] && (
            <div className="border-t border-luxe-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-luxe-muted text-xs tracking-wider uppercase">{t('compensation')}</p>
                <button
                  onClick={() => handleSaveComp(pro.id)}
                  disabled={pending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40"
                >
                  <Save size={12} /> {t('save_comp')}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['commission', 'salary', 'hybrid'] as CompType[]).map(tp => (
                  <button
                    key={tp}
                    onClick={() => setCompMap(prev => ({ ...prev, [pro.id]: { ...prev[pro.id], type: tp } }))}
                    className={`px-2 py-1.5 text-[11px] uppercase tracking-wider border transition-colors ${compMap[pro.id].type === tp ? 'border-luxe-cream text-luxe-cream bg-luxe-surface' : 'border-luxe-border text-luxe-muted hover:border-luxe-muted'}`}
                  >
                    {t(tp as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
              {compMap[pro.id].type !== 'commission' && (
                <div className="flex items-center gap-2">
                  <label className="text-luxe-muted text-xs w-24 shrink-0">{t('base_salary')}</label>
                  <input
                    type="number" min={0}
                    value={compMap[pro.id].base}
                    onChange={e => setCompMap(prev => ({ ...prev, [pro.id]: { ...prev[pro.id], base: Number(e.target.value) } }))}
                    className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                  />
                </div>
              )}
              {compMap[pro.id].type !== 'salary' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-luxe-muted text-xs w-28 shrink-0">{t('employee_commission_pct')}</label>
                    <input
                      type="number" min={0} max={100}
                      value={compMap[pro.id].pct}
                      onChange={e => setCompMap(prev => ({ ...prev, [pro.id]: { ...prev[pro.id], pct: Number(e.target.value) } }))}
                      className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                    />
                  </div>
                  <p className="text-luxe-muted text-[10px] opacity-60 pl-[7.5rem]">{t('employee_commission_note')}</p>
                </div>
              )}
            </div>
          )}

          {/* Buffer Extra */}
          {pro && (
            <div className="border-t border-luxe-border pt-4 space-y-2">
              <p className="text-luxe-muted text-xs tracking-wider uppercase">{t('extra_buffer')}</p>
              <p className="text-luxe-muted text-[10px]">{t('extra_buffer_note')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={60}
                  defaultValue={pro.buffer_extra ?? 0}
                  key={pro.id}
                  onBlur={e => handleSaveBufferExtra(pro.id, Number(e.target.value))}
                  className="w-24 bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                />
                <span className="text-luxe-muted text-xs">{t('saves_on_blur')}</span>
              </div>
            </div>
          )}

          {/* Portal Login Credentials */}
          {pro && (
            <CredentialsSection
              key={pro.id}
              pro={pro}
              branchId={branchId}
              pending={pending}
              startTransition={startTransition}
            />
          )}
        </div>
      )}

      {staff.length === 0 && !adding && (
        <p className="text-luxe-muted text-sm text-center py-8">{t('no_staff_yet')}</p>
      )}
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────
function ServicesView({
  services, staff, branchId, allAddons, exclusions,
  onAdd, onRemove, onBufferSaved, onAddonAdded, onAddonRemoved, onExclusionToggled, onDemoSeeded,
}: {
  services: DBService[];
  staff: DBStaff[];
  branchId: string;
  allAddons: DBServiceAddon[];
  exclusions: AddonExclusion[];
  onAdd: (s: DBService) => void;
  onRemove: (id: string) => void;
  onBufferSaved: (id: string, buffer: number) => void;
  onAddonAdded: (addon: DBServiceAddon) => void;
  onAddonRemoved: (id: string) => void;
  onExclusionToggled: (staffId: string, addonId: string, excluded: boolean) => void;
  onDemoSeeded: (addons: DBServiceAddon[]) => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bufferMap, setBufferMap] = useState<Record<string, number>>({});
  const [addonForms, setAddonForms] = useState<Record<string, { name: string; duration: string; price: string }>>({});
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', tagline: '', duration: '60', price: '' });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const m: Record<string, number> = {};
    for (const s of services) m[s.id] = s.buffer;
    setBufferMap(m);
  }, [services]);

  function handleAdd() {
    if (!form.name.trim() || !form.price) return;
    startTransition(async () => {
      try {
        const newSvc = await addService({
          departmentId: branchId, name: form.name.trim(), tagline: form.tagline.trim(),
          duration: parseInt(form.duration) || 60, price: parseInt(form.price) || 0,
        });
        onAdd(newSvc);
        setBufferMap(prev => ({ ...prev, [newSvc.id]: newSvc.buffer }));
        setForm({ name: '', tagline: '', duration: '60', price: '' });
        setAdding(false);
      } catch (e) { alert(t('failed_save_service') + String(e)); }
    });
  }

  function handleRemove(id: string) {
    if (!confirm(t('delete_service_confirm'))) return;
    startTransition(async () => {
      try { await deleteService(id, branchId); onRemove(id); }
      catch (e) { alert(t('failed_delete_service') + String(e)); }
    });
  }

  function handleSaveBuffer(id: string) {
    const buffer = bufferMap[id] ?? 10;
    startTransition(async () => {
      try { await updateServiceBuffer(id, branchId, buffer); onBufferSaved(id, buffer); }
      catch (e) { alert(t('failed_save_buffer_svc') + String(e)); }
    });
  }

  function handleAddAddon(serviceId: string) {
    const f = addonForms[serviceId];
    if (!f?.name.trim()) return;
    startTransition(async () => {
      try {
        const addon = await addServiceAddon({
          departmentId: branchId, serviceId, name: f.name.trim(),
          duration: parseInt(f.duration) || 15, price: parseInt(f.price) || 0,
        });
        onAddonAdded(addon);
        setAddonForms(prev => ({ ...prev, [serviceId]: { name: '', duration: '15', price: '0' } }));
      } catch (e) { alert(t('failed_add_addon') + String(e)); }
    });
  }

  function handleRemoveAddon(id: string) {
    startTransition(async () => {
      try { await deleteServiceAddon(id, branchId); onAddonRemoved(id); }
      catch (e) { alert(t('failed_remove_addon') + String(e)); }
    });
  }

  function handleToggleExclusion(staffId: string, addonId: string, currentlyExcluded: boolean) {
    startTransition(async () => {
      try {
        await toggleAddonExclusion(staffId, addonId, branchId, !currentlyExcluded);
        onExclusionToggled(staffId, addonId, !currentlyExcluded);
      } catch (e) { alert(t('failed_update_exclusion') + String(e)); }
    });
  }

  function handleSeedDemo() {
    startTransition(async () => {
      try {
        const { added } = await seedDemoAddons(branchId);
        if (added === 0) { alert(t('all_addons_seeded')); return; }
        const fresh = await getServiceAddons(branchId);
        onDemoSeeded(fresh);
      } catch (e) { alert(t('failed_add_addon') + String(e)); }
    });
  }

  return (
    <div className="space-y-2">
      {services.map(svc => {
        const assigned = staff.filter(p => {
          const specs = parseSpecialties(p.specialties);
          return specs.length === 0 || specs.includes(svc.id);
        });
        const svcAddons = allAddons.filter(a => a.service_id === svc.id);
        const isOpen = expanded === svc.id;
        const addonForm = addonForms[svc.id] ?? { name: '', duration: '15', price: '0' };

        let assignedLabel: string;
        if (staff.length === 0) assignedLabel = t('no_staff_label');
        else if (assigned.length === 0) assignedLabel = t('no_one_assigned');
        else if (assigned.length === staff.length) assignedLabel = t('all_specialists');
        else assignedLabel = assigned.map(p => p.name.split(' ')[0]).join(', ');

        return (
          <div key={svc.id} className="border border-luxe-border">
            <div className="flex items-center gap-3 p-3">
              <button onClick={() => setExpanded(isOpen ? null : svc.id)} className="flex-1 flex items-start gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-luxe-cream text-sm">{svc.name}</p>
                  <p className="text-luxe-muted text-xs mt-0.5">
                    {assignedLabel} · {svc.duration}m · ₾{svc.price} · {svc.buffer}m {t('buffer_label')}
                    {svcAddons.length > 0 && ` · ${svcAddons.length} ${t(svcAddons.length > 1 ? 'addon_plural' : 'addon_single')}`}
                  </p>
                </div>
                <span className={`text-luxe-muted text-xs px-2 py-0.5 border border-luxe-border transition-colors ${isOpen ? 'text-luxe-cream' : ''}`}>
                  {isOpen ? t('close') : t('edit')}
                </span>
              </button>
              <button onClick={() => handleRemove(svc.id)} disabled={pending} className="text-luxe-border hover:text-red-400 transition-colors disabled:opacity-40 shrink-0" title={t('remove')}>
                <Trash2 size={13} />
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-luxe-border px-4 py-4 space-y-5 bg-luxe-surface/30">
                <div>
                  <p className="text-luxe-muted text-[10px] uppercase tracking-widest mb-2">{t('buffer_after_service')}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={120}
                      value={bufferMap[svc.id] ?? svc.buffer}
                      onChange={e => setBufferMap(prev => ({ ...prev, [svc.id]: Number(e.target.value) }))}
                      className="w-24 bg-luxe-bg border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                    />
                    <button onClick={() => handleSaveBuffer(svc.id)} disabled={pending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40">
                      <Save size={11} /> {t('save')}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-luxe-muted text-[10px] uppercase tracking-widest mb-2">{t('addons_sub_services')}</p>
                  {svcAddons.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {svcAddons.map(addon => {
                        const excludedStaffIds = new Set(
                          exclusions.filter(e => e.addon_id === addon.id).map(e => e.staff_id)
                        );
                        return (
                          <div key={addon.id} className="border border-luxe-border px-3 py-2 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-luxe-cream">{addon.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-luxe-muted">+{addon.duration}m · ₾{addon.price}</span>
                                <button onClick={() => handleRemoveAddon(addon.id)} disabled={pending} className="text-luxe-border hover:text-red-400 transition-colors">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            {assigned.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {assigned.map(pro => {
                                  const isExcluded = excludedStaffIds.has(pro.id);
                                  return (
                                    <button
                                      key={pro.id}
                                      onClick={() => handleToggleExclusion(pro.id, addon.id, isExcluded)}
                                      disabled={pending}
                                      title={isExcluded ? `${pro.name} (${t('tap_to_exclude')})` : `${pro.name} (${t('tap_to_exclude')})`}
                                      className={`text-[10px] px-2 py-0.5 border rounded-sm transition-colors ${isExcluded ? 'border-red-800/60 bg-red-950/20 text-red-400 line-through' : 'border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream'}`}
                                    >
                                      {pro.name.split(' ')[0]}
                                    </button>
                                  );
                                })}
                                <span className="text-[9px] text-luxe-muted self-center ml-1 opacity-50">{t('tap_to_exclude')}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input value={addonForm.name} onChange={e => setAddonForms(prev => ({ ...prev, [svc.id]: { ...addonForm, name: e.target.value } }))} placeholder="French Tips" className="col-span-3 bg-luxe-bg border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream placeholder:text-luxe-border" />
                    <input type="number" min={0} value={addonForm.duration} onChange={e => setAddonForms(prev => ({ ...prev, [svc.id]: { ...addonForm, duration: e.target.value } }))} placeholder={t('duration_min')} className="bg-luxe-bg border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream" />
                    <input type="number" min={0} value={addonForm.price} onChange={e => setAddonForms(prev => ({ ...prev, [svc.id]: { ...addonForm, price: e.target.value } }))} placeholder={t('price_gel')} className="bg-luxe-bg border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream" />
                    <button onClick={() => handleAddAddon(svc.id)} disabled={pending || !addonForm.name.trim()} className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs border border-dashed border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors disabled:opacity-40">
                      <Plus size={11} /> {t('add')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="border border-luxe-border p-4 space-y-3">
          <p className="text-luxe-cream text-xs tracking-wider uppercase">{t('new_service')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-luxe-muted text-xs">{t('service_name')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Signature Cut & Style" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-luxe-muted text-xs">{t('tagline')}</label>
              <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short description" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">{t('duration_min')}</label>
              <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
            <div className="space-y-1">
              <label className="text-luxe-muted text-xs">{t('price_gel')}</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="120" className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-2 focus:outline-none focus:border-luxe-cream" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ name: '', tagline: '', duration: '60', price: '' }); }} className="px-4 py-2 text-xs border border-luxe-border text-luxe-muted hover:text-luxe-cream transition-colors">{t('cancel')}</button>
            <button onClick={handleAdd} disabled={pending} className="px-4 py-2 text-xs bg-luxe-cream text-luxe-bg hover:bg-luxe-accent transition-colors disabled:opacity-50">{t('add')}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-3 flex-1 border border-dashed border-luxe-border text-luxe-muted text-xs hover:border-luxe-cream hover:text-luxe-cream transition-colors">
            <Plus size={14} /> {t('add_service')}
          </button>
          {services.length > 0 && (
            <button onClick={handleSeedDemo} disabled={pending} className="px-4 py-3 border border-dashed border-luxe-border text-luxe-muted text-xs hover:border-amber-600 hover:text-amber-400 transition-colors disabled:opacity-40 whitespace-nowrap">
              {t('demo_addons')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
interface AdminDashboardProps {
  /** Legacy single-prop path (departmentId === salonId for original single-branch salons) */
  departmentId?: string;
  salonId?: string;
  initialBranchId?: string;
  initialBranches?: BranchRow[];
  showHeader?: boolean;
}

export default function AdminDashboard({
  departmentId: propDepartmentId,
  salonId,
  initialBranchId,
  initialBranches,
  showHeader = true,
}: AdminDashboardProps) {
  const { t, toggleLang, lang } = useLanguage();
  const resolvedSalonId = salonId ?? propDepartmentId ?? '';
  const [branches, setBranches] = useState<BranchRow[]>(initialBranches ?? []);
  const [activeBranch, setActiveBranch] = useState(initialBranchId ?? propDepartmentId ?? resolvedSalonId);
  const [tab, setTab] = useState<Tab>('today');

  // Branch picker overlay: show after login if multi-branch and no saved selection
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('mngr_active_branch');
    if ((initialBranches ?? []).length > 1 && !saved) {
      setShowBranchPicker(true);
    } else if (saved && (initialBranches ?? []).some(b => b.id === saved)) {
      setActiveBranch(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pickBranch(id: string) {
    setActiveBranch(id);
    localStorage.setItem('mngr_active_branch', id);
    setShowBranchPicker(false);
  }
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [services, setServices] = useState<DBService[]>([]);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [addons, setAddons] = useState<DBServiceAddon[]>([]);
  const [exclusions, setExclusions] = useState<AddonExclusion[]>([]);
  const [salon, setSalon] = useState<DBSalon | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [calendarVersion, setCalendarVersion] = useState(0);
  const [bookingVersion,  setBookingVersion]  = useState(0);
  const handleCalendarStatusChange = useCallback(() => setBookingVersion(v => v + 1), []);
  const [, startTransition] = useTransition();

  // activeBranch is always a string (fallback to empty string, server action will reject gracefully)
  const branchId = activeBranch ?? resolvedSalonId;

  // Fetch branches on first mount (only needed when not passed via SSR)
  useEffect(() => {
    if (initialBranches && initialBranches.length > 0) return;
    if (!resolvedSalonId) return;
    getSalonBranches(resolvedSalonId).then(setBranches).catch(() => {});
  }, [resolvedSalonId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStaff(branchId),
      getServices(branchId),
      getBookings(branchId),
      getSalonById(resolvedSalonId || branchId),
      getServiceAddons(branchId),
      getAddonExclusions(branchId),
    ]).then(([s, sv, b, sl, ad, ex]) => {
      if (cancelled) return;
      setStaff(s); setServices(sv); setBookings(b); setSalon(sl); setAddons(ad); setExclusions(ex);
    }).catch(e => {
      console.error('Admin data load failed', e);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [branchId, resolvedSalonId]);

  function handleStatusChange(id: string, status: BookingStatus) {
    const previous = bookings;
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    startTransition(async () => {
      const result = await updateBookingStatus(id, branchId, status);
      if (!result.ok) {
        alert('Failed to update status: ' + result.error);
        setBookings(previous);
      }
    });
  }

  function handleDeleteBooking(id: string) {
    setBookings(prev => prev.filter(b => b.id !== id));
    startTransition(async () => {
      try {
        await deleteBooking(id, branchId);
      } catch (e) {
        alert('Failed to delete booking: ' + String(e));
        const fresh = await getBookings(branchId);
        setBookings(fresh);
      }
    });
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'today',      label: t('tab_today'),      icon: <LayoutGrid size={16} /> },
    { id: 'calendar',   label: t('tab_calendar'),   icon: <Calendar size={16} /> },
    { id: 'bookings',   label: t('tab_bookings'),   icon: <List size={16} /> },
    { id: 'staff',      label: t('tab_staff'),      icon: <Users size={16} /> },
    { id: 'services',   label: t('tab_services'),   icon: <Scissors size={16} /> },
    { id: 'financials', label: t('tab_financials'), icon: <BarChart2 size={16} /> },
  ];

  return (
    <div className={showHeader ? 'min-h-screen bg-luxe-bg flex flex-col' : 'flex flex-col'}>

      {/* Branch picker overlay */}
      {showBranchPicker && (
        <div className="fixed inset-0 z-50 bg-luxe-bg flex items-center justify-center px-4 overflow-y-auto py-8">
          <div className="w-full max-w-md my-auto">
            <div className="text-center mb-8">
              <h1 className="text-xl font-display tracking-[0.3em] text-luxe-cream uppercase mb-2">
                {salon?.name ?? 'MNGR'}
              </h1>
              <p className="text-luxe-muted text-xs tracking-[0.25em] uppercase">{t('welcome_select_branch')}</p>
            </div>
            <div className="space-y-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => pickBranch(b.id)}
                  className="group w-full flex items-center justify-between border border-luxe-border bg-luxe-surface hover:border-luxe-cream/60 hover:bg-neutral-900 transition-all duration-200 p-5 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-luxe-cream font-medium tracking-wide group-hover:text-amber-200 transition-colors text-sm">
                      {b.name}
                    </p>
                    {(b.city || b.address) && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-luxe-muted text-xs">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{[b.city, b.address].filter(Boolean).join(' — ')}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-luxe-muted/40 group-hover:text-luxe-cream/70 text-lg ml-4 shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHeader && (
        <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
          <div>
            <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
            {salon && <p className="text-luxe-muted text-xs mt-0.5">{salon.name}</p>}
          </div>
          <div className="flex items-center gap-4">
            {branches.length > 1 && (
              <select
                value={activeBranch}
                onChange={e => {
                  const id = e.target.value;
                  setActiveBranch(id);
                  localStorage.setItem('mngr_active_branch', id);
                  setTab('today');
                }}
                className="bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream/60 max-w-[180px] truncate"
                title={t('switch_branch')}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
              title={lang === 'ka' ? 'Switch to English' : 'გადართვა ქართულზე'}
            >
              <Globe size={13} />
              {lang === 'ka' ? 'EN' : 'KA'}
            </button>
            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-2 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors">
                <LogOut size={14} /> {t('logout')}
              </button>
            </form>
          </div>
        </header>
      )}

      <nav className="flex items-center border-b border-luxe-border px-2 sm:px-6 overflow-x-auto scrollbar-none">
        <div className="flex flex-1">
          {tabs.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-xs tracking-wider uppercase whitespace-nowrap border-b-2 transition-colors ${
                tab === tb.id ? 'border-luxe-cream text-luxe-cream' : 'border-transparent text-luxe-muted hover:text-luxe-cream'
              }`}
            >
              {tb.icon}
              <span className="hidden sm:inline">{tb.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewBooking(true)}
          className="flex-shrink-0 flex items-center gap-1.5 ml-2 px-3 py-1.5 border border-luxe-border text-luxe-muted text-xs tracking-widest uppercase hover:border-luxe-cream hover:text-luxe-cream transition-colors whitespace-nowrap"
        >
          <Plus size={13} /><span className="hidden sm:inline">{t('new_booking')}</span><span className="sm:hidden">+</span>
        </button>
      </nav>

      <main className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto">
        {loading && <p className="text-luxe-muted text-sm text-center py-8">{t('loading')}</p>}
        {!loading && tab === 'today' && (
          <>
            {staff.length === 0 && services.length === 0 && (
              <SeedDemoButton branchId={branchId} onSeeded={() => {
                // Reload branch data after seeding
                Promise.all([getStaff(branchId), getServices(branchId)]).then(([s, sv]) => {
                  setStaff(s); setServices(sv);
                }).catch(() => {});
              }} />
            )}
            <TodayView bookings={bookings} services={services} professionals={staff} onStatusChange={handleStatusChange} />
          </>
        )}
        {!loading && tab === 'calendar' && (
          <DayCalendar departmentId={branchId} staff={staff} services={services} refreshKey={calendarVersion} onBookingStatusChange={handleCalendarStatusChange} />
        )}
        {!loading && tab === 'bookings' && <BookingsView bookings={bookings} professionals={staff} services={services} onStatusChange={handleStatusChange} onDelete={handleDeleteBooking} />}
        {!loading && tab === 'staff' && (
          <StaffView
            staff={staff} services={services} branchId={branchId}
            allAddons={addons} exclusions={exclusions}
            onAdd={p => setStaff(prev => [...prev, p])}
            onRemove={id => setStaff(prev => prev.filter(p => p.id !== id))}
            onHoursSaved={(id, raw) => setStaff(prev => prev.map(p => p.id === id ? { ...p, working_hours: raw } : p))}
            onSpecialtiesSaved={(id, raw) => setStaff(prev => prev.map(p => p.id === id ? { ...p, specialties: raw } : p))}
            onExclusionToggled={(staffId, addonId, excluded) =>
              setExclusions(prev =>
                excluded
                  ? [...prev, { staff_id: staffId, addon_id: addonId }]
                  : prev.filter(e => !(e.staff_id === staffId && e.addon_id === addonId))
              )
            }
          />
        )}
        {!loading && tab === 'services' && (
          <ServicesView
            services={services} staff={staff} branchId={branchId}
            allAddons={addons} exclusions={exclusions}
            onAdd={s => setServices(prev => [...prev, s])}
            onRemove={id => setServices(prev => prev.filter(s => s.id !== id))}
            onBufferSaved={(id, buffer) => setServices(prev => prev.map(s => s.id === id ? { ...s, buffer } : s))}
            onAddonAdded={addon => setAddons(prev => [...prev, addon])}
            onAddonRemoved={id => setAddons(prev => prev.filter(a => a.id !== id))}
            onExclusionToggled={(staffId, addonId, excluded) =>
              setExclusions(prev =>
                excluded
                  ? [...prev, { staff_id: staffId, addon_id: addonId }]
                  : prev.filter(e => !(e.staff_id === staffId && e.addon_id === addonId))
              )
            }
            onDemoSeeded={freshAddons => setAddons(freshAddons)}
          />
        )}
        {tab === 'financials' && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-sm font-medium text-neutral-200 tracking-wide">{t('financial_overview')}</h2>
              <p className="text-[11px] text-neutral-600 mt-0.5">{t('financial_overview_sub')}</p>
            </div>
            <FinancialsTab
              departmentId={branchId}
              bookingVersion={bookingVersion}
              salonId={resolvedSalonId}
              branches={branches}
            />
          </div>
        )}
      </main>

      {showNewBooking && staff.length > 0 && services.length > 0 && (
        <NewBookingModal
          departmentId={branchId}
          staff={staff}
          services={services}
          addons={addons}
          exclusions={exclusions}
          onClose={() => {
            setShowNewBooking(false);
            setCalendarVersion(v => v + 1);
            setBookingVersion(v => v + 1);
          }}
          onCreated={booking => {
            setBookings(prev => [booking, ...prev]);
          }}
        />
      )}
    </div>
  );
}
