import { neon } from '@neondatabase/serverless'

let client
export class ConfigError extends Error {}

// Lazy init so a missing env var gives a clear message instead of crashing the function.
export function sql(strings, ...values) {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new ConfigError('DATABASE_URL is not set in Vercel (Settings → Environment Variables), or the project was not redeployed after adding it.')
    client = neon(url)
  }
  return client(strings, ...values)
}
