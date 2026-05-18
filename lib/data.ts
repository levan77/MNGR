// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkingHours = { s: string; e: string } | null;

export type BookingStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses the JSON specialties column on a staff row. Returns [] on error. */
export function parseSpecialties(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Parses the JSON working_hours column on a staff row. Returns null on invalid data. */
export function parseWorkingHours(raw: string): WorkingHours[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 7 ? (parsed as WorkingHours[]) : null;
  } catch {
    return null;
  }
}

/** Parses the JSON `addons` column on a booking row. Returns [] on error. */
export function parseBookingAddons(raw: string | null | undefined): Array<{ id: string; name: string; duration: number; price: number }> {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

/** Total addon duration (minutes) from a booking's raw `addons` JSON column. */
export function bookingAddonDuration(raw: string | null | undefined): number {
  return parseBookingAddons(raw).reduce((s, a) => s + a.duration, 0);
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALL_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];
