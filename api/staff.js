import { sql } from './_lib/db.js'
import { getUser, send, safe } from './_lib/auth.js'

// HR/admin: list of staff for the report picker.
export default safe(async function handler(req, res) {
  const u = await getUser(req)
  if (!u || !u.active) return send(res, 401, { error: 'Not signed in' })
  if (u.role !== 'admin' && u.role !== 'hr') return send(res, 403, { error: 'HR or admin only' })
  const rows = await sql`select id, full_name, email, role, active from profiles order by full_name`
  return send(res, 200, { staff: rows })
})
