# File Structure & Guide

## 📂 Directory Organization

```
salon-booking-system/
│
├── 📄 README.md                          ← Start here for overview
├── 📄 package.json                       ← Dependencies & scripts
├── 📄 tsconfig.json                      ← TypeScript config
├── 📄 tailwind.config.ts                 ← Tailwind theme (luxury colors)
├── 📄 next.config.mjs                    ← Next.js image & optimization
├── 📄 postcss.config.js                  ← CSS processing pipeline
├── 📄 .gitignore                         ← Git ignore rules
│
├── 📁 app/                               ← Next.js App Router
│   ├── layout.tsx                        ← Root layout (HTML, styles, fonts)
│   ├── page.tsx                          ← Home page ("/")
│   │
│   ├── booking/                          ← Client booking flow ("/booking")
│   │   ├── layout.tsx                    ← Booking wrapper
│   │   └── page.tsx                      ← Routes to ClientBooking component
│   │
│   └── admin/                            ← Admin dashboard ("/admin")
│       ├── layout.tsx                    ← Admin wrapper
│       └── page.tsx                      ← Routes to AdminDashboard component
│
├── 📁 components/                        ← React components
│   ├── booking/
│   │   └── ClientBooking.tsx             ← Full 6-step booking flow
│   │                                       (state management, all steps 1-6)
│   │
│   └── admin/
│       └── AdminDashboard.tsx            ← Admin with 5 tabs
│                                          (dashboard, calendar, bookings, staff, services)
│
├── 📁 lib/                               ← Business logic & utilities
│   ├── data.ts                           ← Constants (pros, services, depts, types)
│   ├── dates.ts                          ← Date/time helpers (timezone-safe)
│   ├── availability.ts                   ← Availability engine (slot calculation)
│   ├── validation.ts                     ← Phone & name validators
│   └── supabase/                         ← (Future: auth clients)
│       ├── client.ts                     ← Browser client (anon key)
│       ├── server.ts                     ← RSC/Server Action client
│       └── admin.ts                      ← Service role client (server-only)
│
├── 📁 styles/
│   └── globals.css                       ← Tailwind directives + custom styles
│
├── 📁 supabase/                          ← Database
│   ├── migrations/
│   │   └── 20260501000000_init.sql      ← Full schema:
│   │                                       - Tables (salons, pros, services, bookings)
│   │                                       - Exclusion constraint (no double-book)
│   │                                       - RLS policies (multi-tenant)
│   │                                       - RPCs (availability, guest booking)
│   │
│   ├── config.toml                       ← Supabase local dev config
│   └── seed.sql                          ← (Planned: demo data)
│
├── 📁 public/                            ← Static assets
│   └── (favicon, images, etc.)
│
├── 📁 docs/
│   └── SETUP.md                          ← Quick start guide
│
└── 📁 .github/
    └── workflows/
        └── ci.yml                        ← GitHub Actions pipeline
```

## 🎯 Where to Find Things

### "I want to change the color scheme"
→ `styles/globals.css` (lines 8-20) + `tailwind.config.ts`

### "I want to add a new service (e.g., 'Manicure')"
→ `lib/data.ts` → `SERVICES` array

### "I want to add a new professional"
→ `lib/data.ts` → `PROFESSIONALS` array

### "I want to modify working hours defaults"
→ `lib/data.ts` → `INITIAL_WORKING_HOURS`

### "I want to change available time slots (e.g., 09:00 → 08:00)"
→ `lib/data.ts` → `ALL_TIME_SLOTS`

### "I want to understand the booking flow"
→ `components/booking/ClientBooking.tsx` (6 step components at end of file)

### "I want to understand admin features"
→ `components/admin/AdminDashboard.tsx` (5 view functions at end)

### "I want to understand availability logic"
→ `lib/availability.ts` → `getAvailableSlots()` function

### "I want to see the database schema"
→ `supabase/migrations/20260501000000_init.sql`

### "I want to deploy to Vercel"
→ Follow instructions in `README.md` → Deployment section

### "I'm stuck on setup"
→ Read `docs/SETUP.md` step-by-step

## 📝 File Dependencies

```
app/booking/page.tsx
  ↓
components/booking/ClientBooking.tsx
  ├─→ lib/data.ts (DEPARTMENTS, PROFESSIONALS, SERVICES, types)
  ├─→ lib/dates.ts (localDateString, getWeekDays, formatters)
  ├─→ lib/availability.ts (getAvailableSlots — real availability engine)
  ├─→ lib/validation.ts (isValidName, isValidPhone)
  └─→ lucide-react (icons: ArrowLeft, ArrowRight, Check, Phone)


app/admin/page.tsx
  ↓
components/admin/AdminDashboard.tsx
  ├─→ lib/data.ts (PROFESSIONALS, SERVICES, ALL_TIME_SLOTS, types)
  ├─→ lib/dates.ts (localDateString, getWeekDays, formatShortDate)
  ├─→ lucide-react (icons: LayoutGrid, Calendar, List, Users, Scissors, etc.)
  └─→ (state management via React.useState — no external store)


app/layout.tsx
  ├─→ styles/globals.css (Tailwind + custom CSS variables)
  └─→ Google Fonts (Bodoni Moda, Manrope)
```

## 🔒 Data Flow

### Client Booking (Guest)
1. User visits `/booking` → `ClientBooking.tsx` mounts
2. Selects dept → services → pro → date/time → name/phone
3. On confirm → creates `Booking` object in local state
4. (Future: RPC call to `create_guest_booking`)
5. Success screen shows booking reference

### Admin
1. User visits `/admin` → `AdminDashboard.tsx` mounts
2. Bookings start from `SEED_BOOKINGS` in local state
3. Admin can:
   - View calendar, change booking status
   - Add manual phone bookings (via dialog)
   - Manage staff working hours
   - Toggle services active/inactive
4. All changes update `bks` state immediately
5. (Future: mutations to Supabase)

## 🚀 Component Prop Drilling

All components are self-contained with local state. No context providers yet.

### ClientBooking Props
```typescript
{
  onBack?: () => void   // Optional back button callback
}
```

### AdminDashboard Props
```typescript
// No props — fully self-contained
```

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.0.0 | React framework |
| `react` | ^18.2.0 | UI library |
| `tailwindcss` | ^3.3.0 | Styling |
| `lucide-react` | ^0.294.0 | Icons |
| `@supabase/supabase-js` | ^2.38.0 | DB client (not yet wired) |
| `typescript` | ^5.2.0 | Type checking |

## 🔌 Future Integration Points

### Supabase Auth
Replace dummy state in `app/admin/page.tsx` with:
```typescript
const { data: { session } } = await supabase.auth.getSession();
```

### Supabase Bookings
Replace `useState(SEED_BOOKINGS)` with live Supabase query:
```typescript
const { data: bookings } = await supabase
  .from('bookings')
  .select('*')
  .eq('salon_id', salonId);
```

### Storage (Portfolio Upload)
```typescript
const { data, error } = await supabase.storage
  .from('portfolios')
  .upload(`${proId}/${filename}`, file);
```

## 🛠️ Customization Checklist

- [ ] Change colors in `styles/globals.css`
- [ ] Update salon name in `lib/data.ts` → `SALON_NAME`
- [ ] Add/remove departments in `DEPARTMENTS`
- [ ] Add/remove professionals in `PROFESSIONALS`
- [ ] Modify services in `SERVICES`
- [ ] Change time slots in `ALL_TIME_SLOTS`
- [ ] Deploy to Vercel
- [ ] Wire Supabase Auth
- [ ] Wire Supabase data (queries/mutations)
- [ ] Add SMS/email notifications
