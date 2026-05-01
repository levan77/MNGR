import { Booking, Service, WorkingHours, ALL_TIME_SLOTS } from './data';
import { timeToMinutes, getDayOfWeek } from './dates';

export function getAvailableSlots(
  professionalId: string,
  date: string,
  service: Service,
  workingHours: Record<string, WorkingHours[]>,
  existingBookings: Booking[],
  services: Service[]
): string[] {
  const dayOfWeek = getDayOfWeek(date);
  const hours = workingHours[professionalId]?.[dayOfWeek];

  if (!hours) return [];

  const workStart = timeToMinutes(hours.s);
  const workEnd = timeToMinutes(hours.e);
  const totalDuration = service.duration + service.buffer;

  // Occupied intervals for this professional on this date
  const occupied = existingBookings
    .filter(b => b.professionalId === professionalId && b.date === date && b.status !== 'cancelled' && b.status !== 'no_show')
    .map(b => {
      const svc = services.find(s => s.id === b.serviceId);
      const start = timeToMinutes(b.time);
      const end = start + (svc ? svc.duration + svc.buffer : 60);
      return { start, end };
    });

  return ALL_TIME_SLOTS.filter(slot => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + totalDuration;

    if (slotStart < workStart || slotEnd > workEnd) return false;

    return !occupied.some(o => slotStart < o.end && slotEnd > o.start);
  });
}
