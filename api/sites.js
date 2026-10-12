import { sql } from './_lib/db.js'
import { getUser, send } from './_lib/auth.js'

export default async function handler(req, res) {
  const u = await getUser(req)
  if (!u || !u.active) return send(res, 401, { error: 'Not signed in' })
  if (req.method === 'GET') {
    const rows = await sql`select id,name,active from sites where active = true order by name`
    return send(res, 200, { sites: rows })
  }
  if (u.role !== 'admin') return send(res, 403, { error: 'Admins only' })
  if (req.method === 'POST') {
    const name = String((req.body || {}).name || '').trim()
    if (!name) return send(res, 400, { error: 'Name required' })
    const rows = await sql`insert into sites (name) values (${name}) on conflict (name) do update set active = true returning id,name,active`
    return send(res, 200, { site: rows[0] })
  }
  return send(res, 405, { error: 'Method not allowed' })
}
