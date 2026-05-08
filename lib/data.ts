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

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALL_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];
