import { sql } from './_lib/db.js'
import { getUser, send, safe } from './_lib/auth.js'

export default safe(async function handler(req, res) {
  const u = await getUser(req)
  if (!u || !u.active) return send(res, 401, { error: 'Not signed in' })
  if (req.method === 'GET') {
    const rows = await sql`select id,name,active from sites where active = true order by name`
    return send(res, 200, { sites: rows })
  }
  if (req.method === 'POST') {
    const name = String((req.body || {}).name || '').trim().replace(/\s+/g, ' ')
    if (!name) return send(res, 400, { error: 'Name required' })
    const existing = await sql`select id,name,active from sites where lower(name) = lower(${name}) limit 1`
    if (existing.length) {
      if (!existing[0].active) await sql`update sites set active = true where id = ${existing[0].id}`
      return send(res, 200, { site: { ...existing[0], active: true } })
    }
    const rows = await sql`insert into sites (name) values (${name}) on conflict (name) do update set active = true returning id,name,active`
    return send(res, 200, { site: rows[0] })
  }
  if (u.role !== 'admin') return send(res, 403, { error: 'Admins only' })
  if (req.method === 'PATCH') {
    const { id, active } = req.body || {}
    if (!id) return send(res, 400, { error: 'id required' })
    await sql`update sites set active = ${!!active} where id = ${id}`
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'Method not allowed' })
})
