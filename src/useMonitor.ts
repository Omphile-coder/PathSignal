import { useEffect, useRef, useState } from 'react'
import { defaultModel, detect, Encounter, HEIGHT, takeSamples, train, WIDTH } from './vision'
import type { Box, Profile, Sample } from './vision'

export type Mode = 'replay' | 'live'
export type AlertEvent = { at: string; elapsed: number; mode: Mode; source: string }
type Status = 'Ready' | 'Starting' | 'Monitoring' | 'Stopped' | 'Replay complete' | 'Paused'
const warning = 'Possible obstacle ahead.'
const recordings: Record<string, string> = {
  [warning]: 'obstacle',
  'Obstacle alerts paused.': 'paused',
  'Starting camera.': 'camera',
  'Starting replay.': 'replay',
  'PathSignal audio check.': 'test',
}

export function useMonitor() {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const run = useRef(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  const audioRequest = useRef(0)
  const canvas = useRef<CanvasRenderingContext2D | null>(null)
  const samples = useRef<{ floor: Sample[]; block: Sample[] }>({ floor: [], block: [] })
  const model = useRef(defaultModel)
  const [calibration, setCalibration] = useState({ floor: 0, block: 0 })
  const [status, setStatus] = useState<Status>('Ready')
  const [detail, setDetail] = useState('')
  const [audioError, setAudioError] = useState(false)
  const [box, setBox] = useState<Box | null>(null)
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [last, setLast] = useState('')
  const [signal, setSignal] = useState(0)
  const [progress, setProgress] = useState(0)

  function cancelAudio() {
    audioRequest.current++
    audio.current?.pause()
    window.speechSynthesis?.cancel()
  }

  function speak(message: string) {
    cancelAudio()
    const request = audioRequest.current
    const player = audio.current ?? (audio.current = new Audio())
    player.src = import.meta.env.BASE_URL + 'audio/' + recordings[message] + '.wav'
    void player.play().catch(() => {
      if (request === audioRequest.current) fallbackSpeech(message)
    })
  }

  function fallbackSpeech(message: string) {
    if (!('speechSynthesis' in window)) {
      setAudioError(true)
      return
    }
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'en'
    utterance.onerror = event => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') setAudioError(true)
    }
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  }

  function announce(message: string) {
    setLast(message)
    setSignal(count => count + 1)
    speak(message)
  }

  function release() {
    run.current++
    window.clearInterval(timer.current)
    const player = video.current
    if (player) {
      player.onended = null
      player.pause()
      player.srcObject = null
      player.removeAttribute('src')
      player.load()
    }
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }

  useEffect(() => () => { release(); cancelAudio() }, [])

  function stop(next: Status = 'Stopped') {
    release()
    cancelAudio()
    setBox(null)
    setStatus(next)
    setDetail('')
  }

  function pause(reason: string) {
    stop('Paused')
    setDetail(reason)
    announce('Obstacle alerts paused.')
  }

  function readFrame() {
    const player = video.current
    if (!player || player.readyState < 2) return null
    if (!canvas.current) {
      const surface = document.createElement('canvas')
      surface.width = WIDTH
      surface.height = HEIGHT
      canvas.current = surface.getContext('2d', { willReadFrequently: true })
    }
    const ctx = canvas.current
    if (!ctx) return null
    ctx.drawImage(player, 0, 0, WIDTH, HEIGHT)
    return ctx.getImageData(0, 0, WIDTH, HEIGHT)
  }

  async function start(mode: Mode, source: string, url?: string, profile: Profile = 'foam') {
    stop()
    setProgress(0)
    setAudioError(false)
    setStatus('Starting')
    speak(mode === 'live' ? 'Starting camera.' : 'Starting replay.')
    const id = run.current
    const player = video.current!
    const timeout = window.setTimeout(() => {
      if (id === run.current) pause('Video startup timed out. Check permissions or try another clip.')
    }, 15000)
    try {
      if (mode === 'live') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires localhost or trusted HTTPS.')
        const camera = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (id !== run.current) {
          camera.getTracks().forEach(track => track.stop())
          return
        }
        stream.current = camera
        for (const track of camera.getVideoTracks()) {
          track.onended = () => { if (id === run.current) pause('The camera disconnected.') }
        }
        player.srcObject = camera
      } else {
        player.src = url!
      }
      await player.play()
      if (id !== run.current) return
      setStatus('Monitoring')
      const encounter = new Encounter()
      const started = performance.now()
      let lastFrame = started
      let lastTime = -1
      player.onended = () => {
        if (id !== run.current) return
        release()
        setBox(null)
        setProgress(1)
        setStatus('Replay complete')
      }
      timer.current = window.setInterval(() => {
        if (id !== run.current) return
        const now = performance.now()
        try {
          if (document.hidden) return pause('Return to this tab and restart monitoring.')
          const frame = player.currentTime !== lastTime ? readFrame() : null
          if (!frame) {
            if (now - lastFrame > 1600) pause('The video feed stopped providing frames.')
            return
          }
          lastTime = player.currentTime
          lastFrame = now
          if (mode === 'replay' && Number.isFinite(player.duration)) setProgress(lastTime / player.duration)
          const candidate = detect(frame, mode === 'live' ? model.current : defaultModel, profile)
          setBox(candidate)
          if (encounter.update(Boolean(candidate))) {
            const event = {
              at: new Date().toISOString(), mode, source,
              elapsed: mode === 'replay' ? lastTime : (now - started) / 1000,
            }
            setEvents(previous => [event, ...previous])
            announce(warning)
          }
        } catch {
          pause('The video frame could not be processed.')
        }
      }, 100)
    } catch (error) {
      if (id !== run.current) return
      const message = error instanceof Error ? error.message : 'Unknown video error.'
      pause((mode === 'live' ? 'Camera unavailable. ' : 'Replay unavailable. ') + message)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  function calibrate(label: 'floor' | 'block') {
    const frame = readFrame()
    if (!frame) return
    samples.current[label] = [...samples.current[label].slice(-400), ...takeSamples(frame, label === 'block' ? 1 : 0)]
    const { floor, block } = samples.current
    setCalibration({ floor: floor.length / 100, block: block.length / 100 })
    if (floor.length && block.length) {
      const count = Math.min(floor.length, block.length)
      model.current = train([...floor.slice(-count), ...block.slice(-count)])
    }
    setDetail(floor.length && block.length ? 'Camera model updated. Restart before scoring.' : 'Sample captured. Capture both labels to train.')
  }

  function resetCalibration() {
    samples.current = { floor: [], block: [] }
    model.current = defaultModel
    setCalibration({ floor: 0, block: 0 })
    setDetail('Camera model reset to the orange foam baseline.')
  }

  return {
    video, status, detail, audioError, box, events, last, signal, progress, calibration,
    start, stop, calibrate, resetCalibration,
    repeat: () => { if (last) announce(last) },
    testAudio: () => { setAudioError(false); speak('PathSignal audio check.') },
  }
}
