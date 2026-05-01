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

export const DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Tbilisi Flagship', city: 'Tbilisi', address: 'Rustaveli Ave 12, Tbilisi' },
  { id: 'd2', name: 'Batumi Sea', city: 'Batumi', address: 'Seaside Blvd 5, Batumi' },
  { id: 'd3', name: 'Kutaisi Garden', city: 'Kutaisi', address: 'Mtskheta St 8, Kutaisi' },
];

export const SERVICES: Service[] = [
  { id: 's1', name: 'Signature Cut & Style', tagline: 'Precision cut tailored to your face shape.', duration: 60, buffer: 15, price: 120 },
  { id: 's2', name: 'Color & Highlights', tagline: 'Multi-dimensional color crafted by our experts.', duration: 120, buffer: 15, price: 280 },
  { id: 's3', name: 'Bridal Package', tagline: 'Complete bridal hair & makeup for your special day.', duration: 180, buffer: 30, price: 650 },
  { id: 's4', name: 'Deep Conditioning', tagline: 'Restorative treatment for silky, healthy hair.', duration: 45, buffer: 10, price: 90 },
  { id: 's5', name: 'Blowout & Finish', tagline: 'Voluminous blowout with lasting hold.', duration: 45, buffer: 10, price: 75 },
];

export const PROFESSIONALS: Professional[] = [
  { id: 'p1', name: 'Nino Beridze', title: 'Master Stylist', departmentId: 'd1', avatar: 'NB', specialties: ['s1', 's2', 's3'] },
  { id: 'p2', name: 'Tamara Kvaratskhelia', title: 'Color Specialist', departmentId: 'd1', avatar: 'TK', specialties: ['s2', 's4'] },
  { id: 'p3', name: 'Mariam Tsiklauri', title: 'Senior Stylist', departmentId: 'd2', avatar: 'MT', specialties: ['s1', 's5', 's4'] },
  { id: 'p4', name: 'Ana Jghenti', title: 'Bridal Expert', departmentId: 'd2', avatar: 'AJ', specialties: ['s3', 's1', 's2'] },
  { id: 'p5', name: 'Lika Mgeladze', title: 'Style Director', departmentId: 'd3', avatar: 'LM', specialties: ['s1', 's2', 's5'] },
  { id: 'p6', name: 'Elene Davitashvili', title: 'Color Artist', departmentId: 'd3', avatar: 'ED', specialties: ['s2', 's3', 's4'] },
];

export const ALL_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];

// Default working hours: Mon–Sat 09:00–19:00, Sun off
// Index 0 = Sunday, 1 = Monday, …, 6 = Saturday
const DEFAULT_HOURS: WorkingHours[] = [
  null,
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '18:00' },
];

export const INITIAL_WORKING_HOURS: Record<string, WorkingHours[]> = {
  p1: [...DEFAULT_HOURS],
  p2: [...DEFAULT_HOURS],
  p3: [...DEFAULT_HOURS],
  p4: [...DEFAULT_HOURS],
  p5: [...DEFAULT_HOURS],
  p6: [...DEFAULT_HOURS],
};

// Seed bookings for demo
export const SEED_BOOKINGS: Booking[] = [
  {
    id: 'b1', professionalId: 'p1', serviceId: 's1', departmentId: 'd1',
    date: '2026-05-01', time: '10:00', clientName: 'Sophie Williams',
    clientPhone: '+995599123456', status: 'scheduled', reference: 'ATL-001', createdAt: '2026-04-28T08:00:00Z',
  },
  {
    id: 'b2', professionalId: 'p1', serviceId: 's2', departmentId: 'd1',
    date: '2026-05-01', time: '12:00', clientName: 'Emma Johnson',
    clientPhone: '+995599234567', status: 'scheduled', reference: 'ATL-002', createdAt: '2026-04-28T09:00:00Z',
  },
  {
    id: 'b3', professionalId: 'p2', serviceId: 's4', departmentId: 'd1',
    date: '2026-05-01', time: '11:00', clientName: 'Mia Davis',
    clientPhone: '+995599345678', status: 'completed', reference: 'ATL-003', createdAt: '2026-04-27T10:00:00Z',
  },
  {
    id: 'b4', professionalId: 'p3', serviceId: 's5', departmentId: 'd2',
    date: '2026-05-02', time: '09:30', clientName: 'Olivia Brown',
    clientPhone: '+995555123456', status: 'scheduled', reference: 'ATL-004', createdAt: '2026-04-29T11:00:00Z',
  },
];
