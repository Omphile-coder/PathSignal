import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ScanLine } from 'lucide-react'
import { evaluateCorridor, hazardLabels } from '../phone/lidarGeometry'
import { parseTrialExport, reviewTrial } from '../phone/lidarReview'
import type { ReviewTrial } from '../phone/lidarReview'
import { exportRows } from './TrialLab'
import './lidarReplay.css'

const demoTime = '2026-11-12T00:00:00Z'
const floor = Array.from({ length: 100 }, (_, i) => [45 + i % 20 * 12, Math.floor(i / 20) * 16 - 32, 0]).flat()

function demoTrials(): ReviewTrial[] {
  const cluster = Array.from({ length: 18 }, (_, i) => [100 + i, i % 5 + 7, 17]).flat()
  const baseline = { capturedAt: demoTime, notes: 'Synthetic example', measuredMetres: null }
  return [
    { ...baseline, kind: 'corridor', expected: 'raised', measuredMetres: 1.10,
      frames: [floor.concat(cluster), floor.concat(cluster), floor.concat(cluster)],
      result: { hazards: [{ kind: 'raised', metresAhead: 1.09 }], usableFrames: 3, sampledReturns: 354 } },
    { ...baseline, kind: 'corridor', expected: 'clear', frames: [floor, floor, floor],
      result: { hazards: [], usableFrames: 3, sampledReturns: 300 } },
    { ...baseline, kind: 'corridor', expected: 'clear', frames: [floor, [], floor],
      result: { hazards: [], usableFrames: 2, sampledReturns: 200 } },
    { ...baseline, kind: 'distance', expected: null, metres: 1.08, measuredMetres: 1 },
  ]
}

const expectedLabels = { clear: 'Empty path', raised: 'Raised surface', drop: 'Drop-off', upper: 'Upper obstruction' }
const show = (number: number | null | undefined) => typeof number === 'number' ? number.toFixed(2) + ' m' : '—'

function PointPlot({ points }: { points: number[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const x = (side: number) => 320 + side * 4
    const y = (ahead: number) => 337 - ahead
    ctx.fillStyle = '#101517'
    ctx.fillRect(0, 0, 640, 365)
    ctx.fillStyle = '#222d30'
    ctx.fillRect(x(-45), y(280), x(45) - x(-45), y(35) - y(280))
    ctx.strokeStyle = '#506267'
    ctx.setLineDash([5, 5])
    ctx.strokeRect(x(-45), y(280), x(45) - x(-45), y(35) - y(280))
    ctx.setLineDash([])
    ctx.fillStyle = '#b9c4c4'
    ctx.font = '14px Segoe UI'
    for (let distance = 50; distance <= 300; distance += 50) {
      ctx.fillText((distance / 100).toFixed(1) + ' m', 20, y(distance) + 4)
      ctx.strokeStyle = '#354348'
      ctx.beginPath()
      ctx.moveTo(70, y(distance))
      ctx.lineTo(605, y(distance))
      ctx.stroke()
    }
    for (let i = 0; i < points.length; i += 3) {
      const [ahead, side, height] = [points[i], points[i + 1], points[i + 2]]
      if (Math.abs(side) > 60 || ahead < 0 || ahead > 300) continue
      ctx.fillStyle = height >= 115 ? '#baabff' : height <= -15 ? '#67d4f7'
        : height >= 9 && height < 115 ? '#ffc474' : '#a1a9a9'
      ctx.fillRect(x(side) - 2, y(ahead) - 2, 4, 4)
    }
    ctx.fillStyle = '#eef2ee'
    ctx.beginPath()
    ctx.moveTo(320, 324)
    ctx.lineTo(310, 343)
    ctx.lineTo(330, 343)
    ctx.fill()
    ctx.fillText('Phone', 342, 343)
  }, [points])

  return <>
    <canvas width={640} height={365} ref={canvas} role="img"
      aria-label={'Top-down view of ' + points.length / 3 + ' sampled LiDAR returns. The phone is at the bottom.'} />
    <div className="replay-legend" aria-label="Plot legend">
      <span>• Other return</span><span>• Raised band</span><span>• Lower band</span><span>• Upper band</span>
    </div>
  </>
}

