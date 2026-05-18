'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { localDateString, timeToMinutes, getDayOfWeek, minutesToTime, formatDateDMY } from '@/lib/dates';
import { type WorkingHours, parseWorkingHours, bookingAddonDuration } from '@/lib/data';
import { type DBStaff, type DBService, type DBBookingDetail, getBookingsForDay } from '@/app/admin/actions';
import BookingSlideOver from './BookingSlideOver';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_START = 9 * 60;   // 09:00 in minutes
const GRID_END   = 19 * 60;  // 19:00 in minutes
const SLOT_MINS  = 15;
const ROW_H      = 48;       // px per 15-min slot
const TOTAL_ROWS = (GRID_END - GRID_START) / SLOT_MINS; // 40 rows
const GRID_H     = TOTAL_ROWS * ROW_H;                  // 1920 px

type ViewMode = 'professional' | 'service';

// ─── Helpers ─────────────────────────────────────────────────────────────────


const TIME_LABELS = Array.from({ length: TOTAL_ROWS + 1 }, (_, i) =>
  minutesToTime(GRID_START + i * SLOT_MINS),
);

function bookingTop(time: string): number {
  return ((timeToMinutes(time) - GRID_START) / SLOT_MINS) * ROW_H;
}

function bookingCardHeight(duration: number): number {
  return Math.max(ROW_H, (duration / SLOT_MINS) * ROW_H);
}

function bufferPxHeight(buffer: number): number {
  return (buffer / SLOT_MINS) * ROW_H;
}

/** Returns pixel ranges (top, height) that are OUTSIDE working hours for this column. */
function getOffRanges(
  staffMember: DBStaff | null,
  dayIndex: number,
): Array<{ top: number; height: number }> {
  if (!staffMember) return [];

  const hours = parseWorkingHours(staffMember.working_hours);
  if (!hours) return [];

  const dayHours = hours[dayIndex]; // null = day off

  // Entire day off → shade the whole grid
  if (!dayHours) return [{ top: 0, height: GRID_H }];

  const workStart = timeToMinutes(dayHours.s);
  const workEnd   = timeToMinutes(dayHours.e);
  const ranges: Array<{ top: number; height: number }> = [];

  if (workStart > GRID_START) {
    const h = ((workStart - GRID_START) / SLOT_MINS) * ROW_H;
    ranges.push({ top: 0, height: h });
  }

  if (workEnd < GRID_END) {
    const top = ((workEnd - GRID_START) / SLOT_MINS) * ROW_H;
    const h   = ((GRID_END - workEnd) / SLOT_MINS) * ROW_H;
    ranges.push({ top, height: h });
  }

  return ranges;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  scheduled: { bg: 'bg-blue-950',    border: 'border-blue-700',    text: 'text-blue-200'    },
  completed: { bg: 'bg-emerald-950', border: 'border-emerald-700', text: 'text-emerald-200' },
};

function getColor(status: string) {
  return STATUS_COLORS[status] ?? { bg: 'bg-neutral-900', border: 'border-neutral-700', text: 'text-neutral-300' };
}

// ─── Buffer Strip ─────────────────────────────────────────────────────────────

const STRIPE_STYLE: React.CSSProperties = {
  background: `repeating-linear-gradient(
    45deg,
    transparent,
    transparent 4px,
    rgba(255,255,255,0.04) 4px,
    rgba(255,255,255,0.04) 8px
  )`,
};

// ─── Booking Block ────────────────────────────────────────────────────────────

