import { api } from './api'

// ------------------------------------------------------------------
// Staff can sign in / out with no signal. Every action is saved to
// localStorage first (the UI never blocks), pushed to a queue, and
// synced to the server in order whenever a connection is available.
// Each visit gets a client-generated UUID, so retries are idempotent
// (a flaky connection can never create a duplicate visit).
//
// localStorage keys:
//   ijc_open_entry   -> the visit currently in progress (or null)
//   ijc_pending_ops  -> ordered queue of writes waiting for the server
//   ijc_recent       -> last few completed visits for the on-screen list
// ------------------------------------------------------------------

const OPEN_KEY = 'ijc_open_entry'
const QUEUE_KEY = 'ijc_pending_ops'
const RECENT_KEY = 'ijc_recent'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

export const getOpenEntry = () => read(OPEN_KEY, null)
export const getRecentEntries = () => read(RECENT_KEY, [])
const getQueue = () => read(QUEUE_KEY, [])
const setQueue = (q) => write(QUEUE_KEY, q)

function pushRecent(entry) {
  const recent = getRecentEntries()
  recent.unshift(entry)
  write(RECENT_KEY, recent.slice(0, 15))
}
function enqueue(op) {
  const q = getQueue()
  q.push(op)
  setQueue(q)
}
const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      }))

// ---- SIGN IN ----------------------------------------------------------

export async function signIn({ staffId, siteId, siteNameOther }) {
  const now = new Date().toISOString()
  const id = newId()
  const entry = {
    localId: id, id,
    staff_id: staffId,
    site_id: siteId || null,
    site_name_other: siteNameOther || null,
    sign_in_at: now,
    sign_in_offline: !navigator.onLine,
    sign_out_at: null,
    notes: ''
  }
  write(OPEN_KEY, entry)
  enqueue({ op: 'insert', payload: {
    id, site_id: entry.site_id, site_name_other: entry.site_name_other,
    sign_in_at: now, sign_in_offline: entry.sign_in_offline
  }})
  flushQueue()
  return entry
}

// ---- SIGN OUT ---------------------------------------------------------

export async function signOut({ notes }) {
  const entry = getOpenEntry()
  if (!entry) return null
  const now = new Date().toISOString()
  entry.sign_out_at = now
  entry.sign_out_offline = !navigator.onLine
  entry.notes = notes || ''
  enqueue({ op: 'update', payload: {
    id: entry.id, sign_out_at: now, sign_out_offline: entry.sign_out_offline, notes: entry.notes
  }})
  localStorage.removeItem(OPEN_KEY)
  pushRecent(entry)
  flushQueue()
  return entry
}

export async function updateNotes(notes) {
  const entry = getOpenEntry()
  if (!entry) return
  entry.notes = notes
  write(OPEN_KEY, entry)
  enqueue({ op: 'update', payload: { id: entry.id, notes } })
  flushQueue()
}

// ---- SYNC -------------------------------------------------------------

let syncing = false

export async function flushQueue() {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    const queue = getQueue()
    let i = 0
    for (; i < queue.length; i++) {
      const item = queue[i]
      try {
        await api('/entries', {
          method: item.op === 'insert' ? 'POST' : 'PATCH',
          body: item.payload
        })
      } catch (err) {
        // Keep on network error, 401 (re-login needed) or server error; stop this pass.
        const permanent = err.status && err.status >= 400 && err.status < 500 && err.status !== 401
        if (!permanent) break
        // Permanent client error (bad data): drop it so it can't block the queue.
      }
    }
    // Anything enqueued while we were syncing is preserved.
    const current = getQueue()
    setQueue(current.slice(i))
  } finally {
    syncing = false
  }
}

export function setupAutoSync() {
  window.addEventListener('online', flushQueue)
  setInterval(flushQueue, 30000)
  flushQueue()
}

export function pendingCount() { return getQueue().length }
