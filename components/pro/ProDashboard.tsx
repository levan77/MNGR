'use client';

import { useState, useTransition } from 'react';
import { LogOut, Calendar, Clock, BarChart2, User, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import { getStaffBookings, getStaffFinancials, type DBStaff, type DBBooking } from '@/app/admin/actions';
import { useLanguage, LanguageProvider } from '@/lib/LanguageContext';
import { localDateString, getWeekDays, formatShortDate } from '@/lib/dates';

type Tab = 'today' | 'week' | 'earnings' | 'profile';

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Props {
  profile: DBStaff;
  todayBookings: DBBooking[];
  staffId: string;
  departmentId: string;
}

function ProDashboardInner({ profile, todayBookings: initialToday, staffId, departmentId }: Props) {
  const { t, lang, setLang } = useLanguage();
  const [tab, setTab] = useState<Tab>('today');
  const [todayBookings] = useState<DBBooking[]>(initialToday);

  // Week state
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekBookings, setWeekBookings] = useState<DBBooking[]>([]);
  const [weekLoaded, setWeekLoaded] = useState(false);
  const [, startWeekTransition] = useTransition();

  // Earnings state
  const today = localDateString();
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [earningsStart, setEarningsStart] = useState(firstOfMonth);
  const [earningsEnd, setEarningsEnd] = useState(today);
  const [financials, setFinancials] = useState<{ payout: number; revenue: number; completed: number; margin: number } | null>(null);
  const [earningsLoaded, setEarningsLoaded] = useState(false);
  const [, startEarningsTransition] = useTransition();

  function loadWeek() {
    const base = localDateString();
    const start = addDays(base, weekOffset * 7);
    const end = addDays(base, weekOffset * 7 + 6);
    startWeekTransition(async () => {
      const bookings = await getStaffBookings(staffId, departmentId, start, end);
      setWeekBookings(bookings);
      setWeekLoaded(true);
    });
  }

  function loadEarnings() {
    startEarningsTransition(async () => {
      const data = await getStaffFinancials(staffId, departmentId, earningsStart, earningsEnd);
      setFinancials(data);
      setEarningsLoaded(true);
    });
  }

  function switchTab(next: Tab) {
    setTab(next);
    if (next === 'week' && !weekLoaded) loadWeek();
    if (next === 'earnings' && !earningsLoaded) loadEarnings();
  }

  const weekDays = getWeekDays(addDays(localDateString(), weekOffset * 7));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'today', label: t('today_appointments'), icon: <Clock size={14} /> },
    { key: 'week', label: t('this_week'), icon: <Calendar size={14} /> },
    { key: 'earnings', label: t('my_earnings'), icon: <BarChart2 size={14} /> },
    { key: 'profile', label: t('my_profile'), icon: <User size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-luxe-bg text-luxe-cream font-light">
      {/* Header */}
      <header className="border-b border-luxe-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-luxe-cream text-sm tracking-wide">{profile.name}</p>
          <p className="text-luxe-muted text-xs">{profile.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'en' ? 'ka' : 'en')}
            className="flex items-center gap-1 text-luxe-muted hover:text-luxe-cream transition-colors text-xs"
          >
            <Globe size={14} /> {lang === 'en' ? 'GEO' : 'ENG'}
          </button>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-1.5 text-luxe-muted hover:text-red-400 transition-colors text-xs">
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </header>

      {/* Tab strip */}
      <div className="border-b border-luxe-border overflow-x-auto scrollbar-none">
        <div className="flex min-w-max">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? 'border-luxe-cream text-luxe-cream'
                  : 'border-transparent text-luxe-muted hover:text-luxe-cream'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Today */}
        {tab === 'today' && (
          <div className="space-y-3">
            <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('today_appointments')} — {formatShortDate(localDateString())}</p>
            {todayBookings.length === 0 ? (
              <p className="text-luxe-muted text-sm py-8 text-center">{t('no_appointments_today')}</p>
            ) : (
              todayBookings.map(b => <BookingCard key={b.id} booking={b} />)
            )}
          </div>
        )}

        {/* Week */}
        {tab === 'week' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => { setWeekOffset(o => o - 1); setWeekLoaded(false); setTimeout(loadWeek, 0); }} className="p-1 text-luxe-muted hover:text-luxe-cream transition-colors"><ChevronLeft size={16} /></button>
              <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('this_week')}</p>
              <button onClick={() => { setWeekOffset(o => o + 1); setWeekLoaded(false); setTimeout(loadWeek, 0); }} className="p-1 text-luxe-muted hover:text-luxe-cream transition-colors"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => {
                const count = weekBookings.filter(b => b.date === day).length;
                const isToday = day === localDateString();
                return (
                  <div key={day} className={`text-center p-2 border ${isToday ? 'border-luxe-cream' : 'border-luxe-border'}`}>
                    <p className="text-luxe-muted text-[10px]">{formatShortDate(day).slice(0, 5)}</p>
                    {count > 0 ? (
                      <p className="text-luxe-cream text-sm font-medium mt-1">{count}</p>
                    ) : (
                      <p className="text-luxe-border text-xs mt-1">—</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              {weekDays.map(day => {
                const dayBookings = weekBookings.filter(b => b.date === day);
                if (!dayBookings.length) return null;
                return (
                  <div key={day}>
                    <p className="text-luxe-muted text-[10px] uppercase tracking-wider mb-1">{formatShortDate(day)}</p>
                    {dayBookings.map(b => <BookingCard key={b.id} booking={b} />)}
                  </div>
                );
              })}
              {weekBookings.length === 0 && weekLoaded && (
                <p className="text-luxe-muted text-sm text-center py-6">{t('no_appointments_today')}</p>
              )}
            </div>
          </div>
        )}

        {/* Earnings */}
        {tab === 'earnings' && (
          <div className="space-y-4">
            <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('my_earnings')}</p>
            <div className="flex gap-2 flex-wrap items-end">
              <div className="space-y-1">
                <label className="text-luxe-muted text-[10px] uppercase tracking-wider">From</label>
                <input
                  type="date"
                  value={earningsStart}
                  onChange={e => { setEarningsStart(e.target.value); setEarningsLoaded(false); }}
                  className="bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                />
              </div>
              <div className="space-y-1">
                <label className="text-luxe-muted text-[10px] uppercase tracking-wider">To</label>
                <input
                  type="date"
                  value={earningsEnd}
                  onChange={e => { setEarningsEnd(e.target.value); setEarningsLoaded(false); }}
                  className="bg-luxe-surface border border-luxe-border text-luxe-cream text-xs px-3 py-1.5 focus:outline-none focus:border-luxe-cream"
                />
              </div>
              <button
                onClick={loadEarnings}
                className="px-4 py-1.5 text-xs border border-luxe-border text-luxe-muted hover:border-luxe-cream hover:text-luxe-cream transition-colors"
              >
                {lang === 'ka' ? 'ჩვენება' : 'Show'}
              </button>
            </div>
            {earningsLoaded && financials && (
              <div className="grid grid-cols-2 gap-3">
                <StatCard label={t('my_payout')} value={`₾${financials.payout.toFixed(0)}`} />
                <StatCard label={t('my_revenue')} value={`₾${financials.revenue.toFixed(0)}`} />
                <StatCard label={t('bookings_completed')} value={String(financials.completed)} />
                <StatCard label="Margin" value={`${financials.margin.toFixed(1)}%`} />
              </div>
            )}
            {earningsLoaded && !financials && (
              <p className="text-luxe-muted text-sm text-center py-6">{t('no_appointments_today')}</p>
            )}
          </div>
        )}

        {/* Profile */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('my_profile')}</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-luxe-surface border border-luxe-border flex items-center justify-center text-luxe-muted text-sm">
                {profile.avatar}
              </div>
              <div>
                <p className="text-luxe-cream">{profile.name}</p>
                <p className="text-luxe-muted text-xs">{profile.title}</p>
              </div>
            </div>
            <div className="border border-luxe-border p-4 space-y-2">
              <p className="text-luxe-muted text-xs uppercase tracking-wider">{t('working_hours')}</p>
              <WorkingHoursDisplay raw={profile.working_hours} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking }: { booking: DBBooking }) {
  const statusColor = booking.status === 'completed' ? 'text-emerald-400' : booking.status === 'no_show' ? 'text-red-400' : 'text-luxe-muted';
  return (
    <div className="border border-luxe-border p-3 flex items-center gap-3">
      <div className="text-luxe-muted text-xs w-12 shrink-0">{booking.time}</div>
      <div className="flex-1 min-w-0">
        <p className="text-luxe-cream text-xs truncate">{booking.client_name}</p>
        <p className="text-luxe-muted text-[10px] truncate">{booking.reference}</p>
      </div>
      <span className={`text-[10px] uppercase tracking-wider shrink-0 ${statusColor}`}>{booking.status}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-luxe-border p-4">
      <p className="text-luxe-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-luxe-cream text-2xl mt-1">{value}</p>
    </div>
  );
}

function WorkingHoursDisplay({ raw }: { raw: string }) {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let hours: (null | { s: string; e: string })[] = [];
  try { hours = JSON.parse(raw); } catch { return null; }
  return (
    <div className="space-y-1">
      {hours.map((h, i) => (
        <div key={i} className="flex gap-3 text-xs">
          <span className="text-luxe-muted w-8">{DAY_NAMES[i]}</span>
          {h ? <span className="text-luxe-cream">{h.s} – {h.e}</span> : <span className="text-luxe-border">Off</span>}
        </div>
      ))}
    </div>
  );
}

export default function ProDashboard(props: Props) {
  return (
    <LanguageProvider>
      <ProDashboardInner {...props} />
    </LanguageProvider>
  );
}
