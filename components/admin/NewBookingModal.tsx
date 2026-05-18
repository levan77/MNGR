'use client';

import { useEffect, useState, useTransition } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateString, timeToMinutes, formatLongDate, getDayOfWeek, getWeekDays } from '@/lib/dates';
import { ALL_TIME_SLOTS, parseSpecialties, bookingAddonDuration, type WorkingHours } from '@/lib/data';
import { adminCreateBooking, getBookingsForWeek } from '@/app/admin/actions';
import type { DBStaff, DBService, DBServiceAddon, DBBookingDetail, DBBooking, AddonExclusion } from '@/app/admin/actions';
import { useLanguage } from '@/lib/LanguageContext';

// ─── Slot Calculator ──────────────────────────────────────────────────────────

function getAvailableSlots(
  professional: DBStaff,
  service: DBService,
  selectedAddons: DBServiceAddon[],
  dayBookings: DBBookingDetail[],
  date: string,
  services: DBService[],
): string[] {
  let staffHours: WorkingHours[] | null = null;
  try { staffHours = JSON.parse(professional.working_hours) as WorkingHours[]; } catch {}
  if (!staffHours) return [];

  const dow = getDayOfWeek(date);
  const hours = staffHours[dow];
  if (!hours) return [];

  const workStart = timeToMinutes(hours.s);
  const workEnd   = timeToMinutes(hours.e);
  const addonDuration = selectedAddons.reduce((s, a) => s + a.duration, 0);
  const totalNewDuration = service.duration + addonDuration;
  const bufferExtra = professional.buffer_extra ?? 0;

  const occupied = dayBookings
    .filter(b => b.professional_id === professional.id)
    .map(b => {
      const svc = services.find(s => s.id === b.service_id);
      const start = timeToMinutes(b.time);
      const end = start + (svc ? svc.duration + bookingAddonDuration(b.addons) + svc.buffer : 60) + bufferExtra;
      return { start, end };
    });

  const today = localDateString();
  const nowMins = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  return ALL_TIME_SLOTS.filter(slot => {
    const slotStart = timeToMinutes(slot);
    const slotEnd   = slotStart + totalNewDuration + service.buffer + bufferExtra;
    if (slotStart < workStart || slotEnd > workEnd) return false;
    if (slotStart <= nowMins) return false;
    return !occupied.some(o => slotStart < o.end && slotEnd > o.start);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_ABBR_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_ABBR_KA = ['კვ', 'ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ'];

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  departmentId: string;
  staff: DBStaff[];
  services: DBService[];
  addons: DBServiceAddon[];
  exclusions: AddonExclusion[];
  onClose: () => void;
  onCreated: (booking: DBBooking) => void;
}

export default function NewBookingModal({ departmentId, staff, services, addons, exclusions, onClose, onCreated }: Props) {
  const { t, lang } = useLanguage();
  const today = localDateString();
  const DAY_ABBR = lang === 'ka' ? DAY_ABBR_KA : DAY_ABBR_EN;

  const [service,        setService]        = useState<DBService | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<DBServiceAddon[]>([]);
  const [professional,   setProfessional]   = useState<DBStaff | null>(null);
  const [date,           setDate]           = useState<string | null>(null);
  const [time,           setTime]           = useState<string | null>(null);
  const [weekStart,      setWeekStart]      = useState(today);
  const [clientName,     setClientName]     = useState('');
  const [clientPhone,    setClientPhone]    = useState('');
  const [error,          setError]          = useState<string | null>(null);
  const [weekBookings,   setWeekBookings]   = useState<DBBookingDetail[]>([]);
  const [weekFetching,   setWeekFetching]   = useState(false);
  const [pending,        startTransition]   = useTransition();
  const [confirmed,      setConfirmed]      = useState<DBBooking | null>(null);

  const serviceAddons = service ? addons.filter(a => a.service_id === service.id) : [];

  const eligibleStaff = service
    ? staff.filter(p => {
        const specs = parseSpecialties(p.specialties);
        if (specs.length > 0 && !specs.includes(service.id)) return false;
        return !selectedAddons.some(addon =>
          exclusions.some(e => e.staff_id === p.id && e.addon_id === addon.id)
        );
      })
    : staff;

  useEffect(() => {
    if (!service) return;
    setWeekFetching(true);
    setProfessional(null); setDate(null); setTime(null);
    const days = getWeekDays(weekStart);
    startTransition(async () => {
      try {
        const data = await getBookingsForWeek(departmentId, weekStart, days[6]);
        setWeekBookings(data);
      } catch {}
      setWeekFetching(false);
    });
  }, [service, weekStart, departmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearSlotSelection() { setProfessional(null); setDate(null); setTime(null); }

  function selectService(s: DBService) {
    setService(s); setSelectedAddons([]); clearSlotSelection();
  }

  function toggleAddon(addon: DBServiceAddon) {
    setSelectedAddons(prev =>
      prev.find(a => a.id === addon.id) ? prev.filter(a => a.id !== addon.id) : [...prev, addon]
    );
    clearSlotSelection();
  }

  function selectSlot(pro: DBStaff, d: string, slot: string) {
    setProfessional(pro); setDate(d); setTime(slot); setError(null);
  }

  function shiftWeek(n: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + n * 7);
    const next = d.toISOString().slice(0, 10);
    if (n < 0 && next < today) return;
    setWeekStart(next);
  }

  const days = getWeekDays(weekStart);
  const totalPrice    = (service?.price ?? 0) + selectedAddons.reduce((s, a) => s + a.price, 0);
  const totalDuration = (service?.duration ?? 0) + selectedAddons.reduce((s, a) => s + a.duration, 0);

  async function handleSubmit() {
    if (!professional || !service || !date || !time || !clientName.trim() || !clientPhone.trim()) {
      setError(t('please_fill_all'));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminCreateBooking({
        departmentId,
        professionalId: professional.id,
        serviceId: service.id,
        date, time,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        addons: selectedAddons.map(a => ({ id: a.id, name: a.name, duration: a.duration, price: a.price })),
      });
      if (!result.ok) { setError(result.error); return; }
      onCreated(result.booking);
      setConfirmed(result.booking);
    });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{t('manual_booking')}</p>
            <p className="text-sm text-neutral-100 font-medium mt-0.5">{confirmed ? t('booking_confirmed') : t('new_appointment')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800 rounded-sm transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Confirmation screen */}
        {confirmed && service && professional && date && time && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-700/50 flex items-center justify-center">
              <span className="text-emerald-400 text-2xl">✓</span>
            </div>
            <div className="space-y-1">
              <p className="text-neutral-100 text-lg font-light tracking-wide">{confirmed.client_name}</p>
              <p className="text-neutral-500 text-xs tracking-widest uppercase">{confirmed.reference}</p>
            </div>
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-500">{t('service_label')}</span>
                <span className="text-neutral-200">{service.name}{selectedAddons.length > 0 ? ` + ${selectedAddons.map(a => a.name).join(', ')}` : ''}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-500">{t('professional_label')}</span>
                <span className="text-neutral-200">{professional.name}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-500">{t('date_time_label')}</span>
                <span className="text-neutral-200">{formatLongDate(date)} {time}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-500">{t('duration_label')}</span>
                <span className="text-neutral-200">{totalDuration} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">{t('total_label')}</span>
                <span className="text-amber-300 font-medium">₾{totalPrice}</span>
              </div>
            </div>
            <div className="flex gap-3 w-full max-w-xs pt-2">
              <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 text-black text-xs tracking-widest uppercase font-medium hover:bg-white transition-colors">
                {t('done')}
              </button>
              <button
                onClick={() => {
                  setConfirmed(null);
                  setService(null); setSelectedAddons([]); clearSlotSelection();
                  setClientName(''); setClientPhone(''); setError(null);
                }}
                className="flex-1 py-3 border border-neutral-700 text-neutral-400 text-xs tracking-widest uppercase hover:border-neutral-500 hover:text-neutral-200 transition-colors"
              >
                {t('new_booking')}
              </button>
            </div>
          </div>
        )}

        {!confirmed && <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Step 1: Service */}
          <section>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">1 · {t('select_service_step')}</p>
            <div className="space-y-1.5">
              {services.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => selectService(svc)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-sm text-left transition-colors ${
                    service?.id === svc.id
                      ? 'border-neutral-400 bg-neutral-800 text-neutral-100'
                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  <span className="text-sm">{svc.name}</span>
                  <span className="text-xs text-neutral-500 shrink-0 ml-2">{svc.duration}m · ₾{svc.price}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Add-ons */}
          {service && serviceAddons.length > 0 && (
            <section>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">2 · {t('addons_optional_step')}</p>
              <div className="space-y-1.5">
                {serviceAddons.map(addon => {
                  const active = !!selectedAddons.find(a => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      className={`w-full flex items-center justify-between px-3 py-2 border rounded-sm text-left transition-colors ${
                        active ? 'border-amber-700 bg-amber-950/20 text-amber-300' : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? 'border-amber-600 bg-amber-600' : 'border-neutral-700'}`}>
                          {active && <span className="text-black text-[10px] font-bold">✓</span>}
                        </span>
                        <span className="text-sm">{addon.name}</span>
                      </div>
                      <span className="text-xs text-neutral-500 ml-2 shrink-0">+{addon.duration}m · ₾{addon.price}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Step 3: Week Availability Grid */}
          {service && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                  {serviceAddons.length > 0 ? '3' : '2'} · {t('pick_free_slot_step')}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => shiftWeek(-1)} className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[10px] text-neutral-600 min-w-[90px] text-center">
                    {new Date(days[0] + 'T00:00:00').toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(days[6] + 'T00:00:00').toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en', { month: 'short', day: 'numeric' })}
                  </span>
                  <button onClick={() => shiftWeek(1)} className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {weekFetching ? (
                <p className="text-[10px] text-neutral-600 text-center py-6 animate-pulse uppercase tracking-widest">{t('loading_availability')}</p>
              ) : (
                <div className="grid grid-cols-7 gap-1 text-[10px]">
                  {days.map(d => {
                    const isPast = d < today;
                    const dayNum = new Date(d + 'T00:00:00');
                    const isToday = d === today;
                    return (
                      <div key={d} className={`text-center pb-1 border-b mb-1 ${isPast ? 'opacity-30 border-neutral-900' : isToday ? 'border-amber-800 text-amber-400' : 'border-neutral-800 text-neutral-500'}`}>
                        <div className="uppercase">{DAY_ABBR[dayNum.getDay()]}</div>
                        <div className="font-medium text-neutral-300">{dayNum.getDate()}</div>
                      </div>
                    );
                  })}

                  {days.map(d => {
                    const isPast = d < today;
                    if (isPast) return <div key={d} className="text-center text-neutral-800">—</div>;

                    const dayWeekBookings = weekBookings.filter(b => b.date === d);
                    const staffSlots = eligibleStaff.map(pro => ({
                      pro,
                      slots: getAvailableSlots(pro, service, selectedAddons, dayWeekBookings, d, services),
                    })).filter(({ slots }) => slots.length > 0);

                    if (staffSlots.length === 0) {
                      return <div key={d} className="text-center text-neutral-800 pt-0.5">—</div>;
                    }

                    return (
                      <div key={d} className="space-y-1.5">
                        {staffSlots.map(({ pro, slots }) => (
                          <div key={pro.id}>
                            {eligibleStaff.length > 1 && (
                              <p className="text-[9px] text-neutral-600 truncate mb-0.5 text-center">{pro.name.split(' ')[0]}</p>
                            )}
                            <div className="space-y-0.5 max-h-64 overflow-y-auto">
                              {slots.map(slot => {
                                const isSelected = date === d && time === slot && professional?.id === pro.id;
                                return (
                                  <button
                                    key={slot}
                                    onClick={() => selectSlot(pro, d, slot)}
                                    className={`w-full py-1 text-[10px] border rounded-sm transition-colors ${
                                      isSelected
                                        ? 'border-amber-500 bg-amber-950/30 text-amber-300'
                                        : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                                    }`}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {professional && date && time && (
                <div className="mt-3 px-3 py-2 border border-amber-800/50 bg-amber-950/10 rounded-sm text-[11px] text-amber-300 flex items-center justify-between gap-2">
                  <span>✓ {professional.name} · {formatLongDate(date)} {time} · {totalDuration}min · ₾{totalPrice}</span>
                  <button onClick={clearSlotSelection} className="text-neutral-500 hover:text-neutral-200 text-[10px] uppercase tracking-wider shrink-0 transition-colors">
                    {t('change')}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Step 4: Client Info */}
          {time && (
            <section className="space-y-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                {serviceAddons.length > 0 ? '4' : '3'} · {t('client_details_step')}
              </p>
              <div>
                <label className="text-[10px] text-neutral-600 uppercase tracking-widest block mb-1">{t('full_name_label')}</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Ana Beridze"
                  autoFocus
                  className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-neutral-600 placeholder:text-neutral-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-600 uppercase tracking-widest block mb-1">{t('phone_label')}</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="+995 599 123 456"
                  className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-neutral-600 placeholder:text-neutral-700"
                />
              </div>
            </section>
          )}

          {error && (
            <p className="text-red-400 text-xs border border-red-800/40 bg-red-950/20 px-3 py-2 rounded-sm">{error}</p>
          )}
        </div>}

        {/* Footer */}
        {!confirmed && <div className="px-5 py-4 border-t border-neutral-800 shrink-0">
          {professional && service && date && time && (
            <div className="mb-3 text-[11px] text-neutral-500 space-y-0.5">
              <p>{professional.name} · {service.name}{selectedAddons.length > 0 ? ` + ${selectedAddons.map(a => a.name).join(', ')}` : ''}</p>
              <p>{formatLongDate(date)} {time} · {totalDuration}min · ₾{totalPrice}</p>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={pending || !professional || !service || !date || !time || !clientName.trim() || !clientPhone.trim()}
            className="w-full py-3 bg-neutral-100 text-black text-xs tracking-widest uppercase font-medium hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {pending ? t('creating') : t('create_booking')}
          </button>
        </div>}
      </div>
    </>
  );
}
