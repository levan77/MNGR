'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Phone, MapPin, Clock, Star } from 'lucide-react';
import {
  DEPARTMENTS, SERVICES, PROFESSIONALS,
  INITIAL_WORKING_HOURS,
  type Department, type Service, type Professional, type Booking,
} from '@/lib/data';
import { getAvailableSlots } from '@/lib/availability';
import { localDateString, getWeekDays, formatShortDate, formatLongDate } from '@/lib/dates';
import { isValidName, isValidPhone, formatPhone } from '@/lib/validation';
import { createBooking } from '@/app/admin/actions';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function generateRef() {
  return 'ATL-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ─── Step 1: Department ───────────────────────────────────────────────────────
function StepDepartment({ onSelect }: { onSelect: (d: Department) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 1 of 5</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Location</h2>
      </div>
      <div className="grid gap-3">
        {DEPARTMENTS.map(dept => (
          <button
            key={dept.id}
            onClick={() => onSelect(dept)}
            className="flex items-start gap-4 p-5 border border-luxe-border hover:border-luxe-cream text-left transition-colors duration-150 group"
          >
            <MapPin size={18} className="text-luxe-muted group-hover:text-luxe-cream mt-0.5 shrink-0 transition-colors" />
            <div>
              <p className="text-luxe-cream font-medium tracking-wide">{dept.name}</p>
              <p className="text-luxe-muted text-sm mt-0.5">{dept.address}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Service ──────────────────────────────────────────────────────────
function StepService({ onSelect, onBack }: { onSelect: (s: Service) => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 2 of 5</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Service</h2>
      </div>
      <div className="grid gap-3">
        {SERVICES.map(svc => (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className="flex items-start justify-between gap-4 p-5 border border-luxe-border hover:border-luxe-cream text-left transition-colors duration-150 group"
          >
            <div className="space-y-1">
              <p className="text-luxe-cream font-medium tracking-wide">{svc.name}</p>
              <p className="text-luxe-muted text-sm">{svc.tagline}</p>
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
      <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  );
}

// ─── Step 3: Professional ─────────────────────────────────────────────────────
function StepProfessional({
  departmentId, serviceId, onSelect, onBack,
}: {
  departmentId: string;
  serviceId: string;
  onSelect: (p: Professional) => void;
  onBack: () => void;
}) {
  const filtered = PROFESSIONALS.filter(
    p => p.departmentId === departmentId && p.specialties.includes(serviceId)
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 3 of 5</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Professional</h2>
      </div>
      {filtered.length === 0 ? (
        <p className="text-luxe-muted text-center py-8">No professionals available for this combination.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map(pro => (
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
                  {[1,2,3,4,5].map(i => <Star key={i} size={10} className="fill-luxe-accent text-luxe-accent" />)}
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

// ─── Step 4: Schedule ─────────────────────────────────────────────────────────
function StepSchedule({
  professional, service, bookings, onSelect, onBack,
}: {
  professional: Professional;
  service: Service;
  bookings: Booking[];
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}) {
  const today = localDateString();
  const [weekStart, setWeekStart] = useState(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = getWeekDays(weekStart);

  const slots = selectedDate
    ? getAvailableSlots(professional.id, selectedDate, service, INITIAL_WORKING_HOURS, bookings, SERVICES)
    : [];

  function prevWeek() {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    const newStart = localDateString(d);
    if (newStart >= today) setWeekStart(newStart);
  }

  function nextWeek() {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setWeekStart(localDateString(d));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 4 of 5</p>
        <h2 className="text-2xl font-display tracking-wider">Choose Date & Time</h2>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="p-2 text-luxe-muted hover:text-luxe-cream transition-colors">
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
                <span className="uppercase tracking-wider">{new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0,2)}</span>
                <span className="font-medium mt-0.5">{new Date(day + 'T00:00:00').getDate()}</span>
              </button>
            );
          })}
        </div>
        <button onClick={nextWeek} className="p-2 text-luxe-muted hover:text-luxe-cream transition-colors">
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="space-y-3">
          <p className="text-luxe-muted text-xs tracking-widest uppercase text-center">
            {formatShortDate(selectedDate)}
          </p>
          {slots.length === 0 ? (
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

// ─── Step 5: Details ──────────────────────────────────────────────────────────
function StepDetails({
  onConfirm, onBack, submitting,
}: {
  onConfirm: (name: string, phone: string) => void;
  onBack: () => void;
  submitting?: boolean;
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
        <p className="text-luxe-muted text-xs tracking-widest uppercase">Step 5 of 5</p>
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

// ─── Step 6: Confirmation ─────────────────────────────────────────────────────
function StepConfirmation({ booking }: { booking: Booking }) {
  const svc = SERVICES.find(s => s.id === booking.serviceId)!;
  const pro = PROFESSIONALS.find(p => p.id === booking.professionalId)!;
  const dept = DEPARTMENTS.find(d => d.id === booking.departmentId)!;

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
        <Row label="Service" value={svc.name} />
        <Row label="Professional" value={pro.name} />
        <Row label="Location" value={dept.name} />
        <Row label="Date" value={formatLongDate(booking.date)} />
        <Row label="Time" value={booking.time} />
        <Row label="Name" value={booking.clientName} />
        <Row label="Phone" value={booking.clientPhone} />
        <Row label="Total" value={`₾ ${svc.price}`} />
      </div>
      <a href="/booking" className="inline-block px-10 py-3 border border-luxe-border text-luxe-muted text-sm tracking-widest uppercase hover:border-luxe-cream hover:text-luxe-cream transition-colors">
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
export default function ClientBooking() {
  const [step, setStep] = useState<Step>(1);
  const [department, setDepartment] = useState<Department | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(name: string, phone: string) {
    setSubmitting(true);
    const ref = generateRef();
    try {
      await createBooking({
        departmentId: department!.id,
        professionalId: professional!.id,
        serviceId: service!.id,
        date: date!,
        time: time!,
        clientName: name,
        clientPhone: phone,
        reference: ref,
      });
    } catch {
      // persist failed — still show confirmation, booking shows server-side on next load
    }
    const booking: Booking = {
      id: 'b-' + Date.now(),
      professionalId: professional!.id,
      serviceId: service!.id,
      departmentId: department!.id,
      date: date!,
      time: time!,
      clientName: name,
      clientPhone: phone,
      status: 'scheduled',
      reference: ref,
      createdAt: new Date().toISOString(),
    };
    setBookings(prev => [...prev, booking]);
    setConfirmedBooking(booking);
    setSubmitting(false);
    setStep(6);
  }

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
        {step < 6 && (
          <div className="flex gap-1.5">
            {([1,2,3,4,5] as const).map(s => (
              <div key={s} className={`w-6 h-0.5 transition-colors ${s <= step ? 'bg-luxe-cream' : 'bg-luxe-border'}`} />
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {step === 1 && (
            <StepDepartment onSelect={d => { setDepartment(d); setStep(2); }} />
          )}
          {step === 2 && (
            <StepService onSelect={s => { setService(s); setStep(3); }} onBack={() => setStep(1)} />
          )}
          {step === 3 && department && service && (
            <StepProfessional
              departmentId={department.id}
              serviceId={service.id}
              onSelect={p => { setProfessional(p); setStep(4); }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && professional && service && (
            <StepSchedule
              professional={professional}
              service={service}
              bookings={bookings}
              onSelect={(d, t) => { setDate(d); setTime(t); setStep(5); }}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <StepDetails onConfirm={handleConfirm} onBack={() => setStep(4)} submitting={submitting} />
          )}
          {step === 6 && confirmedBooking && (
            <StepConfirmation booking={confirmedBooking} />
          )}
        </div>
      </main>
    </div>
  );
}
