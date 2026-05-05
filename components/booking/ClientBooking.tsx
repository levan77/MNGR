'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Phone, Clock, Star } from 'lucide-react';
import {
  ALL_TIME_SLOTS,
  type WorkingHours,
} from '@/lib/data';
import { localDateString, getWeekDays, formatShortDate, formatLongDate, getDayOfWeek, timeToMinutes } from '@/lib/dates';
import { isValidName, isValidPhone, formatPhone } from '@/lib/validation';
import {
  publicGetServices, publicGetStaff, publicGetBookings, publicCreateBooking,
} from '@/app/booking/actions';
import type { DBService, DBStaff, DBBooking } from '@/app/admin/actions';

type Step = 1 | 2 | 3 | 4 | 5;

export type BookingSalon = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
};

type ConfirmedBooking = {
  reference: string;
  service: DBService;
  professional: DBStaff;
  salon: BookingSalon;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
};

function generateRef() {
  return 'ATL-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getAvailableSlots(
  staffHours: WorkingHours[] | null,
  service: DBService,
  bookings: DBBooking[],
  professionalId: string,
  date: string,
  services: DBService[],
): string[] {
  if (!staffHours) return [];
  const dow = getDayOfWeek(date);
  const hours = staffHours[dow];
  if (!hours) return [];

  const workStart = timeToMinutes(hours.s);
  const workEnd = timeToMinutes(hours.e);
  const totalDuration = service.duration + service.buffer;

  const occupied = bookings
    .filter(b => b.professional_id === professionalId && b.date === date)
    .map(b => {
      const svc = services.find(s => s.id === b.service_id);
      const start = timeToMinutes(b.time);
      const end = start + (svc ? svc.duration + svc.buffer : 60);
      return { start, end };
    });

  const today = localDateString();
  const nowMins = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  return ALL_TIME_SLOTS.filter(slot => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + totalDuration;
    if (slotStart < workStart || slotEnd > workEnd) return false;
    if (slotStart < nowMins) return false;
    return !occupied.some(o => slotStart < o.end && slotEnd > o.start);
  });
}

