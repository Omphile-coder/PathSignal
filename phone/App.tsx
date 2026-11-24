import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio'
import * as Speech from 'expo-speech'
import { File } from 'expo-file-system'
import { toByteArray } from 'base64-js'
import { decode } from 'jpeg-js'
import { defaultModel, detect, HEIGHT, WIDTH } from './vision'
import { useObjectWorker } from './useObjectWorker'
import { hasLidarModule, LidarPanel } from './LidarPanel'
import { hasNativeDetector, scanYolo } from './yolox'
import { retro, retroStyles } from './retroTheme'

const clips = {
  stairs: { file: require('./assets/stairs.wav'), text: 'Possible stairs ahead.' },
  obstacle: { file: require('./assets/obstacle.wav'), text: 'Possible obstacle ahead.' },
  paused: { file: require('./assets/paused.wav'), text: 'Obstacle alerts paused.' },
  test: { file: require('./assets/test.wav'), text: 'PathSignal audio check.' },
}
type Cue = keyof typeof clips

function strongestHazardNames(items: { class: string; score: number }[]) {
  return [...items].sort((a, b) => b.score - a.score).slice(0, 2).map(item => item.class.trim().toLowerCase()).filter(Boolean)
}
function hazardPhrase(names: string[]) {
  if (names.length > 1 && names[0] === names[1]) {
    const plural: Record<string, string> = { person: 'people', manhole: 'manholes', 'fire hydrant': 'fire hydrants', 'plant pot': 'plant pots', 'traffic cone': 'traffic cones', 'traffic sign': 'traffic signs', 'guard rail': 'guard rails', 'electrical pole': 'electrical poles', 'electrical box': 'electrical boxes', 'bicycle rack': 'bicycle racks', stairs: 'stairs' }
    return `Possible two ${plural[names[0]] ?? names[0] + 's'} ahead.`
  }
  return names.length ? `Possible ${names.join(' and ')} ahead.` : 'Possible obstacle ahead.'
}

