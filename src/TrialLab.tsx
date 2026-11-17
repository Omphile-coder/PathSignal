import { useState } from 'react'
import { ArrowDownToLine, Camera, FlaskConical, Play } from 'lucide-react'
import type { AlertEvent, Mode, useMonitor } from './useMonitor'

type ActiveTrial = { at: string; condition: string; minimum: number; mark: string | null; priorAlerts: number }
type Trial = Omit<ActiveTrial, 'priorAlerts'> & {
  first: AlertEvent | null; distance: number | null; result: string; notes: string
}
const key = 'pathsignal-trials-v1'
export const stamp = (value: string) => new Date(value).toLocaleTimeString([], { hour12: false })

export function exportRows(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map(row => row.map(value => {
    let field = String(value ?? '')
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(field)) field = "'" + field
    return '"' + field.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadTrials(): Trial[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch { return [] }
}

type Props = {
  mode: Mode
  monitor: ReturnType<typeof useMonitor>
  setScoring: (scoring: boolean) => void
  onStart: () => void
  onSelectCamera: () => void
}

export function TrialLab({ mode, monitor, setScoring, onStart, onSelectCamera }: Props) {
  const [condition, setCondition] = useState('Obstacle present')
  const [minimum, setMinimum] = useState('1')
  const [distance, setDistance] = useState('')
  const [notes, setNotes] = useState('')
  const [trial, setTrial] = useState<ActiveTrial | null>(null)
  const [trials, setTrials] = useState(loadTrials)
  const [storageError, setStorageError] = useState(false)
  const running = monitor.status === 'Monitoring'
  const busy = running || monitor.status === 'Starting'
  const count = trial ? monitor.events.length - trial.priorAlerts : 0
  const first = count > 0 ? monitor.events[count - 1] : undefined
  const validMinimum = Number.isFinite(Number(minimum)) && Number(minimum) > 0
  const totals: Record<string, number> = {}
  for (const item of trials) totals[item.result] = (totals[item.result] ?? 0) + 1

  function startTrial() {
    if (!validMinimum) return
    setTrial({ at: new Date().toISOString(), condition, minimum: Number(minimum), mark: null, priorAlerts: monitor.events.length })
    setDistance('')
    setNotes('')
    setScoring(true)
    onStart()
  }

  function finishTrial(invalid: boolean) {
    if (!trial) return
    monitor.stop()
    const metres = Number(distance)
    const measured = first && distance.trim() && metres >= 0 && Number.isFinite(metres) ? metres : null
    let result = 'Incomplete'
    if (!invalid) {
      if (trial.condition === 'Empty path') result = first ? 'False alert' : 'No alert'
      else if (!first && trial.mark) result = 'Missed'
      else if (first && trial.mark) result = first.at < trial.mark ? 'Before mark' : 'Late'
      else if (measured !== null) result = measured > trial.minimum ? 'Before mark' : 'Late'
    }
    const row: Trial = {
      at: trial.at, condition: trial.condition, minimum: trial.minimum, mark: trial.mark,
      first: first ?? null, distance: measured, result, notes,
    }
    const updated = [row, ...trials]
    setTrials(updated)
    try { localStorage.setItem(key, JSON.stringify(updated)) } catch { setStorageError(true) }
    setTrial(null)
    setScoring(false)
  }

  return <section className="panel trial-panel" id="trial-lab" aria-labelledby="trial-title">
    <div className="section-title"><FlaskConical size={19} /><h2 id="trial-title">Trial lab</h2><span className="count">{trials.length}</span></div>
    <p className="muted">Set a minimum warning distance and mark it on the floor. During the trial, log when the operator reaches the mark or enter the measured distance at the first alert.</p>
    {!trial ? <div className="trial-fields">
      <label>Trial condition<select value={condition} onChange={event => setCondition(event.target.value)}><option>Obstacle present</option><option>Empty path</option></select></label>
      <label>Minimum warning distance (m)<input type="number" min=".1" step=".1" value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
      {mode === 'live' ? <button className="button primary" disabled={busy || !validMinimum} onClick={startTrial}><Play size={16} /> Start live trial</button>
        : <button className="button ghost" disabled={busy} onClick={onSelectCamera}><Camera size={16} /> Switch to live camera</button>}
    </div> : <>
      <p role="status">{trial.condition} · {trial.minimum} m minimum · {first ? 'First alert at ' + first.elapsed.toFixed(2) + ' s' : 'No alert recorded'}{trial.mark && ' · Mark logged'}</p>
      <div className="trial-fields">
        <button className="button ghost" disabled={!!trial.mark || !running} onClick={() => setTrial({ ...trial, mark: new Date().toISOString() })}>Log distance mark</button>
        <label>Distance at first alert (m)<input disabled={!first} type="number" min="0" step=".1" value={distance} onChange={event => setDistance(event.target.value)} /></label>
        <label>Trial notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Lighting, position or failure" /></label>
        <button className="button primary" disabled={!running} onClick={() => finishTrial(false)}>Finish trial</button>
        <button className="button ghost" onClick={() => finishTrial(true)}>End as incomplete</button>
      </div>
    </>}
    {storageError && <p role="status">Browser storage is unavailable. Export your trials before closing.</p>}
    {trials.length > 0 && <>
      <p className="muted">{Object.entries(totals).map(([result, total]) => result + ' ' + total).join(' · ')}</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Trial results"><table><thead><tr><th scope="col">Time</th><th scope="col">Condition</th><th scope="col">Minimum</th><th scope="col">First alert</th><th scope="col">Distance</th><th scope="col">Outcome</th><th scope="col">Notes</th></tr></thead>
        <tbody>{trials.map((item, index) => <tr key={item.at + index}><td>{stamp(item.at)}</td><td>{item.condition}</td><td>{item.minimum} m</td><td>{item.first ? item.first.elapsed.toFixed(2) + ' s' : '—'}</td><td>{item.distance === null ? '—' : item.distance + ' m'}</td><td>{item.result}</td><td>{item.notes || '—'}</td></tr>)}</tbody>
      </table></div>
      <button className="button ghost" onClick={() => exportRows('pathsignal-trials.csv', [
        ['Trial started (ISO)', 'Condition', 'Minimum metres', 'First alert (ISO)', 'First alert seconds', 'Source model', 'Distance mark (ISO)', 'First alert distance metres', 'Outcome', 'Notes'],
        ...trials.map(item => [item.at, item.condition, item.minimum, item.first?.at ?? '', item.first?.elapsed.toFixed(3) ?? '', item.first?.source ?? '', item.mark, item.distance, item.result, item.notes]),
      ])}><ArrowDownToLine size={15} /> Export trials</button>
    </>}
  </section>
}