function BookingBlock({
  booking, mode, webOnly, onClick,
}: {
  booking: DBBookingDetail;
  mode: ViewMode;
  webOnly: boolean;
  onClick: (b: DBBookingDetail) => void;
}) {
  const addonDur = bookingAddonDuration(booking.addons);
  const top      = bookingTop(booking.time);
  const cardH    = bookingCardHeight(booking.service_duration + addonDur);
  const bufferH  = bufferPxHeight(booking.service_buffer + (booking.staff_buffer_extra ?? 0));
  const colors   = getColor(booking.status);
  const short    = cardH < 64;
  const isOnline = booking.reference.startsWith('ATL-');
  const dimmed   = webOnly && !isOnline;

  return (
    // Outer wrapper: spans card + buffer, handles opacity dimming
    <div
      className={`absolute inset-x-0.5 transition-opacity duration-200 ${dimmed ? 'opacity-30' : 'opacity-100'}`}
      style={{ top, height: cardH + bufferH }}
    >
      {/* ── Main booking card (clickable) ── */}
      <button
        onClick={() => onClick(booking)}
        className={`absolute inset-x-0 top-0 rounded-t-sm border text-left
          ${colors.bg} ${colors.border} px-1.5 py-1 overflow-hidden
          hover:brightness-125 hover:z-10 transition-[filter] duration-150
          focus:outline-none focus:ring-1 focus:ring-white/20`}
        style={{ height: cardH }}
      >
        <p className={`text-[11px] font-medium leading-tight truncate ${colors.text}`}>
          {booking.client_name}
        </p>
        {!short && (
          <>
            <p className="text-[10px] text-neutral-400 truncate leading-tight mt-0.5">
              {mode === 'professional' ? booking.service_name : booking.professional_name}
            </p>
            <p className="text-[10px] text-neutral-500 leading-tight">
              {booking.time} · {booking.service_duration + addonDur}m
            </p>
          </>
        )}
      </button>

      {/* ── Buffer strip (diagonal stripes, non-clickable) ── */}
      {bufferH > 0 && (
        <div
          className={`absolute inset-x-0 bottom-0 rounded-b-sm border-l border-r border-b ${colors.border} border-opacity-40`}
          style={{ height: bufferH, ...STRIPE_STYLE }}
          title={`${booking.service_buffer + (booking.staff_buffer_extra ?? 0)}m buffer`}
        >
          {bufferH >= 20 && (
            <BufferLabel />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Buffer Label ─────────────────────────────────────────────────────────────

function BufferLabel() {
  const { t } = useLanguage();
  return (
    <p className="text-[9px] text-neutral-600 text-center leading-none pt-1 select-none">
      {t('buffer_strip')}
    </p>
  );
}

// ─── Working Hours Overlay ────────────────────────────────────────────────────

function OffHoursOverlay({ ranges }: { ranges: Array<{ top: number; height: number }> }) {
  return (
    <>
      {ranges.map((r, i) => (
        <div
          key={i}
          className="absolute inset-x-0 bg-neutral-900/80 pointer-events-none z-[1]"
          style={{ top: r.top, height: r.height }}
        />
      ))}
    </>
  );
}

// ─── Grid Column ─────────────────────────────────────────────────────────────

function GridColumn({
  bookings, mode, webOnly, staffMember, dayIndex, onBookingClick,
}: {
  bookings: DBBookingDetail[];
  mode: ViewMode;
  webOnly: boolean;
  staffMember: DBStaff | null;
  dayIndex: number;
  onBookingClick: (b: DBBookingDetail) => void;
}) {
  const offRanges = getOffRanges(staffMember, dayIndex);

  return (
    <div className="flex-1 min-w-[120px] border-l border-neutral-800 relative" style={{ height: GRID_H }}>
      {/* Off-hours background — rendered first, below everything */}
      <OffHoursOverlay ranges={offRanges} />

      {/* Row dividers */}
      {Array.from({ length: TOTAL_ROWS }, (_, i) => (
        <div
          key={i}
          className={`absolute inset-x-0 border-b ${i % 4 === 0 ? 'border-neutral-700' : 'border-neutral-800/50'}`}
          style={{ top: i * ROW_H, height: ROW_H }}
        />
      ))}

      {/* Current time indicator */}
      <CurrentTimeLine />

      {/* Bookings */}
      {bookings.map(b => (
        <BookingBlock
          key={b.id}
          booking={b}
          mode={mode}
          webOnly={webOnly}
          onClick={onBookingClick}
        />
      ))}

      {bookings.length === 0 && offRanges.length === 0 && (
        <EmptyLabel />
      )}
    </div>
  );
}

// ─── Current Time Red Line ────────────────────────────────────────────────────

function CurrentTimeLine() {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    function calc() {
      const now  = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins < GRID_START || mins > GRID_END) { setTop(null); return; }
      setTop(((mins - GRID_START) / SLOT_MINS) * ROW_H);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  if (top === null) return null;

  return (
    <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top }}>
      <div className="h-px bg-red-500 w-full" />
      <div className="w-1.5 h-1.5 rounded-full bg-red-500 absolute -left-0.5 -top-0.5" />
    </div>
  );
}

// ─── Empty Label ─────────────────────────────────────────────────────────────

function EmptyLabel() {
  const { t } = useLanguage();
  return (
    <p className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-700 tracking-wider uppercase select-none z-[2]">
      {t('empty_column')}
    </p>
  );
}

// ─── Time Gutter ─────────────────────────────────────────────────────────────

function TimeGutter() {
  return (
    <div className="w-14 shrink-0 relative" style={{ height: GRID_H }}>
      {TIME_LABELS.map((label, i) => (
        <div
          key={label}
          className="absolute right-2 text-[10px] text-neutral-600 leading-none -translate-y-1/2"
          style={{ top: i * ROW_H }}
        >
          {i % 4 === 0 ? label : ''}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DayCalendarProps {
  departmentId: string;
  staff: DBStaff[];
  services: DBService[];
  refreshKey?: number;
  onBookingStatusChange?: () => void;
}

export default function DayCalendar({ departmentId, staff, services, refreshKey = 0, onBookingStatusChange }: DayCalendarProps) {
  const { t } = useLanguage();
  const [viewMode, setViewMode]    = useState<ViewMode>('professional');
  const [date, setDate]            = useState(localDateString());
  const [webOnly, setWebOnly]      = useState(false);
  const [bookings, setBookings]    = useState<DBBookingDetail[]>([]);
  const [selected, setSelected]    = useState<DBBookingDetail | null>(null);
  const [loading, startTransition] = useTransition();

  const dayIndex = getDayOfWeek(date);

  const handleBookingClick  = useCallback((b: DBBookingDetail) => setSelected(b), []);
  const handleSlideOverClose = useCallback(() => setSelected(null), []);

  const handleStatusChange = useCallback((id: string, status: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
    onBookingStatusChange?.();
  }, [onBookingStatusChange]);

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getBookingsForDay(departmentId, date);
        setBookings(data);
      } catch (e) {
        console.error('DayCalendar fetch failed', e);
      }
    });
  }, [departmentId, date, refreshKey]);

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(localDateString(d));
  }

  // ── Build columns ──────────────────────────────────────────────────────────
  type Column = {
    id: string;
    label: string;
    bookings: DBBookingDetail[];
    staffMember: DBStaff | null; // for working-hours overlay (professional mode only)
  };

  const columns: Column[] = viewMode === 'professional'
    ? staff.map(p => ({
        id:          p.id,
        label:       p.name,
        bookings:    bookings.filter(b => b.professional_id === p.id),
        staffMember: p,
      }))
    : services.map(svc => ({
        id:          svc.id,
        label:       svc.name,
        bookings:    bookings.filter(b => b.service_id === svc.id),
        staffMember: null, // no single staff owner in service view
      }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-black rounded-sm border border-neutral-800 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 gap-4 flex-wrap">

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 text-neutral-500 hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setDate(localDateString())}
            className="text-sm text-neutral-300 hover:text-white transition-colors min-w-[180px] text-center"
          >
            {formatDateDMY(date)}
          </button>
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 text-neutral-500 hover:text-neutral-100 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Web Only toggle */}
          <button
            onClick={() => setWebOnly(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] tracking-wider uppercase transition-colors ${
              webOnly
                ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300'
            }`}
            title="Show only online bookings (ATL- reference)"
          >
            <Globe size={13} />
            {t('web_only')}
            {/* Pill indicator */}
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${webOnly ? 'bg-blue-400' : 'bg-neutral-700'}`} />
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-sm p-0.5">
            {(['professional', 'service'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[11px] tracking-wider uppercase transition-colors rounded-sm ${
                  viewMode === mode
                    ? 'bg-neutral-100 text-black font-medium'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {mode === 'professional' ? t('professional_mode') : t('service_mode')}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <span className="text-[10px] text-neutral-600 tracking-widest uppercase">Loading…</span>
        )}
      </div>

      {/* ── Column headers ── */}
      <div className="flex border-b border-neutral-800 bg-neutral-950">
        <div className="w-14 shrink-0" />
        {columns.map(col => (
          <div
            key={col.id}
            className="flex-1 min-w-[120px] border-l border-neutral-800 px-2 py-2.5 text-center"
          >
            <p className="text-[11px] tracking-wider uppercase text-neutral-400 truncate">{col.label}</p>
            <p className="text-[10px] text-neutral-600 mt-0.5">
              {col.bookings.length} {col.bookings.length !== 1 ? t('appts') : t('appt')}
            </p>
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="overflow-auto">
        <div className="flex" style={{ minWidth: 56 + columns.length * 120 }}>
          <TimeGutter />
          {columns.map(col => (
            <GridColumn
              key={col.id}
              bookings={col.bookings}
              mode={viewMode}
              webOnly={webOnly}
              staffMember={col.staffMember}
              dayIndex={dayIndex}
              onBookingClick={handleBookingClick}
            />
          ))}
        </div>
      </div>

      {/* ── Slide-over ── */}
      <BookingSlideOver
        booking={selected}
        departmentId={departmentId}
        onClose={handleSlideOverClose}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
