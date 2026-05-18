'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, Phone, Clock, Star, Globe } from 'lucide-react';
import {
  ALL_TIME_SLOTS, parseSpecialties,
  type WorkingHours,
} from '@/lib/data';
import { localDateString, getWeekDays, formatShortDate, formatLongDate, getDayOfWeek, timeToMinutes } from '@/lib/dates';
import { isValidName, isValidPhone, formatPhone } from '@/lib/validation';
import {
  publicGetServices, publicGetStaff, publicGetBookings, publicCreateBooking, publicGetAllAddons,
  publicGetAddonExclusions, type PublicAddonExclusion,
} from '@/app/booking/actions';
import type { DBService, DBStaff, DBBooking, DBServiceAddon } from '@/app/admin/actions';
import { useLanguage } from '@/lib/LanguageContext';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

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
  addons: DBServiceAddon[];
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
  professional: DBStaff,
  service: DBService,
  selectedAddons: DBServiceAddon[],
  bookings: DBBooking[],
  date: string,
  services: DBService[],
): string[] {
  if (!staffHours) return [];
  const dow = getDayOfWeek(date);
  const hours = staffHours[dow];
  if (!hours) return [];

  const workStart   = timeToMinutes(hours.s);
  const workEnd     = timeToMinutes(hours.e);
  const bufferExtra = professional.buffer_extra ?? 0;
  const addonDur    = selectedAddons.reduce((s, a) => s + a.duration, 0);
  const totalDuration = service.duration + addonDur + service.buffer + bufferExtra;

  const occupied = bookings
    .filter(b => b.professional_id === professional.id && b.date === date)
    .map(b => {
      const svc = services.find(s => s.id === b.service_id);
      const existingAddons: Array<{ duration: number }> = (() => {
        try { return JSON.parse(b.addons || '[]'); } catch { return []; }
      })();
      const existingAddonDur = existingAddons.reduce((s, a) => s + a.duration, 0);
      const start = timeToMinutes(b.time);
      const end = start + (svc ? svc.duration + existingAddonDur + svc.buffer : 60) + bufferExtra;
      return { start, end };
    });

  const today = localDateString();
  const nowMins = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  return ALL_TIME_SLOTS.filter(slot => {
    const slotStart = timeToMinutes(slot);
    const slotEnd   = slotStart + totalDuration;
    if (slotStart < workStart || slotEnd > workEnd) return false;
    if (slotStart <= nowMins) return false;
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
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('step_of')} 1 {t('of')} 4</p>
        <h2 className="text-2xl font-display tracking-wider">{t('choose_service')}</h2>
      </div>
      {loading ? (
        <p className="text-luxe-muted text-center py-8 text-sm">{t('loading_services')}</p>
      ) : services.length === 0 ? (
        <p className="text-luxe-muted text-center py-8 text-sm">{t('no_services_available')}</p>
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

// ─── Step 2: Add-ons ──────────────────────────────────────────────────────────
function StepAddons({
  service, addons, selected, onToggle, onContinue, onBack,
}: {
  service: DBService;
  addons: DBServiceAddon[];
  selected: DBServiceAddon[];
  onToggle: (a: DBServiceAddon) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const extraDuration = selected.reduce((s, a) => s + a.duration, 0);
  const extraPrice    = selected.reduce((s, a) => s + a.price, 0);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('step_of')} 2 {t('of')} 5</p>
        <h2 className="text-2xl font-display tracking-wider">{t('addons_title')}</h2>
        <p className="text-luxe-muted text-sm">{service.name}</p>
      </div>
      <div className="grid gap-2">
        {addons.map(addon => {
          const active = !!selected.find(a => a.id === addon.id);
          return (
            <button
              key={addon.id}
              onClick={() => onToggle(addon)}
              className={`flex items-center gap-4 p-4 border text-left transition-colors duration-150 ${
                active ? 'border-luxe-cream bg-luxe-surface' : 'border-luxe-border hover:border-luxe-muted'
              }`}
            >
              <div className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${
                active ? 'border-luxe-cream bg-luxe-cream' : 'border-luxe-border'
              }`}>
                {active && <Check size={12} className="text-luxe-bg" />}
              </div>
              <div className="flex-1">
                <p className="text-luxe-cream text-sm font-medium">{addon.name}</p>
                <p className="text-luxe-muted text-xs mt-0.5">+{addon.duration} min</p>
              </div>
              <span className="text-luxe-accent text-sm">+₾ {addon.price}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="border border-luxe-border p-3 text-xs text-luxe-muted space-y-1">
          <div className="flex justify-between"><span>{t('service')}</span><span className="text-luxe-cream">₾ {service.price} · {service.duration} min</span></div>
          {selected.map(a => (
            <div key={a.id} className="flex justify-between"><span>{a.name}</span><span className="text-luxe-cream">+₾ {a.price} · +{a.duration} min</span></div>
          ))}
          <div className="flex justify-between border-t border-luxe-border pt-1 mt-1 text-luxe-cream font-medium">
            <span>{t('total')}</span>
            <span>₾ {service.price + extraPrice} · {service.duration + extraDuration} min</span>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <button
          onClick={onContinue}
          className="w-full py-4 bg-luxe-cream text-luxe-bg text-sm tracking-widest uppercase hover:bg-luxe-accent transition-colors"
        >
          {t('continue')}
        </button>
        <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
          <ArrowLeft size={14} /> {t('back')}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Professional ─────────────────────────────────────────────────────
function StepProfessional({
  staff, loading, onSelect, onBack, stepNum, totalSteps,
}: {
  staff: DBStaff[];
  loading: boolean;
  onSelect: (p: DBStaff) => void;
  onBack: () => void;
  stepNum: number;
  totalSteps: number;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('step_of')} {stepNum} {t('of')} {totalSteps}</p>
        <h2 className="text-2xl font-display tracking-wider">{t('choose_professional')}</h2>
      </div>
      {loading ? (
        <p className="text-luxe-muted text-center py-8 text-sm">{t('loading')}</p>
      ) : staff.length === 0 ? (
        <p className="text-luxe-muted text-center py-8 text-sm">{t('no_professionals')}</p>
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
        <ArrowLeft size={14} /> {t('back')}
      </button>
    </div>
  );
}

// ─── Step 4: Schedule ─────────────────────────────────────────────────────────
function StepSchedule({
  professional, service, selectedAddons, services, salonId, onSelect, onBack, stepNum, totalSteps,
}: {
  professional: DBStaff;
  service: DBService;
  selectedAddons: DBServiceAddon[];
  services: DBService[];
  salonId: string;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
  stepNum: number;
  totalSteps: number;
}) {
  const { t, lang } = useLanguage();
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
    ? getAvailableSlots(staffHours, professional, service, selectedAddons, bookings, selectedDate, services)
    : [];

  function shiftWeek(n: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + n * 7);
    const next = localDateString(d);
    if (n < 0 && next < today) return;
    setWeekStart(next);
  }

  // Locale-aware weekday abbreviations (2 chars)
  const locale = lang === 'ka' ? 'ka-GE' : 'en';

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('step_of')} {stepNum} {t('of')} {totalSteps}</p>
        <h2 className="text-2xl font-display tracking-wider">{t('choose_date_time')}</h2>
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
                  {new Date(day + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}
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
            <p className="text-luxe-muted text-center py-4 text-sm">{t('loading_availability_client')}</p>
          ) : slots.length === 0 ? (
            <p className="text-luxe-muted text-center py-4 text-sm">{t('no_availability')}</p>
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
        <ArrowLeft size={14} /> {t('back')}
      </button>
    </div>
  );
}

// ─── Step 5: Details ──────────────────────────────────────────────────────────
function StepDetails({
  onConfirm, onBack, submitting, error, stepNum, totalSteps,
}: {
  onConfirm: (name: string, phone: string) => void;
  onBack: () => void;
  submitting?: boolean;
  error?: string | null;
  stepNum: number;
  totalSteps: number;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!isValidName(name)) errs.name = t('please_enter_full_name');
    if (!isValidPhone(phone)) errs.phone = t('please_enter_valid_phone');
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onConfirm(name.trim(), formatPhone(phone));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('step_of')} {stepNum} {t('of')} {totalSteps}</p>
        <h2 className="text-2xl font-display tracking-wider">{t('your_details')}</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-luxe-muted text-xs tracking-wider uppercase">{t('full_name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
            placeholder="e.g. სოფო ბერიძე"
            className="w-full bg-luxe-surface border border-luxe-border text-luxe-cream px-4 py-3 text-sm placeholder:text-luxe-muted focus:outline-none focus:border-luxe-cream transition-colors"
          />
          {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-luxe-muted text-xs tracking-wider uppercase flex items-center gap-1">
            <Phone size={12} /> {t('mobile_number')}
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
          {submitting ? t('confirming') : t('confirm_booking')}
        </button>
      </form>
      <button onClick={onBack} className="flex items-center gap-2 text-luxe-muted hover:text-luxe-cream text-sm transition-colors">
        <ArrowLeft size={14} /> {t('back')}
      </button>
    </div>
  );
}

// ─── Step 6: Confirmation ─────────────────────────────────────────────────────
function StepConfirmation({ booking }: { booking: ConfirmedBooking }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-8 text-center">
      <div className="w-16 h-16 rounded-full border-2 border-luxe-cream flex items-center justify-center mx-auto">
        <Check size={28} className="text-luxe-cream" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-display tracking-wider">{t('booking_confirmed')}</h2>
        <p className="text-luxe-muted text-sm">{t('we_look_forward')}</p>
      </div>
      <div className="border border-luxe-border p-6 text-left space-y-4">
        <div className="text-center pb-4 border-b border-luxe-border">
          <p className="text-luxe-muted text-xs tracking-widest uppercase">{t('reference')}</p>
          <p className="text-luxe-accent text-xl font-display tracking-wider mt-1">{booking.reference}</p>
        </div>
        <Row label={t('service')}      value={booking.service.name} />
        <Row label={t('professional')} value={booking.professional.name} />
        <Row label={t('location')}     value={booking.salon.name} />
        <Row label={t('date')}         value={formatLongDate(booking.date)} />
        <Row label={t('time')}         value={booking.time} />
        <Row label={t('name')}         value={booking.clientName} />
        <Row label={t('phone')}        value={booking.clientPhone} />
        <Row label={t('total')}        value={`₾ ${booking.service.price}`} />
      </div>
      <a href={`/${booking.salon.slug}`} className="inline-block px-10 py-3 border border-luxe-border text-luxe-muted text-sm tracking-widest uppercase hover:border-luxe-cream hover:text-luxe-cream transition-colors">
        {t('new_booking_link')}
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

// ─── Language Toggle Button ───────────────────────────────────────────────────
function LangToggle() {
  const { toggleLang, lang } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1.5 text-luxe-muted text-xs tracking-widest uppercase hover:text-luxe-cream transition-colors"
      title={lang === 'ka' ? 'Switch to English' : 'გადართვა ქართულზე'}
    >
      <Globe size={13} />
      {lang === 'ka' ? 'EN' : 'KA'}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientBooking({ salon }: { salon: BookingSalon }) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [service,      setService]      = useState<DBService | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<DBServiceAddon[]>([]);
  const [professional, setProfessional] = useState<DBStaff | null>(null);
  const [date, setDate]   = useState<string | null>(null);
  const [time, setTime]   = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [services,  setServices]  = useState<DBService[]>([]);
  const [allAddons,        setAllAddons]        = useState<DBServiceAddon[]>([]);
  const [staff,            setStaff]            = useState<DBStaff[]>([]);
  const [addonExclusions,  setAddonExclusions]  = useState<PublicAddonExclusion[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff,    setLoadingStaff]    = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  useEffect(() => {
    publicGetServices(salon.id)
      .then(setServices).catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
    publicGetStaff(salon.id)
      .then(setStaff).catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
    publicGetAllAddons(salon.id)
      .then(setAllAddons).catch(() => setAllAddons([]));
    publicGetAddonExclusions(salon.id)
      .then(setAddonExclusions).catch(() => setAddonExclusions([]));
  }, [salon.id]);

  const serviceAddons = service ? allAddons.filter(a => a.service_id === service.id) : [];
  const hasAddons = serviceAddons.length > 0;
  const totalSteps = hasAddons ? 5 : 4;

  function selectService(s: DBService) {
    setService(s);
    setSelectedAddons([]);
    const svcAddons = allAddons.filter(a => a.service_id === s.id);
    setStep(svcAddons.length > 0 ? 2 : (hasAddons ? 3 : 2) as Step);
  }

  function toggleAddon(a: DBServiceAddon) {
    setSelectedAddons(prev =>
      prev.find(x => x.id === a.id) ? prev.filter(x => x.id !== a.id) : [...prev, a]
    );
  }

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
        date, time,
        clientName: name, clientPhone: phone,
        reference: ref,
        addons: selectedAddons.map(a => ({ id: a.id, name: a.name, duration: a.duration, price: a.price })),
      });
      if (!result.ok) { setSubmitError(result.error); setSubmitting(false); return; }
      setConfirmedBooking({
        reference: ref, service, addons: selectedAddons,
        professional, salon, date, time, clientName: name, clientPhone: phone,
      });
      setStep(6);
    } catch (e) {
      setSubmitError(t('slot_claimed') + ' ' + String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const exclusionSet = useMemo(
    () => new Set(addonExclusions.map(e => `${e.staff_id}:${e.addon_id}`)),
    [addonExclusions],
  );

  const eligibleStaff = useMemo(() => {
    if (!service) return staff;
    return staff.filter(p => {
      const specs = parseSpecialties(p.specialties);
      if (specs.length > 0 && !specs.includes(service.id)) return false;
      return !selectedAddons.some(a => exclusionSet.has(`${p.id}:${a.id}`));
    });
  }, [service, staff, selectedAddons, exclusionSet]);

  const proStep      = hasAddons ? 3 : 2;
  const schedStep    = hasAddons ? 4 : 3;
  const detailsStep  = hasAddons ? 5 : 4;
  const confirmStep  = hasAddons ? 6 : 5;

  const showProgress = step >= 1 && step < confirmStep;

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-luxe-border">
        <div>
          <a href="/" className="text-xl font-display tracking-[0.3em] text-luxe-cream">ATELIER</a>
          <p className="text-luxe-muted text-xs mt-0.5">{salon.name}{salon.city ? ` · ${salon.city}` : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          {showProgress && (
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} className={`w-6 h-0.5 transition-colors ${i + 1 <= step ? 'bg-luxe-cream' : 'bg-luxe-border'}`} />
              ))}
            </div>
          )}
          <LangToggle />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {step === 1 && (
            <StepService
              services={services}
              loading={loadingServices}
              onSelect={selectService}
            />
          )}
          {step === 2 && service && hasAddons && (
            <StepAddons
              service={service}
              addons={serviceAddons}
              selected={selectedAddons}
              onToggle={toggleAddon}
              onContinue={() => setStep(proStep as Step)}
              onBack={() => setStep(1)}
            />
          )}
          {step === proStep && service && (
            <StepProfessional
              staff={eligibleStaff}
              loading={loadingStaff}
              onSelect={p => { setProfessional(p); setStep(schedStep as Step); }}
              onBack={() => setStep(hasAddons ? 2 : 1)}
              stepNum={proStep}
              totalSteps={totalSteps}
            />
          )}
          {step === schedStep && professional && service && (
            <StepSchedule
              professional={professional}
              service={service}
              selectedAddons={selectedAddons}
              services={services}
              salonId={salon.id}
              onSelect={(d, t_) => { setDate(d); setTime(t_); setStep(detailsStep as Step); }}
              onBack={() => setStep(proStep as Step)}
              stepNum={schedStep}
              totalSteps={totalSteps}
            />
          )}
          {step === detailsStep && (
            <StepDetails
              onConfirm={handleConfirm}
              onBack={() => { setSubmitError(null); setStep(schedStep as Step); }}
              submitting={submitting}
              error={submitError}
              stepNum={detailsStep}
              totalSteps={totalSteps}
            />
          )}
          {step === confirmStep && confirmedBooking && (
            <StepConfirmation booking={confirmedBooking} />
          )}
        </div>
      </main>
    </div>
  );
}
