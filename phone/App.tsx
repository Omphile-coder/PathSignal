import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { File } from 'expo-file-system'
import { toByteArray } from 'base64-js'
import { decode } from 'jpeg-js'
import { defaultModel, detect, HEIGHT, WIDTH } from './vision'
import { useObjectWorker } from './useObjectWorker'
import { hasLidarModule, LidarPanel } from './LidarPanel'
import { hasNativeDetector, scanYolo } from './yolox'

const clips = {
  obstacle: { file: require('./assets/obstacle.wav'), text: 'Possible obstacle ahead.' },
  paused: { file: require('./assets/paused.wav'), text: 'Obstacle alerts paused.' },
  test: { file: require('./assets/test.wav'), text: 'PathSignal audio check.' },
}
type Cue = keyof typeof clips

function Button({ title, onPress, disabled = false, primary = false }: {
  title: string; onPress: () => void; disabled?: boolean; primary?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, primary && styles.primaryText]}>{title}</Text>
  </Pressable>
}

function Monitor({ openLidar }: { openLidar: () => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const camera = useRef<CameraView>(null)
  const player = useAudioPlayer()
  const activeRun = useRef(0)
  const pending = useRef(false)
  const auto = useRef(false)
  const nextScan = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const encounter = useRef(new Map<string, number>())
  const [repeating, setRepeating] = useState(false)
  const [profile, setProfile] = useState<'coco' | 'yolox' | 'bottle'>('coco')
  const smart = profile !== 'bottle'
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [active, setActive] = useState(false)
  const objectWorker = useObjectWorker(active && profile === 'coco')
  const [ready, setReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('Camera off')
  const [diagnostic, setDiagnostic] = useState('')
  const [scanTime, setScanTime] = useState<number | null>(null)
  const [last, setLast] = useState<Cue | null>(null)
  const [counts, setCounts] = useState({ scans: 0, alerts: 0 })

  function play(cue: Cue) {
    player.replace(clips[cue].file)
    player.play()
  }

  function stopRepeating() {
    auto.current = false
    clearTimeout(nextScan.current)
    setRepeating(false)
  }

  function end(message: string) {
    stopRepeating()
    objectWorker.cancel()
    activeRun.current++
    clearTimeout(timeout.current)
    pending.current = false
    setActive(false)
    setReady(false)
    setScanning(false)
    setStatus(message)
  }

  function pause(reason: string) {
    end('Obstacle alerts paused. ' + reason)
    setLast('paused')
    play('paused')
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' && active) end('Camera stopped when the app went to the background.')
    })
    return () => subscription.remove()
  }, [active])

  useEffect(() => () => {
    activeRun.current++
    auto.current = false
    clearTimeout(nextScan.current)
    clearTimeout(timeout.current)
  }, [])

  async function start() {
    try {
      const allowed = permission?.granted || (await requestPermission()).granted
      if (!allowed) return pause('Allow camera access in your phone settings.')
      await setAudioModeAsync({ playsInSilentMode: true })
      activeRun.current++
      const run = activeRun.current
      setStatus('Starting camera')
      setActive(true)
      timeout.current = setTimeout(() => {
        if (run === activeRun.current) pause('Camera startup timed out.')
      }, 12000)
    } catch {
      pause('Camera or audio setup failed.')
    }
  }

  function toggleRepeatedScans() {
    if (auto.current) {
      stopRepeating()
      return
    }
    encounter.current.clear()
    auto.current = true
    setRepeating(true)
    void scan()
  }

  async function scan() {
    if (!ready || pending.current || !camera.current || (profile === 'coco' && !objectWorker.ready)) return
    pending.current = true
    const run = activeRun.current
    const automatic = auto.current
    setScanning(true)
    setDiagnostic('')
    let stage = 'Camera capture'
    setStatus(smart ? 'Checking for objects' : 'Scanning one image')
    timeout.current = setTimeout(() => {
      if (run === activeRun.current) pause('The camera scan timed out.')
    }, smart ? 45000 : 10000)
    try {
      const capture = await camera.current.takePictureAsync({ pictureRef: true, shutterSound: false })
      if (run !== activeRun.current) return
      stage = 'Image resize'
      const size = smart
        ? (capture.width >= capture.height ? { width: 480 } : { height: 480 })
        : { width: WIDTH, height: HEIGHT }
      const image = await ImageManipulator.manipulate(capture).resize(size).renderAsync()
      if (run !== activeRun.current) return
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: .9, base64: true })
      try {
        if (run !== activeRun.current) return
        if (!saved.base64) throw new Error('Missing image data')
        stage = smart ? 'Object model' : 'Bottle detector'
        const frame = profile === 'coco' ? null : decode(toByteArray(saved.base64), { useTArray: true })
        const result = profile === 'coco' ? await objectWorker.scan(saved.base64) : null
        if (run !== activeRun.current || (automatic && !auto.current)) return
        setScanTime(result ? result.milliseconds : null)
        const objects = result?.hazards ?? (profile === 'yolox' && frame ? await scanYolo(frame) : [])
        if (run !== activeRun.current || (automatic && !auto.current)) return
        const labels = new Set(objects.map(object => object.class))
        if (!smart && frame && detect(frame, defaultModel, 'bottle')) labels.add('dark object')
        const found = labels.size > 0
        const seen = smart ? [...labels].join(', ') : ''
        const alert = [...labels].some(label => !automatic || !encounter.current.has(label))
        if (automatic) {
          for (const [label, misses] of encounter.current) {
            if (labels.has(label)) continue
            if (misses >= 1) encounter.current.delete(label)
            else encounter.current.set(label, misses + 1)
          }
          for (const label of labels) encounter.current.set(label, 0)
        }
        setCounts(old => ({ scans: old.scans + 1, alerts: old.alerts + Number(alert) }))
        const outside = result?.seen.length ? ' Seen outside the alert corridor: ' + result.seen.join(', ') + '.' : ''
        setStatus(found ? clips.obstacle.text + (seen ? ' Detected: ' + seen : '') : 'No alert on this scan.' + outside)
        if (alert) {
          stage = 'Alert audio'
          setLast('obstacle')
          play('obstacle')
        }
      } finally {
        try { new File(saved.uri).delete() } catch { /* The image is in the app cache. */ }
      }
    } catch (error) {
      if (run === activeRun.current) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[PathSignal scan]', stage, message)
        setDiagnostic(stage + ': ' + message)
        pause(stage === 'Object model' ? 'Object detection could not finish.' : stage + ' failed.')
      }
    } finally {
      if (run === activeRun.current) {
        clearTimeout(timeout.current)
        pending.current = false
        setScanning(false)
        if (auto.current) nextScan.current = setTimeout(() => { void scan() }, 750)
        else if (automatic && !auto.current) setStatus('Repeated scans stopped.')
      }
    }
  }

  return <SafeAreaView style={styles.page}>
    {objectWorker.worker}
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>PATHSIGNAL · PHONE PROTOTYPE</Text>
      <Text accessibilityRole="header" style={styles.title}>Obstacle monitor</Text>
      <Text style={styles.body}>{smart ? 'Stand still and aim the rear camera at the path ahead.' : 'Stand still and centre the black bottle on light tile.'}</Text>
      <View style={styles.controls}>
        <Button title="Object detection" primary={profile === 'coco'} disabled={active} onPress={() => { setProfile('coco'); setCounts({ scans: 0, alerts: 0 }) }} />
        {hasNativeDetector && <Button title="YOLOX comparison" primary={profile === 'yolox'} disabled={active} onPress={() => { setProfile('yolox'); setCounts({ scans: 0, alerts: 0 }) }} />}
        <Button title="Black bottle baseline" primary={profile === 'bottle'} disabled={active} onPress={() => { setProfile('bottle'); setCounts({ scans: 0, alerts: 0 }) }} />
      </View>
      <View style={styles.preview}>
        {active ? <CameraView ref={camera} facing="back" mode="picture" style={StyleSheet.absoluteFill}
          animateShutter={false}
          onMountError={() => pause('Camera preview is unavailable.')}
          onCameraReady={() => {
            clearTimeout(timeout.current)
            setReady(true)
            setStatus('Camera ready. Scan when stationary.')
          }} /> : <Text style={styles.body}>Rear camera preview</Text>}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      {active && profile === 'coco' && <Text accessibilityLiveRegion="polite" style={styles.body}>{objectWorker.status}</Text>}
      {!!diagnostic && <Text selectable style={styles.body}>Scan details · {diagnostic}</Text>}
      <View style={styles.controls}>
        {active ? <>
          <Button title={scanning ? 'Scanning' : 'Scan now'} primary disabled={!ready || scanning || repeating || (profile === 'coco' && !objectWorker.ready)} onPress={() => void scan()} />
          <Button title={repeating ? 'Stop repeated scans' : 'Start repeated scans'} disabled={!ready || (scanning && !repeating) || (profile === 'coco' && !objectWorker.ready)} onPress={toggleRepeatedScans} />
          <Button title="Stop camera" onPress={() => { end('Camera off'); player.pause() }} />
        </> : <Button title="Start camera" primary onPress={() => void start()} />}
        <Button title="Repeat last alert" disabled={!last} onPress={() => { if (last) play(last) }} />
        <Button title="Test audio" onPress={() => {
          void setAudioModeAsync({ playsInSilentMode: true }).then(() => play('test')).catch(() => {
            setStatus('Audio check could not start.')
            AccessibilityInfo.announceForAccessibility('Audio check could not start.')
          })
        }} />
      </View>
      {hasLidarModule && <Button title="LiDAR distance" onPress={openLidar} disabled={active} />}
      {profile === 'coco' && <Text style={styles.body}>YOLOX-S{scanTime !== null ? ' · Last scan ' + (scanTime / 1000).toFixed(1) + ' s' : ' · Loads when the camera starts'}</Text>}
      <Text style={styles.body}>{counts.scans} scans · {counts.alerts} alerts</Text>
      <Text style={styles.body}>Use this prototype while stationary. Silence carries no information about path conditions.</Text>
    </ScrollView>
  </SafeAreaView>
}

export default function App() {
  const [lidar, setLidar] = useState(false)
  return <SafeAreaProvider>
    {lidar ? <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
      <LidarPanel onExit={() => setLidar(false)} />
    </ScrollView></SafeAreaView> : <Monitor openLidar={() => setLidar(true)} />}
  </SafeAreaProvider>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101517' },
  content: { padding: 20, gap: 14 },
  label: { color: '#ffc474', fontWeight: '700', letterSpacing: 1.4, fontSize: 12 },
  title: { color: '#f0f1ed', fontWeight: '800', fontSize: 35 },
  body: { color: '#c0cbcb', fontSize: 16, lineHeight: 24 },
  preview: { aspectRatio: 1, maxHeight: 380, backgroundColor: '#181e21', overflow: 'hidden',
    borderColor: '#384345', borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  status: { color: '#ffe0b4', fontSize: 17, fontWeight: '600' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#222b2d', minHeight: 48, padding: 12, justifyContent: 'center', borderRadius: 8 },
  primary: { backgroundColor: '#ffc474' },
  disabled: { opacity: .45 },
  buttonText: { color: '#f0f1ed', fontWeight: '700', fontSize: 15 },
  primaryText: { color: '#201b15' },
})

