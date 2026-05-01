# 🎨 ATELIER — Project Index

A luxury B2B2C beauty salon booking system. Everything organized by folder and file.

## ⚡ Quick Links

| Need | Go to |
|------|-------|
| **Setup Instructions** | [`docs/SETUP.md`](docs/SETUP.md) |
| **Project Overview** | [`README.md`](README.md) |
| **File Reference** | [`docs/FILE_GUIDE.md`](docs/FILE_GUIDE.md) |
| **Run Dev Server** | `npm run dev` |
| **Client Booking** | [http://localhost:3000/booking](http://localhost:3000/booking) |
| **Admin Dashboard** | [http://localhost:3000/admin](http://localhost:3000/admin) |

---

## 📂 Folder Breakdown

### `app/` — Next.js Pages
- **`layout.tsx`** — Root layout, global styles, fonts
- **`page.tsx`** — Home page with links to booking & admin
- **`booking/page.tsx`** — Routes to client booking
- **`admin/page.tsx`** — Routes to admin dashboard

### `components/` — React Components
- **`booking/ClientBooking.tsx`** — Full 6-step guest flow
  - Step 1: Departments (Tbilisi, Batumi, Kutaisi)
  - Step 2: Services (with pricing)
  - Step 3: Professionals (with portfolio)
  - Step 4: Schedule (7-day calendar + time slots)
  - Step 5: Details (name + phone)
  - Step 6: Success (reference #)
  
- **`admin/AdminDashboard.tsx`** — Admin with 5 tabs
  - Today: Stats + bookings
  - Calendar: 7-day grid
  - Bookings: Filterable list
  - Staff: Working hours editor
  - Services: CRUD table

### `lib/` — Business Logic
- **`data.ts`** — All constants (pros, services, depts) + types
- **`dates.ts`** — Date helpers (timezone-safe)
- **`availability.ts`** — Slot availability engine
- **`validation.ts`** — Phone & name validators
- **`supabase/`** — (Future) Supabase clients

### `styles/` — Styling
- **`globals.css`** — Tailwind + custom luxury theme

### `supabase/` — Database
- **`migrations/20260501000000_init.sql`** — Full schema + RLS + RPCs

### `docs/` — Documentation
- **`SETUP.md`** — Step-by-step setup guide
- **`FILE_GUIDE.md`** — What's in each file & where to change things

### `public/` — Static Assets
- Favicon, images (currently empty, add as needed)

---

## 🎨 Design System

**Colors** (see `styles/globals.css` lines 8-20):
- Background: `#14110d` (charcoal)
- Cream: `#f5efe6` (off-white)
- Dark: `#14110d` (same as bg, for text on light)

**Fonts** (Google Fonts, loaded in `app/layout.tsx`):
- Display: **Bodoni Moda** (serif, headlines)
- Body: **Manrope** (sans, UI)

**Components**:
- No external UI library — custom Tailwind
- Hairline underline inputs
- Minimal buttons with clear hierarchy

---

## 🚀 Development Workflow

1. **Start here**: `docs/SETUP.md`
2. **Understand structure**: This file + `docs/FILE_GUIDE.md`
3. **Run dev server**: `npm run dev`
4. **Test both flows**: `/booking` and `/admin`
5. **Make changes**:
   - UI tweaks → `components/`
   - Logic → `lib/`
   - Colors → `styles/globals.css`
   - Data → `lib/data.ts`
6. **Ready to deploy**: `npm run build` then `npm run start`

---

## 📋 Key Features

✅ **Client Flow** (no account required)
- 6-step guest checkout
- Real-time availability
- Name + mobile confirmation

✅ **Admin Dashboard**
- Calendar + bookings management
- Staff hours editor
- Phone booking lockdown
- Status tracking

✅ **Design**
- Luxury dark theme
- Bodoni Moda + Manrope fonts
- Responsive mobile → desktop
- Smooth transitions

✅ **Database** (Supabase)
- Multi-tenant (multiple locations)
- Exclusion constraint (no double-booking)
- RLS for security
- Availability engine RPC

---

## 🔧 Configuration

### Change Colors
File: `styles/globals.css` (lines 8-20)
```css
:root {
  --luxe-bg: #14110d;
  --luxe-cream: #f5efe6;
  /* ... etc */
}
```

### Add a Service
File: `lib/data.ts` → `SERVICES` array
```typescript
{
  id: 's6',
  name: 'New Service',
  duration: 90,
  price: 299,
}
```

### Modify Time Slots
File: `lib/data.ts` → `ALL_TIME_SLOTS`
```typescript
export const ALL_TIME_SLOTS = ['09:00', '09:30', '10:00', ...];
```

### Change Department Locations
File: `lib/data.ts` → `DEPARTMENTS` array

---

## 🧪 Testing

**Client Booking**:
1. Go to `/booking`
2. Select Tbilisi → Signature Cut → Anastasia → Tomorrow 10:00 → Anna Beridze / +995599123456
3. See success screen

**Admin Dashboard**:
1. Go to `/admin`
2. Try:
   - Click "Add Booking" → fill form
   - Change booking status on calendar
   - Click Staff tab → expand hours editor
   - Switch date on calendar

---

## 📱 Responsive

- Mobile-first design
- All components scale 320px → 1920px
- Touch-friendly (min 44px buttons)
- No fixed widths on main containers

---

## 🚢 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repo to Vercel
3. Set env vars
4. Deploy (auto on push)

### Docker
```bash
docker build -t salon-booking .
docker run -p 3000:3000 salon-booking
```

### Traditional
```bash
npm run build
npm run start
```

---

## 🔮 Roadmap

- [ ] Supabase Auth (magic link)
- [ ] Live bookings (realtime sync)
- [ ] Portfolio upload to Storage
- [ ] SMS/email notifications (Twilio)
- [ ] Analytics dashboard
- [ ] Multi-language (Georgian, Russian)
- [ ] Stripe payments (optional)

---

## 📚 Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com
- **Supabase**: https://supabase.com/docs
- **Lucide Icons**: https://lucide.dev

---

## 🎯 Next Steps

1. Read `docs/SETUP.md` (5 min)
2. Run `npm install` && `npm run dev` (2 min)
3. Click through `/booking` flow (2 min)
4. Try `/admin` tabs (3 min)
5. Pick one customization from `docs/FILE_GUIDE.md` and try it
6. Deploy to Vercel

---

**Questions?** Check `docs/` folder or review code comments in components.
