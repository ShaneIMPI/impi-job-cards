// Tiny client for the /api functions (replaces the Supabase client).
const TOKEN_KEY = 'ijc_token'
const PROFILE_KEY = 'ijc_profile'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const getCachedProfile = () => {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') } catch { return null }
}
export function saveSession(token, profile) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  let data = {}
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data.error || `Server error (HTTP ${res.status}). Check /api/health`)
    err.status = res.status
    throw err
  }
  return data
}
