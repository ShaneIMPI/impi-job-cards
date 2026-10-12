import { sql } from '../_lib/db.js'
import { hashPassword, signToken, publicProfile, send, safe } from '../_lib/auth.js'

export default safe(async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  const { email, password, full_name } = req.body || {}
  const e = String(email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(e)) return send(res, 400, { error: 'Enter a valid email address.' })
  if (!password || String(password).length < 8) return send(res, 400, { error: 'Password must be at least 8 characters.' })
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase()
  if (domain && !e.endsWith('@' + domain)) return send(res, 403, { error: `Only @${domain} emails can register.` })
  const name = String(full_name || '').trim() || e.split('@')[0]
  const hash = await hashPassword(String(password))
  try {
    const rows = await sql`insert into profiles (email, password_hash, full_name) values (${e}, ${hash}, ${name}) returning id,email,full_name,role,active`
    return send(res, 200, { token: await signToken(rows[0].id), profile: publicProfile(rows[0]) })
  } catch (err) {
    if (String(err.message).includes('unique')) return send(res, 409, { error: 'That email is already registered. Please sign in.' })
    throw err
  }
})
