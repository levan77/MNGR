# Quick Start Guide

## 1. Prerequisites

- Node.js 18+ ([download](https://nodejs.org/))
- Git
- Supabase account ([sign up free](https://supabase.com))

## 2. Clone the Repository

```bash
git clone https://github.com/yourusername/salon-booking-system.git
cd salon-booking-system
```

## 3. Install Dependencies

```bash
npm install
```

This installs:
- `next`, `react`, `react-dom`
- `@supabase/supabase-js`, `@supabase/ssr`
- `lucide-react` (icons)
- `tailwindcss` (styling)

## 4. Set Up Supabase

### Option A: Use Existing Project

1. Go to [supabase.com](https://supabase.com) → Dashboard
2. Create a new project or select existing
3. Copy your **Project URL** and **Anon Key** from Settings → API

### Option B: Local Development (Optional)

```bash
npm install -g supabase
supabase start
```

## 5. Configure Environment

Create `.env.local` in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Never commit `.env.local` to Git!** It's in `.gitignore`.

## 6. Apply Database Schema

### Push Migrations to Supabase

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Or manually:
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `supabase/migrations/20260501000000_init.sql`
4. Run the query

## 7. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Test Both Flows

- **Client Booking**: [http://localhost:3000/booking](http://localhost:3000/booking)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

## 8. Folder Tour

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js pages & routes |
| `components/` | React components (booking, admin) |
| `lib/` | Utilities (dates, validation, availability) |
| `styles/` | Tailwind CSS + custom styles |
| `supabase/` | Database migrations & seed data |
| `public/` | Static assets |

## Key Files to Edit

### Add a New Service

Edit `lib/data.ts`:

```typescript
export const SERVICES = [
  // ... existing
  {
    id: 's6',
    name: 'New Service',
    tagline: 'Description here.',
    duration: 90,
    buffer: 15,
    price: 299,
  },
];
```

### Change Theme Colors

Edit `styles/globals.css`:

```css
:root {
  --luxe-bg: #14110d;      /* Dark background */
  --luxe-cream: #f5efe6;   /* Light text */
  /* ... more colors */
}
```

### Modify Working Hours

Edit `lib/data.ts`:

```typescript
export const INITIAL_WORKING_HOURS = {
  p1: [
    null,                          // Sunday off
    { s: '09:00', e: '19:00' },   // Monday 9-7pm
    { s: '09:00', e: '19:00' },   // Tuesday
    // ...
  ],
};
```

## Troubleshooting

### "env variable missing"

Make sure `.env.local` exists with correct values. Restart `npm run dev` after creating it.

### "Supabase connection failed"

- Check that `NEXT_PUBLIC_SUPABASE_URL` is correct (should start with `https://`)
- Verify the project is running (if local, run `supabase start`)
- Check firewall/network permissions

### "Tailwind not loading"

Run:

```bash
npm run build
# Then
npm run dev
```

### Port 3000 already in use

Run on a different port:

```bash
npm run dev -- -p 3001
```

## Build for Production

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push code to GitHub
2. Connect repo to [vercel.com](https://vercel.com)
3. Set environment variables in Vercel Settings
4. Deploy (auto-deploys on push to `main`)

## Next Steps

- [ ] Wire Supabase Auth (magic link login for admin)
- [ ] Add portfolio image upload to Storage
- [ ] Implement Twilio SMS reminders
- [ ] Add analytics & reporting
- [ ] Multi-language support (Georgian, Russian, English)

## Need Help?

- Check `README.md` for architecture overview
- Review code comments in components
- Open an issue on GitHub
