# ATELIER — Luxury Beauty Salon Booking System

A production-ready B2B2C SaaS reservation platform for multi-location beauty salons. Built with **Next.js 14**, **React 18**, **Tailwind CSS**, and **Supabase**.

## Features

✨ **Client Booking Flow**
- 6-step guest checkout (no account required)
- Department selection (Tbilisi, Batumi, Kutaisi)
- Service picker with duration & pricing
- Professional selection with portfolio
- Real-time availability engine
- Name + mobile number confirmation

⚙️ **Admin Dashboard**
- Today's schedule with revenue tracking
- Weekly calendar with drag-to-lock
- Manual phone bookings with conflict prevention
- Staff management (working hours, time off)
- Service CRUD and availability management
- Booking status tracking (scheduled → completed/no-show/cancelled)

🎨 **Design**
- Luxury dark theme (charcoal + cream)
- Bodoni Moda serif display font
- Manrope sans-serif UI font
- Scandinavian minimalism + editorial fashion aesthetic
- Real-time sync between admin and client

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Icons**: lucide-react
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth (magic link / email+password)
- **Storage**: Supabase Storage (portfolio images)

## Project Structure

```
salon-booking-system/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout with globals
│   ├── page.tsx                 # Landing page
│   ├── booking/                 # Client booking flow
│   │   ├── layout.tsx
│   │   └── page.tsx            # Routes to ClientBooking
│   └── admin/                   # Admin dashboard
│       ├── layout.tsx
│       └── page.tsx            # Routes to AdminDashboard
│
├── components/
│   ├── booking/
│   │   └── ClientBooking.tsx    # Full 6-step client flow
│   └── admin/
│       └── AdminDashboard.tsx   # Admin with 5 sub-views
│
├── lib/
│   ├── data.ts                  # Shared constants & types
│   ├── dates.ts                 # Date/time utilities
│   ├── availability.ts          # Availability engine
│   ├── validation.ts            # Phone/name validators
│   └── supabase/               # (Planned: auth clients)
│
├── styles/
│   └── globals.css              # Tailwind + custom utilities
│
├── supabase/
│   ├── migrations/
│   │   └── 20260501000000_init.sql  # Full schema with RLS
│   └── seed.sql                 # (Planned: demo data)
│
├── public/                       # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── README.md
```

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/salon-booking-system.git
cd salon-booking-system
npm install
```

### 2. Environment Setup

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Database Setup

```bash
# Start Supabase locally (optional)
supabase start

# Apply migrations
supabase db push

# Or push via Supabase CLI to production
supabase db push --linked
```

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- **Client Booking**: http://localhost:3000/booking
- **Admin Dashboard**: http://localhost:3000/admin

## Key Files

### Core Logic

- **`lib/data.ts`** — Shared constants (professionals, services, departments)
- **`lib/dates.ts`** — Date helpers (timezone-safe, week calculations)
- **`lib/availability.ts`** — Real-time slot availability engine
- **`lib/validation.ts`** — Phone & name validation (mirrors DB constraints)

### Components

- **`components/booking/ClientBooking.tsx`** — Full guest flow with state management
- **`components/admin/AdminDashboard.tsx`** — Admin with 5 tabs (Today, Calendar, Bookings, Staff, Services)

### Database

- **`supabase/migrations/20260501000000_init.sql`** — Complete schema:
  - Tables: `salons`, `professionals`, `services`, `bookings`, `portfolios`, etc.
  - Exclusion constraint on `bookings` (prevents double-booking)
  - Row-level security (RLS) for multi-tenant isolation
  - Availability engine RPC (`get_available_slots`)
  - Guest booking RPC (`create_guest_booking`)

## Booking Flow (Client)

1. **Departments** — Pick Tbilisi, Batumi, or Kutaisi
2. **Services** — Choose cut, color, bridal, etc.
3. **Professionals** — View portfolio, filtered by location
4. **Schedule** — 7-day calendar with real-time availability
5. **Details** — Name + mobile (no email required)
6. **Confirmation** — Success screen with reference #

## Admin Features

| View | Actions |
|------|---------|
| **Today** | Stats, schedule, per-artist overview |
| **Calendar** | 7-day grid, lock phone bookings, change status |
| **Bookings** | Filterable list (by status, date, artist) |
| **Staff** | Manage hours per day, toggle active/off |
| **Services** | Enable/disable, view pricing & duration |

## Database Constraints

- **Exclusion Constraint**: No overlapping bookings for same professional (unless cancelled/no_show)
- **RLS Policies**: Public read salon/service/availability; insert-only for guest bookings; admin full CRUD scoped to salon_id
- **Phone Validation**: `^\+?[1-9]\d{7,14}$` (E.164-style)
- **Name Validation**: Min. 2 space-separated tokens (first + last)

## Customization

### Change Theme Colors

Edit `styles/globals.css`:

```css
:root {
  --luxe-bg: #14110d;      /* Background */
  --luxe-cream: #f5efe6;   /* Text & accents */
  --luxe-dark: #14110d;    /* Button text */
}
```

Or update Tailwind config in `tailwind.config.ts`.

### Modify Services / Professionals

Edit `lib/data.ts` and add/remove entries from `SERVICES`, `PROFESSIONALS`, `DEPARTMENTS`.

### Adjust Availability Slots

In `lib/data.ts`, update `ALL_TIME_SLOTS`:

```typescript
export const ALL_TIME_SLOTS = [
  '09:00', '09:30', '10:00', ...
];
```

## Known Limitations (MVP)

- ❌ No real Supabase auth yet (use dummy state for demo)
- ❌ Portfolio image upload not wired to Storage
- ❌ No email/SMS reminders
- ❌ No payment processing (booking-only)
- ❌ No multi-language i18n (hardcoded English)

## Next Steps

1. **Wire Supabase Auth** → Replace dummy login with magic link
2. **Implement Portfolio Upload** → Use Supabase Storage RPC
3. **Add Twilio SMS** → Send booking confirmations
4. **Stripe Payments** → Optional pre-pay flow
5. **Analytics Dashboard** → Revenue, occupancy, no-shows
6. **Multi-language** → i18n with Georgian, Russian, English

## Deployment

### Vercel (Recommended)

```bash
git push origin main
# Vercel auto-deploys on push
```

Set environment variables in Vercel → Settings → Environment Variables.

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build -t salon-booking .
docker run -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL=... salon-booking
```

## License

MIT

## Support

For issues, open a GitHub issue or email support@atelier.ge
