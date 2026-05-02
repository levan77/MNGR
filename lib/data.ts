// ─── Types ────────────────────────────────────────────────────────────────────

export type Department = {
  id: string;
  name: string;
  city: string;
  address: string;
};

export type Service = {
  id: string;
  name: string;
  tagline: string;
  duration: number; // minutes
  buffer: number;   // buffer after, minutes
  price: number;    // GEL
};

export type Professional = {
  id: string;
  name: string;
  title: string;
  departmentId: string;
  avatar: string;
  specialties: string[];
};

export type WorkingHours = { s: string; e: string } | null;

export type BookingStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

export type Booking = {
  id: string;
  professionalId: string;
  serviceId: string;
  departmentId: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  clientName: string;
  clientPhone: string;
  status: BookingStatus;
  reference: string;
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const SALON_NAME = 'ATELIER';

// Departments are defined in code (not D1) because they correspond to
// salon admin login credentials in SALON_CREDENTIALS.
export const DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Tbilisi Flagship', city: 'Tbilisi', address: 'Rustaveli Ave 12, Tbilisi' },
  { id: 'd2', name: 'Batumi Sea',       city: 'Batumi',  address: 'Seaside Blvd 5, Batumi'    },
  { id: 'd3', name: 'Kutaisi Garden',   city: 'Kutaisi', address: 'Mtskheta St 8, Kutaisi'    },
];

export const ALL_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];
