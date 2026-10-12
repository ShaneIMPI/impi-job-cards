import { useState } from 'react'
import { api, saveSession } from '../api'

export default function Login({ onSignedIn }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, profile } = await api(mode === 'login' ? '/auth/login' : '/auth/signup', {
        method: 'POST',
        body: { email: email.trim(), password, full_name: fullName.trim() }
      })
      saveSession(token, profile)
      onSignedIn(profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <div className="brandbar">
        <div className="brandbar-left">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Amandla Protection Services" className="brand-logo" />
          <div className="name">IMPI <span>Job Cards</span></div>
        </div>
      </div>

      <div className="card">
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="hint">
          {mode === 'login'
            ? 'Sign in with your work email and password. You stay signed in on this device, even offline.'
            : 'Register with your work email. Choose a password of at least 8 characters.'}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" autoComplete="name" value={fullName}
                onChange={(e) => setFullName(e.target.value)} required />
            </>
          )}
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" inputMode="email"
            placeholder="you@impi-secure.co.za" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
        <button className="link" type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'login' ? 'First time? Create an account' : 'Already registered? Sign in'}
        </button>
      </div>
    </div>
  )
}
