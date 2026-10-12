import { sql } from '../_lib/db.js'
import { verifyPassword, signToken, publicProfile, send } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  const { email, password } = req.body || {}
  const e = String(email || '').trim().toLowerCase()
  const rows = await sql`select * from profiles where email = ${e}`
  const p = rows[0]
  if (!p || !(await verifyPassword(String(password || ''), p.password_hash)))
    return send(res, 401, { error: 'Incorrect email or password.' })
  return send(res, 200, { token: await signToken(p.id), profile: publicProfile(p) })
}