function Button({ title, onPress, disabled = false, primary = false, tone, selected }: {
  title: string; onPress: () => void; disabled?: boolean; primary?: boolean; tone?: 'pink' | 'teal' | 'orange'; selected?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, retroStyles.shadow, primary && styles.primary,
      tone && { backgroundColor: retro[tone] }, selected && styles.selected,
      disabled && styles.disabled, pressed && !disabled && retroStyles.pressed]}>
    <Text style={[styles.buttonText, disabled && styles.disabledText]}>{selected ? '✓ ' : ''}{title}</Text>
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
  const lastSpoken = useRef<string | null>(null)
  const [repeating, setRepeating] = useState(false)
  const [profile, setProfile] = useState<'coco' | 'yolox' | 'bottle' | 'stairs' | 'rod' | 'footpath'>('coco')
  const smart = profile !== 'bottle'
  const embedded = profile === 'coco' || profile === 'stairs' || profile === 'rod' || profile === 'footpath'
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [active, setActive] = useState(false)
  const objectWorker = useObjectWorker(active && embedded, profile === 'stairs' ? 'stairs' : profile === 'rod' ? 'rod' : profile === 'footpath' ? 'footpath' : 'objects')
  const [ready, setReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('Camera off')
  const [diagnostic, setDiagnostic] = useState('')
  const [scanTime, setScanTime] = useState<number | null>(null)
  const [last, setLast] = useState<Cue | null>(null)
  const [counts, setCounts] = useState({ scans: 0, alerts: 0 })

  function play(cue: Cue) {
    void Speech.stop()
    player.replace(clips[cue].file)
    player.play()
  }

  function speakObstacle(message: string) {
    lastSpoken.current = message
    void Speech.stop()
    Speech.speak(message, { language: 'en', rate: 0.92 })
  }

  function changeProfile(next: typeof profile) {
    if (active) return
    objectWorker.cancel()
    encounter.current.clear()
    lastSpoken.current = null
    setProfile(next); setLast(null); setScanTime(null); setDiagnostic('')
    setCounts({ scans: 0, alerts: 0 })
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

  useEffect(() => {
    if (active && embedded && objectWorker.status.includes('unavailable.')) {
      setDiagnostic(objectWorker.status)
      pause(profile === 'footpath'
        ? 'The damaged paving model could not load. Check the model details below.'
        : 'The selected detection model is unavailable. Restart the camera to retry.')
    }
  }, [active, embedded, objectWorker.status, profile])

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
      if (embedded) objectWorker.reset()
      activeRun.current++
      const run = activeRun.current
      setDiagnostic('')
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
    if (!ready || pending.current || !camera.current || (embedded && !objectWorker.ready)) return
    pending.current = true
    const run = activeRun.current
    const automatic = auto.current
    setScanning(true)
    setDiagnostic('')
    let stage = 'Camera capture'
    setStatus(profile === 'stairs' ? 'Checking for stairs' : profile === 'footpath' ? 'Checking for damaged paving' : smart ? 'Checking for objects' : 'Scanning one image')
    timeout.current = setTimeout(() => {
      if (run !== activeRun.current) return
      if (profile === 'footpath') {
        setDiagnostic(`${stage} timed out after two minutes.`)
        pause('The damaged paving scan did not finish.')
      } else {
        pause('The camera scan timed out.')
      }
    }, profile === 'footpath' ? 120000 : smart ? 45000 : 10000)
    try {
      const capture = await camera.current.takePictureAsync({ pictureRef: true, shutterSound: false })
      if (run !== activeRun.current) return
      stage = 'Image resize'
      const captureEdge = profile === 'footpath' ? 768 : 480
      const size = smart
        ? (capture.width >= capture.height ? { width: captureEdge } : { height: captureEdge })
        : { width: WIDTH, height: HEIGHT }
      const image = await ImageManipulator.manipulate(capture).resize(size).renderAsync()
      if (run !== activeRun.current) return
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: profile === 'footpath' ? .95 : .9,
        base64: true,
      })
      try {
        if (run !== activeRun.current) return
        if (!saved.base64) throw new Error('Missing image data')
        stage = profile === 'footpath' ? 'Damaged paving model' : smart ? 'Object model' : 'Bottle detector'
        const frame = embedded ? null : decode(toByteArray(saved.base64), { useTArray: true })
        const result = embedded ? await objectWorker.scan(saved.base64) : null
        if (run !== activeRun.current || (automatic && !auto.current)) return
        setScanTime(result ? result.milliseconds : null)
        const objects = result?.hazards ?? (profile === 'yolox' && frame ? await scanYolo(frame) : [])
        if (run !== activeRun.current || (automatic && !auto.current)) return
        const labels = new Set(objects.map(object => object.class))
        const strongest = strongestHazardNames(objects)
        if (!smart && frame && detect(frame, defaultModel, 'bottle')) labels.add('dark object')
        const fallbackNames = [...labels]
          .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
          .sort((a, b) => a.localeCompare(b))
          .slice(0, 2)
          .map(label => label.toLowerCase())
        const spokenNames = strongest.length ? strongest : fallbackNames
        const phrase = hazardPhrase(spokenNames)
        const found = labels.size > 0
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
        const outside = profile !== 'footpath' && result?.seen.length ? ' Seen outside the alert corridor: ' + result.seen.join(', ') + '.' : ''
        const cue = profile === 'stairs' ? 'stairs' : 'obstacle'
        const spokenPhrase = profile === 'footpath' ? 'Possible damaged paving ahead.' : phrase
        setStatus(found ? (profile === 'stairs' ? clips.stairs.text : spokenPhrase) + outside : 'No alert on this scan.' + outside)
        if (alert) {
          stage = 'Alert audio'
          setLast(cue)
          if (profile === 'stairs') play(cue)
          else if (spokenNames.length) speakObstacle(spokenPhrase)
          else play(cue)
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
      <View style={styles.brandRow}><View style={styles.brandMark} accessible={false}><Text style={styles.brandLetter}>P.</Text></View><Text style={styles.brand}>PathSignal.</Text><Text style={styles.phoneTag}>PHONE APP</Text></View>
      <Text style={styles.label}>ON-DEVICE AI · SPOKEN ALERTS</Text>
      <Text accessibilityRole="header" style={styles.title}>Obstacle monitor</Text>
      <Text style={styles.body}>{smart ? 'Stand still and aim the rear camera at the path ahead.' : 'Stand still and centre the black bottle on light tile.'}</Text>
      <View style={styles.controls}>
        <Button title="Object detection" selected={profile === 'coco'} disabled={active} onPress={() => changeProfile('coco')} />
        <Button title="Stairs" selected={profile === 'stairs'} disabled={active} onPress={() => changeProfile('stairs')} />
        <Button title="Damaged paving" selected={profile === 'footpath'} disabled={active} onPress={() => changeProfile('footpath')} />
        <Button title="ROD field objects" selected={profile === 'rod'} disabled={active} onPress={() => changeProfile('rod')} />
        {hasNativeDetector && <Button title="YOLOX comparison" primary={profile === 'yolox'} disabled={active} onPress={() => changeProfile('yolox')} />}
        <Button title="Black bottle baseline" selected={profile === 'bottle'} disabled={active} onPress={() => changeProfile('bottle')} />
      </View>
      <View style={[styles.cameraPanel, retroStyles.shadow]}>
      {profile === 'stairs' && <Text style={styles.body}>Experimental stair alerts. No direction or distance measurement. Stop the camera to switch back to everyday objects.</Text>}
      {profile === 'footpath' && <Text style={styles.body}>Experimental paving damage alerts. {__DEV__ ? 'Keep your iPhone and PC on the same Wi-Fi. The model loads from your PC (about 151 MiB).' : 'The model downloads from the PathSignal site (about 151 MiB).'} Camera frames are processed on your phone. This mode has only been checked on a small set of clips.</Text>}
      {profile === 'rod' && <Text style={styles.body}>Experimental ROD detector trained on 25 street-scene classes. It can miss hazards and may alert on harmless objects; stationary checks only.</Text>}
      <View style={styles.panelBar}><Text style={styles.panelTitle}>{active ? 'REAR CAMERA · LIVE' : 'REAR CAMERA'}</Text><Text style={styles.modelBadge}>{profile === 'stairs' ? 'YOLOv8n stairs' : profile === 'rod' ? 'ROD YOLOv8n' : profile === 'footpath' ? 'Footpath model' : smart ? 'YOLOX-S' : 'BASELINE'}</Text></View>
      <View style={styles.preview}>
        {active ? <CameraView ref={camera} facing="back" mode="picture" style={StyleSheet.absoluteFill}
          animateShutter={false}
          onMountError={() => pause('Camera preview is unavailable.')}
          onCameraReady={() => {
            clearTimeout(timeout.current)
            setReady(true)
            setStatus('Camera ready. Scan when stationary.')
          }} /> : <View style={styles.placeholder}><View style={styles.cameraSymbol}><Text style={styles.cameraSymbolText}>◎</Text></View><Text style={styles.placeholderTitle}>Point. Scan. Listen.</Text><Text style={styles.placeholderText}>Start the rear camera when you are ready.</Text></View>}
        {active && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.corridorOverlay}>
          <View style={styles.corridorTop} /><View style={styles.corridorBottom} />
          <View style={styles.corridorLeft} /><View style={styles.corridorRight} />
        </View>}
      </View>
      <View style={[styles.statusPanel, last === 'paused' && !active && styles.pausedPanel]}><Text accessibilityLiveRegion="polite" style={styles.status}>{profile === 'footpath' && active && ready && !objectWorker.ready ? 'Camera ready. Loading the damaged paving model.' : status}</Text></View>
      </View>
      {active && embedded && <Text accessibilityLiveRegion="polite" style={styles.body}>{objectWorker.status}</Text>}
      {!!diagnostic && <Text selectable style={styles.body}>Scan details · {diagnostic}</Text>}
      <View style={styles.controls}>
        {active ? <>
          <Button title={scanning ? 'Scanning' : 'Scan now'} tone="orange" disabled={!ready || scanning || repeating || (embedded && !objectWorker.ready)} onPress={() => void scan()} />
          <Button title={repeating ? 'Stop repeated scans' : 'Start repeated scans'} disabled={!ready || (scanning && !repeating) || (embedded && !objectWorker.ready)} onPress={toggleRepeatedScans} />
          <Button title="Stop camera" tone="pink" onPress={() => { end('Camera off'); player.pause() }} />
        </> : <Button title="Start camera" primary onPress={() => void start()} />}
        <Button title="Repeat last alert" disabled={!last} onPress={() => { if (last) last === 'obstacle' && lastSpoken.current ? speakObstacle(lastSpoken.current) : play(last) }} />
        <Button title="Test audio" tone="teal" onPress={() => {
          void setAudioModeAsync({ playsInSilentMode: true }).then(() => play('test')).catch(() => {
            setStatus('Audio check could not start.')
            AccessibilityInfo.announceForAccessibility('Audio check could not start.')
          })
        }} />
      </View>
      {hasLidarModule && <Button title="LiDAR distance" onPress={openLidar} disabled={active} />}
      {embedded && <Text style={styles.body}>{profile === 'stairs' ? 'YOLOv8n stairs' : profile === 'rod' ? 'ROD YOLOv8n' : profile === 'footpath' ? 'Footpath damage segmentation' : 'YOLOX-S'}{scanTime !== null ? ' · Last scan ' + (scanTime / 1000).toFixed(1) + ' s' : ' · Loads when the camera starts'}</Text>}
      <View style={[styles.sessionPanel, retroStyles.shadow]}><Text style={styles.sessionHeading}>THIS SESSION</Text><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricNumber}>{counts.scans}</Text><Text style={styles.metricLabel}>scans</Text></View><View style={styles.metric}><Text style={styles.metricNumber}>{counts.alerts}</Text><Text style={styles.metricLabel}>alert requests</Text></View></View></View>
      <View style={styles.scopePanel}><Text style={styles.scopeHeading}>A stationary prototype</Text><Text style={styles.body}>Use this prototype while stationary. Silence carries no information about path conditions.</Text></View>
      <Button title="Source code and licences" onPress={() => { void Linking.openURL('https://pathsignal-six.vercel.app/source.html').catch(() => setStatus('Open pathsignal-six.vercel.app/source.html for source code and licences.')) }} />
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
  page: { flex: 1, backgroundColor: retro.cream },
  content: { padding: 20, paddingBottom: 38, gap: 19 },
  brandRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, paddingBottom: 5 },
  brandMark: { width: 36, height: 36, backgroundColor: retro.blue, borderColor: retro.ink, borderWidth: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  brandLetter: { color: retro.ink, fontWeight: '900', fontSize: 24 },
  brand: { color: retro.ink, fontWeight: '900', fontSize: 25, letterSpacing: -.8 },
  phoneTag: { color: retro.ink, fontWeight: '700', fontSize: 11, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1.5, borderColor: retro.ink, borderRadius: 20, backgroundColor: retro.pink },
  label: { color: retro.ink, fontWeight: '700', letterSpacing: .8, fontSize: 12 },
  title: { color: retro.ink, fontWeight: '900', fontSize: 35, letterSpacing: -1.2 },
  body: { color: retro.ink, fontSize: 16, lineHeight: 25 },
  cameraPanel: { borderColor: retro.ink, borderWidth: 2, borderRadius: 14, backgroundColor: retro.paper },
  panelBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, backgroundColor: retro.blue, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomWidth: 2, borderColor: retro.ink, padding: 12 },
  panelTitle: { color: retro.ink, fontSize: 12, fontWeight: '800' },
  modelBadge: { color: retro.ink, fontSize: 12, fontWeight: '700', backgroundColor: retro.cream, borderColor: retro.ink, borderWidth: 1, borderRadius: 5, padding: 4 },
  preview: { aspectRatio: 1, maxHeight: 380, backgroundColor: retro.paper, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  corridorOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  corridorTop: { position: 'absolute', left: '35%', top: '28%', width: '30%', borderTopWidth: 2, borderStyle: 'dotted', borderColor: '#d5ef79' },
  corridorBottom: { position: 'absolute', left: '19.16%', top: '94%', width: '61.68%', borderTopWidth: 2, borderStyle: 'dotted', borderColor: '#d5ef79' },
  corridorLeft: { position: 'absolute', left: '-6.85%', top: '60.7%', width: '67.7%', borderTopWidth: 2, borderStyle: 'dotted', borderColor: '#d5ef79', transform: [{ rotate: '103.5deg' }] },
  corridorRight: { position: 'absolute', left: '39.05%', top: '60.7%', width: '67.7%', borderTopWidth: 2, borderStyle: 'dotted', borderColor: '#d5ef79', transform: [{ rotate: '76.5deg' }] },
  placeholder: { gap: 13, padding: 20, alignItems: 'center' },
  cameraSymbol: { width: 62, height: 62, borderWidth: 2, borderColor: retro.ink, borderRadius: 14, backgroundColor: retro.orange, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-5deg' }] },
  cameraSymbolText: { color: retro.ink, fontSize: 39, lineHeight: 47 },
  placeholderTitle: { color: retro.ink, fontWeight: '800', fontSize: 23, textAlign: 'center' },
  placeholderText: { color: retro.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  statusPanel: { backgroundColor: retro.paper, borderTopWidth: 2, borderColor: retro.ink, padding: 14, borderBottomLeftRadius: 11, borderBottomRightRadius: 11 },
  pausedPanel: { backgroundColor: '#ffdad5' },
  status: { color: retro.ink, fontSize: 17, fontWeight: '700', lineHeight: 25 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { backgroundColor: retro.paper, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: 9, borderWidth: 2, borderColor: retro.ink, maxWidth: '100%' },
  primary: { backgroundColor: retro.blue },
  selected: { backgroundColor: retro.orange },
  disabled: { backgroundColor: retro.disabled, borderColor: '#827c75', shadowOpacity: 0, elevation: 0 },
  buttonText: { color: retro.ink, fontWeight: '700', fontSize: 15, lineHeight: 22, flexShrink: 1 },
  disabledText: { color: '#635f59' },
  sessionPanel: { borderWidth: 2, borderColor: retro.ink, borderRadius: 12, backgroundColor: retro.paper, overflow: 'hidden' },
  sessionHeading: { padding: 13, backgroundColor: retro.pink, borderBottomWidth: 2, borderColor: retro.ink, fontSize: 14, fontWeight: '800', color: retro.ink },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 38 },
  metric: { gap: 5 },
  metricNumber: { color: retro.ink, fontSize: 34, fontWeight: '800' },
  metricLabel: { color: retro.ink, fontSize: 15 },
  scopePanel: { backgroundColor: retro.teal, borderColor: retro.ink, borderWidth: 2, borderRadius: 10, padding: 16, gap: 7 },
  scopeHeading: { color: retro.ink, fontSize: 17, fontWeight: '800' },
})

