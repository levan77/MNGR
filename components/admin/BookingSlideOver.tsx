'use client';

import { useEffect, useTransition } from 'react';
import {
  X, Phone, Hash, Clock, Scissors, User,
  CalendarCheck, CheckCircle2, UserX, XCircle,
} from 'lucide-react';
import { formatLongDate } from '@/lib/dates';
import { updateBookingStatus } from '@/app/admin/actions';
import type { DBBookingDetail } from '@/app/admin/actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

interface BookingSlideOverProps {
  booking: DBBookingDetail | null;
  departmentId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, {
  label: string;
  icon: React.ReactNode;
  active: string;
  idle: string;
}> = {
  scheduled: {
    label: 'Scheduled',
    icon: <CalendarCheck size={15} />,
    active: 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-amber-500/20 shadow-inner',
    idle:   'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-amber-600 hover:text-amber-300 transition-colors',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 size={15} />,
    active: 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-emerald-500/20 shadow-inner',
    idle:   'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-emerald-600 hover:text-emerald-300 transition-colors',
  },
  no_show: {
    label: 'No Show',
    icon: <UserX size={15} />,
    active: 'bg-red-700/20 border-red-600 text-red-400 shadow-red-600/20 shadow-inner',
    idle:   'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-red-700 hover:text-red-400 transition-colors',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle size={15} />,
    active: 'bg-neutral-800 border-neutral-500 text-neutral-300 shadow-inner',
    idle:   'bg-neutral-900 border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition-colors',
  },
};

const STATUS_ORDER: BookingStatus[] = ['scheduled', 'completed', 'no_show', 'cancelled'];

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-neutral-800/60">
      <span className="text-neutral-600 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm text-neutral-200 break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingSlideOver({
  booking,
  departmentId,
  onClose,
  onStatusChange,
}: BookingSlideOverProps) {
  const [pending, startTransition] = useTransition();
  const open = booking !== null;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleStatus(status: BookingStatus) {
    if (!booking || booking.status === status || pending) return;
    // Optimistic update
    onStatusChange(booking.id, status);
    startTransition(async () => {
      const result = await updateBookingStatus(booking.id, departmentId, status);
      if (!result.ok) {
        // Revert on failure
        onStatusChange(booking.id, booking.status as BookingStatus);
        alert(result.error);
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-neutral-950 border-l border-neutral-800
          flex flex-col shadow-2xl shadow-black/60
          transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest">Appointment</p>
            <p className="text-sm text-neutral-100 font-medium mt-0.5 tracking-wide">
              {booking?.reference ?? '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800 rounded-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {booking && (
          <div className="flex-1 overflow-y-auto px-5 py-2">

            {/* Client info */}
            <DetailRow icon={<User size={14} />}    label="Client"     value={booking.client_name} />
            <DetailRow icon={<Phone size={14} />}   label="Phone"      value={booking.client_phone} />
            <DetailRow icon={<Hash size={14} />}    label="Reference"  value={booking.reference} />

            {/* Appointment info */}
            <div className="mt-1">
              <DetailRow
                icon={<CalendarCheck size={14} />}
                label="Date & Time"
                value={`${formatLongDate(booking.date)} at ${booking.time}`}
              />
              <DetailRow icon={<Scissors size={14} />} label="Service"      value={booking.service_name} />
              <DetailRow icon={<User size={14} />}     label="Professional" value={booking.professional_name} />
              <DetailRow
                icon={<Clock size={14} />}
                label="Duration & Price"
                value={`${booking.service_duration} min · ₾${booking.service_price}`}
              />
            </div>

            {/* Status buttons */}
            <div className="mt-6">
              <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3">Update Status</p>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_ORDER.map(status => {
                  const cfg     = STATUS_CONFIG[status];
                  const isActive = booking.status === status;
                  return (
                    <button
                      key={status}
                      disabled={isActive || pending}
                      onClick={() => handleStatus(status)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-[11px] tracking-wider font-medium
                        disabled:cursor-default
                        ${isActive ? cfg.active : cfg.idle}
                        ${pending && !isActive ? 'opacity-40' : ''}
                      `}
                    >
                      {cfg.icon}
                      {cfg.label}
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pending overlay hint */}
            {pending && (
              <p className="text-center text-[10px] text-neutral-600 tracking-widest uppercase mt-4">
                Saving…
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-800">
          <p className="text-[10px] text-neutral-700 text-center tracking-wider">
            Changes are saved instantly to D1
          </p>
        </div>
      </div>
    </>
  );
}
