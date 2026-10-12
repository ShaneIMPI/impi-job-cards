import { SignJWT, jwtVerify } from 'jose'
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sql } from './db.js'

const scryptAsync = promisify(scrypt)
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '')

export async function hashPassword(pw) {
  const salt = randomBytes(16)
  const key = await scryptAsync(pw, salt, 64)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}
export async function verifyPassword(pw, stored) {
  const [saltHex, keyHex] = stored.split(':')
  const key = await scryptAsync(pw, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(keyHex, 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}
export function signToken(userId) {
  return new SignJWT({}).setSubject(userId).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('90d').sign(secret())
}
// Returns the live profile row for the bearer token, or null.
export async function getUser(req) {
  try {
    const h = req.headers.authorization || ''
    if (!h.startsWith('Bearer ')) return null
    const { payload } = await jwtVerify(h.slice(7), secret())
    const rows = await sql`select id,email,full_name,role,active,created_at from profiles where id = ${payload.sub}`
    return rows[0] || null
  } catch { return null }
}
export function publicProfile(p) {
  return { id: p.id, email: p.email, full_name: p.full_name, role: p.role, active: p.active }
}
export const send = (res, code, body) => res.status(code).json(body)

// Wrap a handler so any crash returns readable JSON (and is logged in Vercel).
import { ConfigError } from './db.js'
export const safe = (fn) => async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) throw new ConfigError('JWT_SECRET is not set in Vercel, or the project was not redeployed after adding it.')
    return await fn(req, res)
  } catch (err) {
    console.error(err)
    const msg = err instanceof ConfigError ? err.message
      : /relation .* does not exist/i.test(err.message || '') ? 'Database tables are missing. Run db/schema.sql in the Neon SQL Editor.'
      : 'Server error: ' + (err.message || 'unknown')
    return res.status(500).json({ error: msg })
  }
}
