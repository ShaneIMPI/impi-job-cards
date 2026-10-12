import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import Reports from './Reports.jsx'
import {
  getOpenEntry, getRecentEntries, signIn, signOut, updateNotes, queueSiteSave,
  setupAutoSync, pendingCount
} from '../offlineQueue'

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

export default function Home({ profile, onLogout }) {
  const [view, setView] = useState('home')
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [siteOther, setSiteOther] = useState('')
  const [notes, setNotes] = useState('')
  const [openEntry, setOpenEntry] = useState(getOpenEntry())
  const [recent, setRecent] = useState(getRecentEntries())
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(pendingCount())
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    setOpenEntry(getOpenEntry())
    setRecent(getRecentEntries())
    setPending(pendingCount())
  }, [])

  useEffect(() => {
    setupAutoSync()
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    const interval = setInterval(refresh, 5000)

    const cachedSites = (() => { try { return JSON.parse(localStorage.getItem('ijc_sites') || '[]') } catch { return [] } })()
    setSites(cachedSites)
    api('/sites')
      .then(({ sites }) => { setSites(sites); localStorage.setItem('ijc_sites', JSON.stringify(sites)) })
      .catch(() => {})

    if (openEntry) setNotes(openEntry.notes || '')

    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn(e, saveSite = false) {
    if (e && e.preventDefault) e.preventDefault()
    if (!siteId && !siteOther.trim()) return
    setBusy(true)
    let useSiteId = siteId || null
    let useOther = siteId ? null : siteOther.trim()
    if (!siteId && saveSite) {
      // Save the new site to the shared list so it appears in everyone's dropdown.
      try {
        if (!navigator.onLine) throw new Error('offline')
        const { site } = await api('/sites', { method: 'POST', body: { name: siteOther.trim() } })
        useSiteId = site.id
        useOther = null
        setSites((prev) => {
          const next = prev.some((x) => x.id === site.id) ? prev : [...prev, site].sort((a, b) => a.name.localeCompare(b.name))
          localStorage.setItem('ijc_sites', JSON.stringify(next))
          return next
        })
      } catch {
        // Offline or failed: sign in with the typed name now and save the site once back online.
        queueSiteSave(siteOther.trim())
      }
    }
    await signIn({ staffId: profile.id, siteId: useSiteId, siteNameOther: useOther })
    setBusy(false)
    setSiteId('')
    setSiteOther('')
    refresh()
  }

  async function handleSignOut() {
    setBusy(true)
    await signOut({ notes })
    setBusy(false)
    setNotes('')
    refresh()
  }

  const [newSite, setNewSite] = useState('')
  const [siteMsg, setSiteMsg] = useState('')
  async function reloadSites() {
    const { sites } = await api('/sites')
    setSites(sites)
    localStorage.setItem('ijc_sites', JSON.stringify(sites))
  }
  async function handleAddSite(e) {
    e.preventDefault()
    if (!newSite.trim()) return
    setSiteMsg('')
    try {
      await api('/sites', { method: 'POST', body: { name: newSite.trim() } })
      setNewSite('')
      await reloadSites()
      setSiteMsg('Site added.')
    } catch (err) { setSiteMsg(err.message) }
  }
  async function handleRemoveSite(id, name) {
    if (!window.confirm(`Remove "${name}" from the site list? Past visits are kept.`)) return
    try {
      await api('/sites', { method: 'PATCH', body: { id, active: false } })
      await reloadSites()
    } catch (err) { setSiteMsg(err.message) }
  }

  async function handleNotesBlur() {
    if (openEntry) await updateNotes(notes)
  }

  function handleLogout() {
    onLogout()
  }

  const siteLabel = (entry) => {
    if (entry.site_id) {
      const s = sites.find((x) => x.id === entry.site_id)
      return s ? s.name : 'Site'
    }
    return entry.site_name_other || 'Site'
  }

  if (view === 'reports') return <Reports profile={profile} onBack={() => setView('home')} />

  return (
    <div className="screen">
      <div className="brandbar">
        <div className="brandbar-left">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Amandla Protection Services" className="brand-logo" />
          <div className="name">IMPI <span>Job Cards</span></div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <button className="link" onClick={() => setView('reports')}>Reports</button>
          <button className="link" onClick={handleLogout}>Sign out of app</button>
        </div>
      </div>

      {!online && (
        <div className="card" style={{ background: '#fdf3d6', border: '1px solid #f0d878' }}>
          <strong>No signal.</strong> Your sign-in/out will be saved on this device and sent
          automatically once you're back online.
        </div>
      )}
      {online && pending > 0 && (
        <div className="card" style={{ background: '#fdf3d6', border: '1px solid #f0d878' }}>
          Syncing {pending} saved {pending === 1 ? 'entry' : 'entries'}…
        </div>
      )}

      <div className="card">
        <h1>Hi, {profile.full_name}</h1>
        {openEntry ? (
          <span className="status-pill on">● Signed in — {siteLabel(openEntry)} since {formatTime(openEntry.sign_in_at)}</span>
        ) : (
          <span className="status-pill off">Not signed in</span>
        )}

        {!openEntry ? (
          <form onSubmit={handleSignIn}>
            <label htmlFor="site">Site</label>
            <select id="site" value={siteId} onChange={(e) => { setSiteId(e.target.value); setSiteOther('') }}>
              <option value="">— Select a site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="">Other (type below)</option>
            </select>
            {!siteId && (
              <input
                type="text"
                placeholder="Type site name"
                value={siteOther}
                onChange={(e) => setSiteOther(e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
            {siteId || !siteOther.trim() ? (
              <button className="primary" type="submit" disabled={busy || (!siteId && !siteOther.trim())}>
                Sign in now
              </button>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 12 }}>
                  “{siteOther.trim()}” isn't on the list. Is this a site you visit regularly?
                </p>
                <button className="primary" type="button" disabled={busy} onClick={(e) => handleSignIn(e, false)}>
                  Sign in — one-time use
                </button>
                <button className="primary" type="button" disabled={busy} onClick={(e) => handleSignIn(e, true)}
                  style={{ marginTop: 8, background: '#1a1a1a' }}>
                  Sign in &amp; save site for next time
                </button>
              </>
            )}
          </form>
        ) : (
          <div>
            <label htmlFor="notes">Notes — what are you doing here today?</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="e.g. CCTV fault inspection, met with site manager…"
            />
            <button className="primary" onClick={handleSignOut} disabled={busy}>
              Sign out of this site
            </button>
          </div>
        )}
      </div>

      {profile.role === 'admin' && (
        <div className="card">
          <h2>Admin — manage sites</h2>
          <form onSubmit={handleAddSite}>
            <input type="text" placeholder="New site name" value={newSite}
              onChange={(e) => setNewSite(e.target.value)} />
            <button className="primary" type="submit" disabled={!online || !newSite.trim()}>Add site</button>
          </form>
          {siteMsg && <p className="hint">{siteMsg}</p>}
          {sites.map((s) => (
            <div className="entry-row" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{s.name}</span>
              <button className="link" type="button" onClick={() => handleRemoveSite(s.id, s.name)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="card">
          <h2>Recent visits</h2>
          {recent.map((r) => (
            <div className="entry-row" key={r.localId}>
              <div className="site">{siteLabel(r)} <span className="times">— {formatDate(r.sign_in_at)}</span></div>
              <div className="times">
                {formatTime(r.sign_in_at)} → {formatTime(r.sign_out_at)}
                {(r.sign_in_offline || r.sign_out_offline) && <span className="offline-tag"> · saved offline</span>}
              </div>
              {r.notes && <div className="notes">{r.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
