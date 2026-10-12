import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const TZ = 'Africa/Johannesburg'
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-ZA', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-ZA', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : ''
const hoursBetween = (a, b) => (a && b) ? (new Date(b) - new Date(a)) / 3600000 : null
const fmtHours = (h) => h == null ? '' : h.toFixed(2)
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

function currentMonth() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}
function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

export default function Reports({ profile, onBack }) {
  const privileged = profile.role === 'admin' || profile.role === 'hr'
  const [month, setMonth] = useState(currentMonth())
  const [staffId, setStaffId] = useState(privileged ? 'all' : profile.id)
  const [staffList, setStaffList] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!privileged) return
    api('/staff').then(({ staff }) => setStaffList(staff)).catch(() => {})
  }, [privileged])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    api(`/entries?month=${month}&staff=${privileged ? staffId : profile.id}`)
      .then(({ entries }) => { if (!cancelled) setEntries(entries) })
      .catch((e) => { if (!cancelled) setError(navigator.onLine ? e.message : 'You are offline. Reports need a connection.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [month, staffId, privileged, profile.id])

  const rows = useMemo(() => entries.map((e) => {
    const h = hoursBetween(e.sign_in_at, e.sign_out_at)
    return {
      staff: e.full_name,
      date: fmtDate(e.sign_in_at),
      site: e.site_name || e.site_name_other || '',
      inT: fmtTime(e.sign_in_at),
      outT: e.sign_out_at ? fmtTime(e.sign_out_at) : 'Still signed in',
      hours: h,
      notes: e.notes || '',
      offline: e.sign_in_offline || e.sign_out_offline
    }
  }), [entries])

  const total = rows.reduce((t, r) => t + (r.hours || 0), 0)
  const showStaffCol = privileged && staffId === 'all'
  const who = staffId === 'all' && privileged ? 'All staff'
    : (staffList.find((s) => s.id === staffId)?.full_name || (staffId === profile.id ? profile.full_name : (rows[0]?.staff || '')))
  const fileBase = `IMPI-Job-Card-Report_${who.replace(/[^a-z0-9]+/gi, '-')}_${month}`

  function buildCsv() {
    const head = [...(showStaffCol ? ['Staff'] : []), 'Date', 'Site', 'Sign in', 'Sign out', 'Hours', 'Notes']
    const lines = [head.map(csvCell).join(',')]
    rows.forEach((r) => lines.push([...(showStaffCol ? [r.staff] : []), r.date, r.site, r.inT, r.outT, fmtHours(r.hours), r.notes].map(csvCell).join(',')))
    lines.push([...(showStaffCol ? [''] : []), '', '', '', 'Total hours', fmtHours(total), ''].map(csvCell).join(','))
    return '﻿' + lines.join('\r\n')   // BOM so Excel reads it correctly
  }
  function downloadCsv() {
    const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fileBase + '.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function shareCsv() {
    const file = new File([buildCsv()], fileBase + '.csv', { type: 'text/csv' })
    try { await navigator.share({ files: [file], title: 'IMPI Job Card Report' }) } catch { /* cancelled */ }
  }
  const canShare = typeof navigator !== 'undefined' && navigator.canShare && (() => {
    try { return navigator.canShare({ files: [new File(['x'], 'x.csv', { type: 'text/csv' })] }) } catch { return false }
  })()

  return (
    <div className="screen report-screen">
      <div className="brandbar no-print">
        <div className="brandbar-left">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Amandla Protection Services" className="brand-logo" />
          <div className="name">IMPI <span>Reports</span></div>
        </div>
        <button className="link" onClick={onBack}>← Back</button>
      </div>

      <div className="card no-print">
        <h1>Job card report</h1>
        <label htmlFor="month">Month</label>
        <input id="month" type="month" value={month} max={currentMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: '1rem' }} />
        {privileged && (
          <>
            <label htmlFor="staff">Staff member</label>
            <select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="all">All staff</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </>
        )}
        <button className="primary" style={{ marginTop: 16 }} onClick={() => window.print()} disabled={loading || !rows.length}>
          Print / Save as PDF
        </button>
        <button className="primary" style={{ marginTop: 8, background: '#1a1a1a' }} onClick={downloadCsv} disabled={loading || !rows.length}>
          Download Excel (CSV)
        </button>
        {canShare && (
          <button className="primary" style={{ marginTop: 8, background: '#555' }} onClick={shareCsv} disabled={loading || !rows.length}>
            Share / email file
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card report-sheet">
        <div className="print-only report-letterhead">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="" style={{ height: 56 }} />
          <div>
            <strong>Amandla Protection Services — IMPI</strong><br />
            Job Card Report
          </div>
        </div>
        <h2 style={{ marginBottom: 4 }}>{who} — {monthLabel(month)}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {rows.length} {rows.length === 1 ? 'visit' : 'visits'} · {fmtHours(total)} hours total
          <span className="print-only"> · Generated {new Date().toLocaleDateString('en-ZA', { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </p>

        {loading ? <p>Loading…</p> : rows.length === 0 ? <p className="hint">No visits recorded for this month.</p> : (
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  {showStaffCol && <th>Staff</th>}
                  <th>Date</th><th>Site</th><th>In</th><th>Out</th><th>Hrs</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {showStaffCol && <td>{r.staff}</td>}
                    <td>{r.date}</td><td>{r.site}</td><td>{r.inT}</td><td>{r.outT}</td>
                    <td>{fmtHours(r.hours)}</td><td>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={showStaffCol ? 5 : 4} style={{ textAlign: 'right' }}><strong>Total hours</strong></td>
                  <td><strong>{fmtHours(total)}</strong></td><td></td></tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="hint print-only" style={{ marginTop: 24 }}>
          Times are South Africa Standard Time. Generated from the IMPI Job Card system.
        </p>
      </div>
    </div>
  )
}
