# IMPI Job Cards — Neon + Vercel edition

Same staff app as before (sign in/out of sites, notes, works offline and syncs),
now running on **Neon Postgres** with a small API on **Vercel**. No Supabase.

> Your old Supabase data was deleted with the project. This restores the app and
> a fresh database; staff re-register and sites are re-added (steps 5–6).

## 1. Create the Neon database
1. neon.tech → **New Project** (e.g. `impi-jobcards`, region closest to you).
2. Open **SQL Editor**, paste all of `db/schema.sql`, click **Run**.
3. On the project dashboard click **Connect** and copy the **pooled connection string**
   (`postgres://…neon.tech/neondb?sslmode=require`).

## 2. Push to GitHub
Create a repo `impi-jobcards` and upload everything in this folder
(not `node_modules` or `dist`).

## 3. Deploy on Vercel
1. vercel.com → **Add New → Project** → import the repo (Framework: **Vite**, auto-detected).
2. Before deploying, add **Environment Variables**:
   - `DATABASE_URL` — the Neon connection string
   - `JWT_SECRET` — a long random string (e.g. run `openssl rand -base64 48`)
   - `ALLOWED_EMAIL_DOMAIN` — optional, e.g. `impi-secure.co.za` (blocks outside emails registering)
3. **Deploy**. The app is live at `https://<project>.vercel.app`.

## 4. Make yourself admin
Open the app, **Create account** with your email, then in Neon's SQL Editor:
```sql
update profiles set role = 'admin' where email = 'shane@impi-secure.co.za';
update profiles set role = 'hr' where email = 'hr-contact@example.com';
```

## 5. Add sites
```sql
insert into sites (name) values ('Your site name') on conflict (name) do nothing;
```
(Two starter sites are inserted by the schema. Staff can still type a one-off site name.)

## Notes
- Login is email + password (replaces Supabase magic links, so no email provider is needed).
  Sessions last 90 days and keep working offline.
- Forgot password: reset in Neon with a new hash, or delete the profile row and re-register.
- Local dev: `npm i -g vercel`, `vercel dev` (needs the env vars above).
- Phase 2 (HR dashboard, admin panel, monthly export) can be built on `GET /api/entries?all=1`,
  which already returns all staff visits for HR/admin roles.
