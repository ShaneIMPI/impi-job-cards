import { sql } from './_lib/db.js'
import { getUser, send, safe } from './_lib/auth.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default safe(async function handler(req, res) {
  const u = await getUser(req)
  if (!u || !u.active) return send(res, 401, { error: 'Not signed in' })
  const b = req.body || {}

  // List visits for reports. Staff: own only. HR/admin: any one person or everyone.
  //   ?month=YYYY-MM   (South Africa time)   ?staff=all | <profile id>
  if (req.method === 'GET') {
    const privileged = u.role === 'admin' || u.role === 'hr'
    const q = req.query || {}
    let staffFilter = u.id
    if (privileged) {
      if (q.staff === 'all' || q.all === '1') staffFilter = null
      else if (UUID.test(q.staff || '')) staffFilter = q.staff
    }
    const from = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month || '') ? q.month + '-01' : null
    const rows = await sql`
      select e.*, p.full_name, p.email, s.name as site_name
      from job_entries e
      join profiles p on p.id = e.staff_id
      left join sites s on s.id = e.site_id
      where (${staffFilter}::uuid is null or e.staff_id = ${staffFilter}::uuid)
        and (${from}::date is null or (
              e.sign_in_at >= (${from}::date::timestamp at time zone 'Africa/Johannesburg')
          and e.sign_in_at <  ((${from}::date + interval '1 month')::timestamp at time zone 'Africa/Johannesburg')))
      order by e.sign_in_at asc
      limit 5000`
    return send(res, 200, { entries: rows })
  }

  // Create (idempotent: client supplies the id, so offline retries never duplicate)
  if (req.method === 'POST') {
    if (!UUID.test(b.id || '')) return send(res, 400, { error: 'Valid id required' })
    if (!b.site_id && !b.site_name_other) return send(res, 400, { error: 'Site required' })
    const rows = await sql`
      insert into job_entries (id, staff_id, site_id, site_name_other, sign_in_at, sign_in_offline, sign_out_at, sign_out_offline, notes)
      values (${b.id}, ${u.id}, ${b.site_id || null}, ${b.site_name_other || null},
              ${b.sign_in_at || new Date().toISOString()}, ${!!b.sign_in_offline},
              ${b.sign_out_at || null}, ${!!b.sign_out_offline}, ${b.notes || ''})
      on conflict (id) do nothing
      returning id`
    return send(res, 200, { ok: true, created: rows.length > 0 })
  }

  // Update sign-out / notes
  if (req.method === 'PATCH') {
    if (!UUID.test(b.id || '')) return send(res, 400, { error: 'Valid id required' })
    const rows = await sql`
      update job_entries set
        sign_out_at = coalesce(${b.sign_out_at ?? null}, sign_out_at),
        sign_out_offline = case when ${b.sign_out_at ?? null}::timestamptz is not null then ${!!b.sign_out_offline} else sign_out_offline end,
        notes = coalesce(${b.notes ?? null}, notes)
      where id = ${b.id} and (staff_id = ${u.id} or ${u.role === 'admin'})
      returning id`
    if (!rows.length) return send(res, 404, { error: 'Entry not found' })
    return send(res, 200, { ok: true })
  }
  return send(res, 405, { error: 'Method not allowed' })
})
