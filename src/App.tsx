import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowRight, AudioLines, Camera, ChevronDown, CircleAlert, FlaskConical, Focus, History, Play, Radio, RotateCcw, ScanLine, ShieldCheck, Square, Upload, Volume2 } from 'lucide-react'
import { scenes } from './replay'
import type { Scene } from './replay'
import type { Profile } from './vision'
import { useMonitor } from './useMonitor'
import type { Mode } from './useMonitor'
import { exportRows, stamp, TrialLab } from './TrialLab'

export function App() {
  const monitor = useMonitor()
  const [mode, setMode] = useState<Mode>('replay')
  const [profile, setProfile] = useState<Profile>('foam')
  const [scene, setScene] = useState<Scene>('block')
  const [file, setFile] = useState<{ url: string; name: string } | null>(null)
  const fileRef = useRef<string | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)
  const [calibrate, setCalibrate] = useState(false)
  const [scoring, setScoring] = useState(false)
  const running = monitor.status === 'Monitoring'
  const busy = running || monitor.status === 'Starting'
  const customModel = monitor.calibration.block > 0 && monitor.calibration.floor > 0
  const base = import.meta.env.BASE_URL

  useEffect(() => () => { if (fileRef.current) URL.revokeObjectURL(fileRef.current) }, [])

  function selectMode(next: Mode) {
    monitor.stop('Ready')
    setMode(next)
    setCalibrate(false)
  }

  function changeFile(upload?: File) {
    monitor.stop('Ready')
    if (fileRef.current) URL.revokeObjectURL(fileRef.current)
    fileRef.current = upload ? URL.createObjectURL(upload) : undefined
    setFile(upload && fileRef.current ? { url: fileRef.current, name: upload.name } : null)
  }

  const detector = profile === 'bottle' ? 'Black bottle on light tile' : 'Orange foam'

  function start() {
    if (mode === 'live') {
      void monitor.start('live', profile === 'foam' && customModel ? 'Calibrated camera' : detector, undefined, profile)
    } else {
      void monitor.start('replay', file ? file.name + ' · ' + detector : scenes[scene],
        file?.url ?? base + 'replays/' + scene + '.mp4', file ? profile : 'foam')
    }
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><ScanLine size={23} /></span>PathSignal</div>
      <div className="top-label"><span className="dot" /> Obstacle alert lab</div>
      <nav className="top-nav" aria-label="Labs">
        <a href="?lab=lidar" className="top-link">LiDAR replay</a>
        <a href="#trial-lab" className="top-link"><FlaskConical size={16} /> Trial lab <ArrowRight size={14} /></a>
      </nav>
    </header>
    <main>
      <div className="intro">
        <div><div className="eyebrow"><Radio size={14} /> CONTROLLED INDOOR PROTOTYPE</div>
          <h1>Ground obstacle monitor</h1>
          <p>Test a spoken warning for a foam block or black bottle on a controlled indoor path.</p>
        </div>
        <button className="button ghost audio" onClick={monitor.testAudio}><Volume2 size={18} /> Test audio</button>
      </div>
      <div className="layout">
        <section className="panel monitor" aria-labelledby="monitor-title">
          <div className="panel-head">
            <div className="section-title"><Focus size={19} /><h2 id="monitor-title">Path monitor</h2></div>
            <div className="segmented" aria-label="Video source" role="group">
              <button aria-pressed={mode === 'replay'} disabled={scoring} onClick={() => mode !== 'replay' && selectMode('replay')}><Play size={15} /> Replay</button>
              <button aria-pressed={mode === 'live'} disabled={scoring} onClick={() => mode !== 'live' && selectMode('live')}><Camera size={16} /> Live camera</button>
            </div>
          </div>
          <div className="viewport">
            <video ref={monitor.video} muted playsInline aria-hidden="true" className={running ? 'show' : ''} />
            {!running && mode === 'replay' && <img src={base + 'replays/poster.jpg'} alt="" className="poster" />}
            {!running && mode === 'live' && <div className="camera-placeholder"><Camera size={35} /><span>Camera preview</span></div>}
            <svg className="overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M35 28 L65 28 L80.84 94 L19.16 94 Z" fill="#ffc1660c" stroke="#ffc166b8" strokeWidth=".25" strokeDasharray="1.6 1.2" />
              {calibrate && <rect x="47.4" y="45.4" width="5.2" height="9.2" stroke="#ffffff" strokeWidth=".28" fill="none" />}
              {monitor.box && <rect x={monitor.box.x * 100} y={monitor.box.y * 100} width={monitor.box.w * 100} height={monitor.box.h * 100} fill="#ffba641c" stroke="#ffd08a" strokeWidth=".45" />}
            </svg>
            <div className="view-top"><span className="view-badge"><span className={'dot ' + (running ? 'on' : '')} /> {mode === 'live' ? 'LIVE CAMERA' : file ? 'UPLOADED REPLAY' : 'SIMULATED REPLAY'}</span></div>
            <div className="view-bottom"><span><Focus size={14} /> Detection corridor</span>{mode === 'replay' && <span>{Math.round(monitor.progress * 100)}%</span>}</div>
            {mode === 'replay' && <progress aria-label="Replay progress" value={monitor.progress} max={1} />}
          </div>
          <div className="monitor-controls">
            <div className="actions">
              <button className="button primary" onClick={start} disabled={busy || scoring}><Play size={17} fill="currentColor" /> {mode === 'live' ? 'Start camera' : 'Start replay'}</button>
              <button className="button ghost" onClick={() => monitor.stop()} disabled={!busy}><Square size={15} /> Stop</button>
              <button className="button ghost" onClick={monitor.repeat} disabled={!monitor.last}><RotateCcw size={16} /> Repeat last alert</button>
            </div>
            {mode === 'replay' ? <div className="source-row">
              <label htmlFor="scene">Replay scenario</label>
              <div className="select-wrap"><select id="scene" value={file ? 'upload' : scene} onChange={event => { changeFile(); setScene(event.target.value as Scene) }} disabled={busy}>
                {Object.entries(scenes).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
                {file && <option value="upload">{file.name}</option>}
              </select><ChevronDown size={15} /></div>
              <button className="button ghost" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15} /> Upload clip</button>
              <input ref={fileInput} type="file" accept="video/*" hidden onChange={event => { const selected = event.currentTarget.files?.[0]; if (selected) changeFile(selected); event.currentTarget.value = '' }} />
            </div> : <div className="source-row">
              <button className="button ghost" disabled={scoring || profile === 'bottle'} aria-expanded={calibrate} onClick={() => setCalibrate(value => !value)}><Focus size={16} /> Calibrate camera model</button>
              <span className="muted">{profile === 'foam' && (customModel ? 'Custom foam model' : 'Orange foam baseline')}</span>
            </div>}
            {(mode === 'live' || file) && <div className="source-row">
              <label htmlFor="detector">Detector profile</label>
              <select id="detector" value={profile} disabled={busy || scoring} onChange={event => {
                setProfile(event.target.value as Profile)
                setCalibrate(false)
              }}>
                <option value="foam">Orange foam</option>
                <option value="bottle">Black bottle on light tile</option>
              </select>
            </div>}
            {calibrate && mode === 'live' && profile === 'foam'  && <div className="calibrate">
              <p>Hold still. Fill the centre rectangle with bare floor and capture it. Then fill it with the foam surface and capture it. Repeat under different lighting. Stop and restart before scoring.</p>
              <div className="actions">
                <button className="button ghost" disabled={!running} onClick={() => monitor.calibrate('floor')}>Capture floor ({monitor.calibration.floor})</button>
                <button className="button ghost" disabled={!running} onClick={() => monitor.calibrate('block')}>Capture block ({monitor.calibration.block})</button>
                <button className="button ghost" onClick={monitor.resetCalibration}>Reset model</button>
              </div>
            </div>}
          </div>
        </section>
        <aside className="rail" aria-label="Monitor information">
          <section className="panel status-panel" aria-labelledby="status-title">
            <div className="section-title"><Activity size={18} /><h2 id="status-title">Session status</h2></div>
            <div className={'status-block ' + (monitor.status === 'Paused' ? 'alerting' : '')} role="status"><span className={'dot ' + (running ? 'on' : '')} /><div><strong>{monitor.status}</strong><p>{monitor.detail || (running ? 'Processing video frames locally.' : 'Start monitoring to process video frames.')}</p></div></div>
            <div className="alert-block">
              <div className="micro"><AudioLines size={16} /> LAST ALERT MESSAGE</div>
              <div aria-live="polite" aria-atomic="true">{monitor.last ? <strong key={monitor.signal}>{monitor.last}</strong> : <span>No messages yet</span>}</div>
              {monitor.audioError && <p role="status">Speech playback reported an error. Try Test audio.</p>}
            </div>
          </section>
          <section className="panel log-panel" aria-labelledby="log-title">
            <div className="section-title"><History size={18} /><h2 id="log-title">Alert log</h2><span className="count">{monitor.events.length}</span></div>
            {monitor.events.length ? <ol className="events">{monitor.events.slice(0, 5).map((event, index) => <li key={event.at + index}>
              <CircleAlert size={17} /><div><strong>Possible obstacle ahead</strong><span>{event.mode === 'live' ? 'Live' : 'Replay'} · {event.elapsed.toFixed(2)} s · {stamp(event.at)}</span></div>
            </li>)}</ol> : <div className="empty"><History size={23} /><span>No alerts recorded</span><p>Detections appear here with a timestamp.</p></div>}
            <button className="button ghost export" disabled={!monitor.events.length} onClick={() => exportRows('pathsignal-alerts.csv', [
              ['Timestamp (ISO)', 'Mode', 'Source', 'Elapsed seconds'],
              ...monitor.events.map(event => [event.at, event.mode, event.source, event.elapsed.toFixed(3)]),
            ])}><ArrowDownToLine size={15} /> Export alerts</button>
          </section>
          <div className="scope"><ShieldCheck size={20} /><p>Use on a supervised indoor path with existing mobility tools. Silence carries no information about path conditions.</p></div>
        </aside>
      </div>
      <TrialLab mode={mode} monitor={monitor} setScoring={setScoring} onStart={() => { setCalibrate(false); start() }} onSelectCamera={() => { selectMode('live'); document.getElementById('monitor-title')?.scrollIntoView() }} />
      <footer><span>PathSignal</span><span><ShieldCheck size={15} /> Camera frames stay on this device</span></footer>
    </main>
  </div>
}