export function LidarReplay() {
  const [trials, setTrials] = useState<ReviewTrial[]>([])
  const [selected, setSelected] = useState(0)
  const [frame, setFrame] = useState(0)
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('Choose a trial export or open the synthetic examples.')
  const [loading, setLoading] = useState(false)
  const rows = useMemo(() => trials.map(trial => reviewTrial(trial, evaluateCorridor)), [trials])
  const trial = trials[selected]
  const row = rows[selected]

  function load(next: ReviewTrial[], label: string) {
    setTrials(next)
    setSelected(0)
    setFrame(0)
    setSource(label)
    setStatus(next.length + (next.length === 1 ? ' trial loaded.' : ' trials loaded.'))
  }

  async function openFile(file?: File) {
    if (!file) return
    setLoading(true)
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('Choose a trial export under 30 MB.')
      load(parseTrialExport((await file.text()).replace(/^\uFEFF/, '')), file.name)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The trial export could not open.')
    } finally {
      setLoading(false)
    }
  }

  function saveCsv() {
    exportRows('pathsignal-lidar-review.csv', [
      ['Source', 'Timestamp (ISO)', 'Trial', 'Observed condition', 'Outcome', 'Tape distance (m)',
        'Reading or candidates', 'Usable frames', 'Absolute error (m)', 'Notes'],
      ...rows.map((item, index) => [source, item.time, item.kind, item.expected, item.outcome,
        trials[index].measuredMetres,
        'hazards' in item ? (item.hazards ?? []).map(h => h.kind + ' ' + h.metresAhead.toFixed(2) + ' m').join(' | ') : show(item.cameraDepth),
        'usableFrames' in item ? item.usableFrames ?? null : null, item.absoluteErrorMetres, item.note]),
    ])
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><ScanLine size={23} aria-hidden="true" /></span>PathSignal</div>
      <a className="top-link" href={import.meta.env.BASE_URL}><ArrowLeft size={16} aria-hidden="true" /> Path monitor</a>
    </header>
    <main className="lidar-review">
      <div className="intro"><div><h1>LiDAR trial replay</h1><p>Review saved measurements and replay the corridor detector on the same depth points.</p></div></div>
      <section className="panel replay-controls" aria-label="Open saved trials">
        <label htmlFor="lidar-export">iPhone trial export</label>
        <input id="lidar-export" type="file" accept=".json,application/json" disabled={loading} onChange={event => {
          void openFile(event.target.files?.[0])
          event.target.value = ''
        }} />
        <button className="button ghost" disabled={loading} onClick={() => load(demoTrials(), 'Synthetic examples')}>Open synthetic examples</button>
        <button className="button ghost" disabled={!rows.length || loading} onClick={saveCsv}><ArrowDownToLine size={16} aria-hidden="true" /> Export CSV</button>
        <p role="status">{status}</p>
      </section>
      {trial && row && <div className="replay-layout">
        <section className="panel replay-trials">
          <h2>Trials</h2><p className="replay-source">{source}</p>
          <ol>{rows.map((item, index) => <li key={index}>
            <button className="button ghost" aria-pressed={index === selected} onClick={() => { setSelected(index); setFrame(0) }}>
              <strong>{index + 1}. {item.kind === 'distance' ? 'Point distance' : 'Corridor check'}</strong>
              <span>{item.outcome}</span>
            </button>
          </li>)}</ol>
        </section>
        <section className="panel replay-detail">
          <div className="replay-detail-head"><h2>{trial.kind === 'distance' ? 'Point distance' : 'Corridor check'}</h2>
            <span className="replay-outcome">{row.outcome}</span></div>
          <dl><div><dt>Observed condition</dt><dd>{trial.expected ? expectedLabels[trial.expected] : '—'}</dd></div>
            <div><dt>Tape distance</dt><dd>{show(trial.measuredMetres)}</dd></div>
            <div><dt>Absolute error</dt><dd>{show(row.absoluteErrorMetres)}</dd></div></dl>
          {trial.kind === 'corridor' && 'hazards' in row ? <>
            <p>{row.usableFrames} of 3 usable frames · {row.sampledReturns} returns in the corridor</p>
            {row.hazards?.length ? <ul>{row.hazards.map(h => <li key={h.kind}>{hazardLabels[h.kind]} · {show(h.metresAhead)} ahead</li>)}</ul>
              : <p>{row.usableFrames !== 3 ? 'There was too little usable data to score this scan.' : 'No candidate flagged by the replay.'}</p>}
            {row.matchesSavedResult === false && <p>Replay differs from the result saved on the phone.</p>}
            <label htmlFor="depth-frame">Depth frame</label>
            <select id="depth-frame" value={frame} onChange={event => setFrame(Number(event.target.value))}>
              {trial.frames.map((_, index) => <option key={index} value={index}>Frame {index + 1}</option>)}
            </select>
            <PointPlot points={trial.frames[frame] ?? []} />
          </> : trial.kind === 'distance' && <p>LiDAR camera-axis depth · {show(trial.metres)}</p>}
          {trial.notes && <p className="replay-note">Notes · {trial.notes}</p>}
        </section>
      </div>}
      <footer><span>Files stay in this browser.</span></footer>
    </main>
  </div>
}