// ─── Step 1: Service ──────────────────────────────────────────────────────────
function StepService({
  services, loading, onSelect,
}: {
  services: DBService[];
  loading: boolean;
  onSelect: (s: DBService) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 1 of 4</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Service</h2>
      </div>
      {loading ? (
        <p className="text-luxe-muted text-center py-8 text-sm">Loading services…</p>
      ) : services.length === 0 ? (
        <p className="text-luxe-muted text-center py-8 text-sm">No services available yet.</p>
      ) : (
        <div className="grid gap-3">
          {services.map(svc => (
            <button
              key={svc.id}
              onClick={() => onSelect(svc)}
              className="flex items-start justify-between gap-4 p-5 border border-luxe-border hover:border-luxe-cream text-left transition-colors duration-150 group"
            >
              <div className="space-y-1">
                <p className="text-luxe-cream font-medium tracking-wide">{svc.name}</p>
                {svc.tagline && <p className="text-luxe-muted text-sm">{svc.tagline}</p>}
                <div className="flex items-center gap-3 pt-1">
                  <span className="flex items-center gap-1 text-luxe-muted text-xs">
                    <Clock size={12} /> {svc.duration} min
                  </span>
                </div>
              </div>
              <span className="text-luxe-accent text-lg font-light whitespace-nowrap">₾ {svc.price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Professional ─────────────────────────────────────────────────────
function StepProfessional({
  staff, loading, onSelect, onBack,
}: {
  staff: DBStaff[];
  loading: boolean;
  onSelect: (p: DBStaff) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 2 of 4</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Professional</h2>
      </div>
      {loading ? (
        <p className="text-luxe-muted text-center py-8 text-sm">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-luxe-muted text-center py-8 text-sm">No professionals available.</p>
      ) : (
        <div className="grid gap-3">
          {staff.map(pro => (
            <button
              key={pro.id}
              onClick={() => onSelect(pro)}
              className="flex items-center gap-4 p-5 border border-luxe-border hover:border-luxe-cream text-left transition-colors duration-150 group"
            >
              <div className="w-12 h-12 rounded-full bg-luxe-surface border border-luxe-border flex items-center justify-center text-luxe-muted text-xs font-medium shrink-0">
                {pro.avatar}
              </div>
              <div>
                <p className="text-luxe-cream font-medium tracking-wide">{pro.name}</p>
                <p className="text-luxe-muted text-sm">{pro.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={10} className="fill-luxe-accent text-luxe-accent" />)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  );
}

// ─── Step 3: Schedule ─────────────────────────────────────────────────────────
function StepSchedule({
  professional, service, services, salonId, onSelect, onBack,
}: {
  professional: DBStaff;
  service: DBService;
  services: DBService[];
  salonId: string;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}) {
  const today = localDateString();
  const [weekStart, setWeekStart] = useState(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const days = getWeekDays(weekStart);

  useEffect(() => {
    setLoadingBookings(true);
    publicGetBookings(salonId, professional.id)
      .then(setBookings)
      .finally(() => setLoadingBookings(false));
  }, [salonId, professional.id]);

  let staffHours: WorkingHours[] | null = null;
  try { staffHours = JSON.parse(professional.working_hours) as WorkingHours[]; } catch {}

  const slots = selectedDate
    ? getAvailableSlots(staffHours, service, bookings, professional.id, selectedDate, services)
    : [];

  function shiftWeek(n: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + n * 7);
    const next = localDateString(d);
    if (n < 0 && next < today) return;
    setWeekStart(next);
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 3 of 4</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Date & Time</h2>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="p-2 text-luxe-muted hover:text-luxe-cream transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="grid grid-cols-7 gap-1 flex-1 mx-4">
          {days.map(day => {
            const isSelected = selectedDate === day;
            const isPast = day < today;
            return (
              <button
                key={day}
                disabled={isPast}
                onClick={() => setSelectedDate(day)}
                className={[
                  'flex flex-col items-center py-2 px-1 text-xs transition-colors border',
                  isPast ? 'opacity-30 cursor-not-allowed border-transparent' :
                    isSelected ? 'border-luxe-cream text-luxe-cream' :
                      'border-luxe-border text-luxe-muted hover:border-luxe-muted hover:text-luxe-cream',
                ].join(' ')}
              >
                <span className="uppercase tracking-wider">
                  {new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className="font-medium mt-0.5">{new Date(day + 'T00:00:00').getDate()}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => shiftWeek(1)} className="p-2 text-luxe-muted hover:text-luxe-cream transition-colors">
          <ArrowRight size={16} />
        </button>
      </div>

      {selectedDate && (
        <div className="space-y-3">
          <p className="text-luxe-muted text-xs tracking-widest uppercase text-center">
            {formatShortDate(selectedDate)}
          </p>
          {loadingBookings ? (
            <p className="text-luxe-muted text-center py-4 text-sm">Loading availability…</p>
          ) : slots.length === 0 ? (
            <p className="text-luxe-muted text-center py-4 text-sm">No availability on this day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map(slot => (
                <button
                  key={slot}
                  onClick={() => onSelect(selectedDate, slot)}
                  className="py-2.5 border border-luxe-border text-luxe-muted text-sm hover:border-luxe-cream hover:text-luxe-cream transition-colors"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  );
}

// ─── Step 4: Details ──────────────────────────────────────────────────────────
function StepDetails({
  onConfirm, onBack, submitting, error,
}: {
  onConfirm: (name: string, phone: string) => void;
  onBack: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!isValidName(name)) errs.name = 'Please enter your full name (first and last).';
    if (!isValidPhone(phone)) errs.phone = 'Please enter a valid phone number (e.g. +995599123456).';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onConfirm(name.trim(), formatPhone(phone));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 4 of 4</p>
        <h2 className="text-2xl font-display tracking-wider">Your Details</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-luxe-muted text-xs tracking-wider uppercase">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
            placeholder="e.g. Sophie Williams"
            className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream px-4 py-3 text-sm placeholder:text-luxe-muted focus:outline-none focus:border-luxe-cream transition-colors"
          />
          {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-luxe-muted text-xs tracking-wider uppercase flex items-center gap-1">
            <Phone size={12} /> Mobile Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); }}
            placeholder="+995 599 123 456"
            className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream px-4 py-3 text-sm placeholder:text-luxe-muted focus:outline-none focus:border-luxe-cream transition-colors"
          />
          {errors.phone && <p className="text-red-400 text-xs">{errors.phone}</p>}
        </div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-luxe-cream text-luxe-bg text-sm tracking-widest uppercase hover:bg-luxe-accent transition-colors duration-200 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Confirming…' : 'Confirm Booking'}
        </button>
      </form>
      <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  );
}

// ─── Step 5: Confirmation ─────────────────────────────────────────────────────
function StepConfirmation({ booking }: { booking: ConfirmedBooking }) {
  return (
    <div className="space-y-8 text-center">
      <div className="w-16 h-16 rounded-full border-2 border-luxe-cream flex items-center justify-center mx-auto">
        <Check size={28} className="text-luxe-cream" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-display tracking-wider">Booking Confirmed</h2>
        <p className="text-luxe-muted text-sm">We look forward to welcoming you.</p>
      </div>
      <div className="border border-luxe-border p-6 text-left space-y-4">
        <div className="text-center pb-4 border-b border-luxe-border">
          <p className="text-luxe-muted text-xs tracking-widest uppercase">Reference</p>
          <p className="text-luxe-accent text-xl font-display tracking-wider mt-1">{booking.reference}</p>
        </div>
        <Row label="Service" value={booking.service.name} />
        <Row label="Professional" value={booking.professional.name} />
        <Row label="Location" value={booking.salon.name} />
        <Row label="Date" value={formatLongDate(booking.date)} />
        <Row label="Time" value={booking.time} />
        <Row label="Name" value={booking.clientName} />
        <Row label="Phone" value={booking.clientPhone} />
        <Row label="Total" value={`₾ ${booking.service.price}`} />
      </div>
      <a href={`/${booking.salon.slug}`} className="inline-block px-10 py-3 border border-luxe-border text-luxe-muted text-sm tracking-widest uppercase hover:border-luxe-cream hover:text-luxe-cream transition-colors">
        New Booking
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-luxe-muted">{label}</span>
      <span className="text-luxe-cream">{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientBooking({ salon }: { salon: BookingSalon }) {
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<DBService | null>(null);
  const [professional, setProfessional] = useState<DBStaff | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [services, setServices] = useState<DBService[]>([]);
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    publicGetServices(salon.id)
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
    publicGetStaff(salon.id)
      .then(setStaff)
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [salon.id]);

  async function handleConfirm(name: string, phone: string) {
    if (!professional || !service || !date || !time) return;
    setSubmitting(true);
    setSubmitError(null);
    const ref = generateRef();
    try {
      const result = await publicCreateBooking({
        departmentId: salon.id,
        professionalId: professional.id,
        serviceId: service.id,
        date,
        time,
        clientName: name,
        clientPhone: phone,
        reference: ref,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }
      setConfirmedBooking({
        reference: ref, service, professional, salon, date, time,
        clientName: name, clientPhone: phone,
      });
      setStep(5 as Step);
    } catch (e) {
      setSubmitError('Could not save booking. Please try again. ' + String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const eligibleStaff = service ? staff.filter(p => {
    try {
      const specs = JSON.parse(p.specialties) as string[];
      return specs.length === 0 || specs.includes(service.id);
    } catch { return true; }
  }) : staff;

  const totalSteps = 4;
  const showProgress = step >= 1 && step <= totalSteps;

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <div>
          <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
          <p className="text-luxe-muted text-xs mt-0.5">{salon.name}{salon.city ? ` · ${salon.city}` : ''}</p>
        </div>
        {showProgress && (
          <div className="flex gap-1.5">
            {([1, 2, 3, 4] as const).map(s => (
              <div key={s} className={`w-6 h-0.5 transition-colors ${s <= step ? 'bg-luxe-cream' : 'bg-luxe-border'}`} />
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {step === 1 && (
            <StepService
              services={services}
              loading={loadingServices}
              onSelect={s => { setService(s); setStep(2); }}
            />
          )}
          {step === 2 && service && (
            <StepProfessional
              staff={eligibleStaff}
              loading={loadingStaff}
              onSelect={p => { setProfessional(p); setStep(3); }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && professional && service && (
            <StepSchedule
              professional={professional}
              service={service}
              services={services}
              salonId={salon.id}
              onSelect={(d, t) => { setDate(d); setTime(t); setStep(4); }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <StepDetails
              onConfirm={handleConfirm}
              onBack={() => { setSubmitError(null); setStep(3); }}
              submitting={submitting}
              error={submitError}
            />
          )}
          {step === 5 && confirmedBooking && (
            <StepConfirmation booking={confirmedBooking} />
          )}
        </div>
      </main>
    </div>
  );
}
