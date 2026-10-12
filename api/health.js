import { sql } from './_lib/db.js'
// Open https://YOUR-APP.vercel.app/api/health to see what is configured.
export default async function handler(req, res) {
  const out = { DATABASE_URL: !!process.env.DATABASE_URL, JWT_SECRET: !!process.env.JWT_SECRET, database: 'not checked', tables: 'not checked' }
  try {
    await sql`select 1`
    out.database = 'connected'
    const r = await sql`select to_regclass('public.profiles') as p, to_regclass('public.sites') as s, to_regclass('public.job_entries') as j`
    out.tables = (r[0].p && r[0].s && r[0].j) ? 'ok' : 'MISSING - run db/schema.sql in Neon'
  } catch (e) { out.database = 'ERROR: ' + e.message }
  res.status(200).json(out)
}
