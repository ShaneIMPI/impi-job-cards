import { useEffect, useState } from 'react'
import { api, getToken, getCachedProfile, saveSession, clearSession } from './api'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'

export default function App() {
  const [profile, setProfile] = useState(getToken() ? getCachedProfile() : null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    // Refresh the profile; if offline, keep using the cached one.
    api('/auth/me')
      .then(({ profile }) => { saveSession(getToken(), profile); setProfile(profile) })
      .catch((err) => {
        if (err.status === 401) { clearSession(); setProfile(null) }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => { clearSession(); setProfile(null) }

  if (loading && !profile) {
    return <div className="screen"><div className="card"><p>Loading…</p></div></div>
  }
  if (!profile) return <Login onSignedIn={setProfile} />
  if (!profile.active) {
    return (
      <div className="screen">
        <div className="card">
          <p>Your account is currently inactive. Please contact your administrator.</p>
          <button className="link" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    )
  }
  return <Home profile={profile} onLogout={handleLogout} />
}
