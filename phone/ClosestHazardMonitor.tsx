import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import Constants from 'expo-constants'
import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { setAudioModeAsync } from 'expo-audio'
import * as Speech from 'expo-speech'
import WebView from 'react-native-webview'
import { estimatedMetres, estimatePhrase, type Hazard } from './nearestHazard'
import { newEncounter, updateEncounter, type Pulse } from './proximityFeedback'
import { prepareBundledDetector } from './bundledDetector'
import { loadCalibration, saveCalibration, type DistanceCalibration } from './distanceCalibration'
import { retro, retroStyles } from './retroTheme'
import { hasVibrationPulses, useProximityFeedback } from './useProximityFeedback'

function Button({ label, onPress, disabled, selected, color = retro.blue }: {
  label: string; onPress: () => void; disabled?: boolean; selected?: boolean; color?: string
}) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    accessibilityState={{ disabled, selected }} style={({ pressed }) => [
      styles.button, retroStyles.shadow, { backgroundColor: disabled ? retro.disabled : selected ? retro.teal : color },
      pressed && !disabled && retroStyles.pressed,
    ]}><Text style={styles.buttonText}>{label}</Text></Pressable>
}

function Monitor() {
  const [permission, requestPermission] = useCameraPermissions()
  const camera = useRef<CameraView>(null)
  const worker = useRef<WebView<{}>>(null)
  const run = useRef(0)
  const cameraActive = useRef(false)
  const startingCamera = useRef(false)
  const workerEpoch = useRef(0)
  const workerRequest = useRef<number | null>(null)
  const workerTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sequence = useRef(0)
  const request = useRef<{ id: number; capturedAt: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const encounter = useRef(newEncounter())
  const speechSequence = useRef(0)
  const quietUntil = useRef(0)
  const writingCalibration = useRef(false)
  const [active, setActive] = useState(false)
  const [workerOpen, setWorkerOpen] = useState(false)
  const [workerBusy, setWorkerBusy] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('Camera off')
  const [nearest, setNearest] = useState<Hazard | null>(null)
  const [milliseconds, setMilliseconds] = useState<number | null>(null)
  const [lastAlert, setLastAlert] = useState('')
  const [reference, setReference] = useState('')
  const [calibration, setCalibration] = useState<DistanceCalibration | null>(null)
  const [calibrationReady, setCalibrationReady] = useState(false)
  const [calibrationSaving, setCalibrationSaving] = useState(false)
  const [calibrationError, setCalibrationError] = useState('')
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [bundledUrl, setBundledUrl] = useState<string | null>(null)
  const [beeps, setBeeps] = useState(true)
  const [vibration, setVibration] = useState(hasVibrationPulses)
  const host = Constants.expoConfig?.hostUri
  const validHost = host && /^(https?:\/\/)?([^\/?#]+)(?:\/|$)/i.exec(host)
  const devUrl = validHost ? `${validHost[1] ?? 'http://'}${validHost[2]}/pathsignal-dev/dual/detector.html` : null
  const workerUrl = __DEV__ ? devUrl : bundledUrl
  const workerSource = useMemo(() => workerUrl ? { uri: workerUrl } : null, [workerUrl])
  const generation = workerEpoch.current
  const cameraPrepared = active && cameraReady && modelsReady
  const scanReady = cameraPrepared && !workerBusy
  const scale = calibration?.scale ?? null
  useProximityFeedback(repeating && active && modelsReady ? pulse : null, beeps, vibration, quietUntil)

  useEffect(() => {
    let live = true
    void loadCalibration().then(saved => {
      if (!live) return
      setCalibration(saved)
      if (saved) setReference(String(saved.referenceMetres))
    }).catch(() => {
      if (live) setCalibrationError('The saved calibration could not be read. You can set a new reference.')
    }).finally(() => {
      if (live) setCalibrationReady(true)
    })
    return () => { live = false }
  }, [])

  function speech(message: string, save = true) {
    const id = ++speechSequence.current
    quietUntil.current = Date.now() + 2400
    if (save) setLastAlert(message)
    const done = () => { if (speechSequence.current === id) quietUntil.current = 0 }
    void Speech.stop().catch(() => {}).then(() => {
      if (speechSequence.current === id) {
        Speech.speak(message, { language: 'en', rate: 1, onDone: done, onStopped: done, onError: done })
      }
    })
  }

  function stop(message = 'Camera off') {
    cameraActive.current = false
    run.current++
    clearTimeout(timer.current)
    request.current = null
    speechSequence.current++
    quietUntil.current = 0
    void Speech.stop().catch(() => {})
    setPulse(null)
    setCameraReady(false)
    setRepeating(false)
    setScanning(false)
    setActive(false)
    setNearest(null)
    setMilliseconds(null)
    setLastAlert('')
    setStatus(message)
    if (message !== 'Camera off' && AppState.currentState === 'active') {
      AccessibilityInfo.announceForAccessibility(message)
    }
  }

  function finishWorkerScan() {
    clearTimeout(workerTimeout.current)
    workerRequest.current = null
    setWorkerBusy(false)
  }

  function resetWorker() {
    workerEpoch.current++
    finishWorkerScan()
    setModelsReady(false)
    setWorkerOpen(false)
  }

  function failWorker(message: string) {
    resetWorker()
    if (cameraActive.current) stop(message)
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') return
      if (cameraActive.current) stop('Camera stopped when the app left the foreground.')
      resetWorker()
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => () => {
    run.current++
    clearTimeout(timer.current)
    clearTimeout(workerTimeout.current)
    speechSequence.current++
    void Speech.stop().catch(() => {})
  }, [])

  async function start() {
    if (__DEV__ && !devUrl) {
      setStatus('Open the app from the local Expo QR code on the same Wi-Fi as your PC.')
      return
    }
    if (!calibrationReady || startingCamera.current || cameraActive.current) return
    startingCamera.current = true
    try {
      if (!permission?.granted && !(await requestPermission()).granted) {
        setStatus('Camera access is required to scan.')
        return
      }
      if (!__DEV__ && !bundledUrl) {
        setStatus('Preparing bundled models')
        try {
          setBundledUrl(await prepareBundledDetector())
        } catch {
          stop('Could not open the models bundled in this app.')
          return
        }
        if (AppState.currentState !== 'active') return
      }
      run.current++
      cameraActive.current = true
      encounter.current = newEncounter()
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
      setActive(true)
      setWorkerOpen(true)
      setRepeating(true)
      setStatus(modelsReady ? 'Starting camera' : 'Loading object and depth models')
      timer.current = setTimeout(() => failWorker('Scan unavailable. The camera or models did not finish loading.'), 90000)
    } catch {
      stop('Camera permission could not be opened.')
    } finally {
      startingCamera.current = false
    }
  }

  async function scan() {
    const view = camera.current
    if (!scanReady || !view || request.current !== null || workerRequest.current !== null) return
    const id = ++sequence.current
    const current = run.current
    request.current = { id, capturedAt: Date.now() }
    setScanning(true)
    if (!repeating) {
      setStatus('Checking objects and depth')
    }
    timer.current = setTimeout(() => failWorker('Scan timed out. Start the camera to try again.'), 45000)
    let uri: string | undefined
    try {
      const capture = await view.takePictureAsync({ pictureRef: true, shutterSound: false })
      if (current !== run.current) return
      if (!capture) throw Error('The camera returned no image')
      const resized = await ImageManipulator.manipulate(capture)
        .resize(capture.width >= capture.height ? { width: 720 } : { height: 720 }).renderAsync()
      const photo = await resized.saveAsync({ format: SaveFormat.JPEG, compress: .9, base64: true })
      uri = photo.uri
      if (current !== run.current) return
      if (!photo.base64 || !worker.current) throw Error('Camera image unavailable')
      workerRequest.current = id
      setWorkerBusy(true)
      workerTimeout.current = setTimeout(() => failWorker('The image processing timed out. Start the camera to try again.'), 45000)
      worker.current.postMessage(JSON.stringify({ id, jpeg: photo.base64 }))
    } catch (error) {
      if (current === run.current) {
        if (workerRequest.current === id) resetWorker()
        stop('Scan paused. ' + (error instanceof Error ? error.message : String(error)))
      }
    } finally {
      if (uri) { try { new File(uri).delete() } catch { /* Expo manages the image cache. */ } }
    }
  }

  useEffect(() => {
    if (!scanReady) return
    clearTimeout(timer.current)
  }, [scanReady])

  useEffect(() => {
    if (!scanReady || !repeating || scanning) return
    const next = setTimeout(() => { void scan() }, 950)
    return () => clearTimeout(next)
  }, [scanReady, repeating, scanning])

  function receive(payload: string) {
    let message
    try { message = JSON.parse(payload) } catch { return }
    if (message?.type === 'ready') {
      setModelsReady(true)
      if (cameraActive.current) setStatus('Models ready')
      return
    }
    if (message?.type === 'failed') { failWorker('Models unavailable. ' + String(message.error)); return }
    if (!message || workerRequest.current === null || message.id !== workerRequest.current) return
    if (message.type === 'error') { failWorker('Scan paused. ' + String(message.error)); return }
    if (message.type !== 'result') return
    finishWorkerScan()
    const pending = request.current
    if (!pending || message.id !== pending.id) return
    clearTimeout(timer.current)
    request.current = null
    setScanning(false)
    setMilliseconds(message.milliseconds)
    const result: Hazard | null = message.nearest
    setNearest(result)
    const reading = result ? estimatedMetres(result, scale) : null
    const feedback = updateEncounter(encounter.current, result, reading, pending.capturedAt, Date.now())
    setPulse(repeating ? feedback.pulse : null)
    if (!result) {
      setStatus('No hazard detected on this scan.')
      return
    }
    const phrase = estimatePhrase(result, scale)
    setStatus(phrase)
    if (feedback.speech) speech(feedback.speech)
  }

  async function persistCalibration(value: DistanceCalibration | null) {
    if (writingCalibration.current) return false
    writingCalibration.current = true
    setCalibrationSaving(true)
    setCalibrationError('')
    try {
      await saveCalibration(value)
      setCalibration(value)
      setReference(value ? String(value.referenceMetres) : '')
      encounter.current.zone = null
      setPulse(null)
      return true
    } catch {
      setCalibrationError('The calibration could not be saved. Try again.')
      return false
    } finally {
      writingCalibration.current = false
      setCalibrationSaving(false)
    }
  }

  async function calibrate() {
    const known = Number(reference.trim().replace(',', '.'))
    if (!nearest || nearest.depth === null || scanning || repeating || !(known >= .2 && known <= 8)) {
      setStatus('Pause scanning and enter a measured distance from 0.2 to 8 metres for the last hazard.')
      return
    }
    const ratio = known / nearest.depth
    if (!Number.isFinite(ratio) || ratio < .2 || ratio > 5) {
      setStatus('That measured distance is too different from the model reading. Try another reference scan.')
      return
    }
    const current = run.current
    if (await persistCalibration({ referenceMetres: known, scale: ratio }) && current === run.current) {
      const phrase = estimatePhrase(nearest, ratio)
      setStatus(phrase)
      speech(phrase)
    }
  }

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View accessible accessibilityRole="header" accessibilityLabel="PathSignal" style={styles.masthead}>
        <View accessible={false} style={[styles.logoMark, retroStyles.shadow]}>
          <Text accessible={false} style={styles.logoLetter}>P</Text>
          <View accessible={false} style={styles.logoDot} />
        </View>
        <Text style={styles.wordmark}>PathSignal<Text style={styles.wordmarkPeriod}>.</Text></Text>
      </View>
      <View style={styles.monitor}>
        <Image source={require('./assets/retro/monitor-grid.png')} resizeMode="repeat" accessible={false}
          importantForAccessibility="no" style={styles.texture} />
        <Text accessibilityRole="header" style={styles.monitorTitle}>Closest-hazard monitor</Text>
        <Text style={styles.body}>Stand still and aim your rear camera at the path ahead.</Text>
        <Text style={styles.privacyNote}>Camera frames stay on this device</Text>
      <View style={[styles.card, retroStyles.shadow]}>
        <View style={styles.bar}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.windowLights}>
            <View style={[styles.windowLight, { backgroundColor: retro.pink }]} />
            <View style={[styles.windowLight, { backgroundColor: retro.orange }]} />
            <View style={[styles.windowLight, { backgroundColor: retro.teal }]} />
          </View>
          <Text style={styles.barText}>{active ? 'Rear camera · Live' : 'Rear camera · Off'}</Text>
        </View>
        <View style={[styles.preview, active ? styles.livePreview : styles.idlePreview]}>
          {active ? <CameraView ref={camera} facing="back" mode="picture" style={StyleSheet.absoluteFill}
            animateShutter={false} onCameraReady={() => {
              setCameraReady(true)
              if (modelsReady) setStatus('Camera ready')
            }}
            onMountError={() => stop('The rear camera could not start.')} />
            : <>
              <Image source={require('./assets/retro/preview-dots.png')} resizeMode="repeat" accessible={false}
                importantForAccessibility="no" style={styles.texture} />
              <View style={[styles.cameraBadge, retroStyles.shadow]} accessible={false} importantForAccessibility="no-hide-descendants">
                <Image source={require('./assets/retro/camera-outline.png')} style={styles.cameraIcon} accessible={false} />
              </View>
              <Text style={styles.placeholderTitle}>Your camera, your device.</Text>
              <Text style={[styles.body, styles.placeholderText]}>Start the camera to see your surroundings.</Text>
            </>}
          {active && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={StyleSheet.absoluteFill}>
            <View style={[styles.corridorLine, { top: '28%', left: '35%', width: '30%' }]} />
            <View style={[styles.corridorLine, { top: '94%', left: '19.16%', width: '61.68%' }]} />
            <View style={[styles.corridorLine, { top: '61%', left: '-17.6%', width: '89.4%', transform: [{ rotate: '100.2deg' }] }]} />
            <View style={[styles.corridorLine, { top: '61%', left: '28.2%', width: '89.4%', transform: [{ rotate: '79.8deg' }] }]} />
          </View>}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      <View style={[styles.controls, styles.cameraControls]}>
        {active ? <>
          <Button label="Stop camera" color={retro.pink} onPress={() => stop()} />
          <Button label={repeating ? 'Pause repeated scans' : 'Resume repeated scans'} disabled={!cameraPrepared || calibrationSaving}
            onPress={() => { setPulse(null); setRepeating(value => !value) }} />
          <Button label="Scan once" disabled={repeating || scanning || !scanReady} onPress={() => void scan()} />
        </> : <Button label="Start scanning" color={retro.orange} disabled={!calibrationReady || calibrationSaving} onPress={() => void start()} />}
        <Button label="Repeat last alert" disabled={!lastAlert} onPress={() => speech(lastAlert)} />
      </View>
      </View>
      {milliseconds !== null && <Text style={styles.body}>Last model scan {(milliseconds / 1000).toFixed(1)} s</Text>}
      <View style={[styles.calibration, retroStyles.shadow]}>
        <Text accessibilityRole="header" style={[styles.section, { backgroundColor: retro.teal }]}>Distance feedback</Text>
        <Text style={styles.body}>Beeps and vibration follow the closest hazard during repeated scans and stop when it clears the corridor. A saved distance calibration is required.</Text>
        <View style={styles.controls}>
          <Button label={beeps ? 'Beeps on' : 'Beeps off'} selected={beeps} onPress={() => setBeeps(value => !value)} />
          {hasVibrationPulses && <Button label={vibration ? 'Vibration on' : 'Vibration off'}
            selected={vibration} onPress={() => setVibration(value => !value)} />}
        </View>
      </View>
      <View style={[styles.calibration, retroStyles.shadow]}>
        <Text accessibilityRole="header" style={[styles.section, { backgroundColor: retro.orange }]}>Distance calibration</Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{!calibrationReady
          ? 'Checking saved calibration.'
          : calibration
            ? `Saved reference ${calibration.referenceMetres} m. Keep the same camera height and tilt for distance checks.`
            : 'Pause repeated scans. Aim straight at a measured target and tap Scan once. Enter its measured distance in metres.'}</Text>
        {!!calibrationError && <Text accessibilityLiveRegion="polite" style={styles.body}>{calibrationError}</Text>}
        <TextInput style={styles.input} inputMode="decimal" accessibilityLabel="Measured distance in metres"
          placeholder="Distance in metres, for example 1.2" placeholderTextColor={retro.muted}
          value={reference} onChangeText={setReference} editable={!repeating && !scanning && !calibrationSaving} />
        <Button label={calibrationSaving ? 'Saving calibration' : 'Set measured distance'}
          disabled={!calibrationReady || calibrationSaving || nearest?.depth == null || repeating || scanning || !reference.trim()}
          onPress={() => void calibrate()} />
        {calibration && <Button label="Clear distance calibration" disabled={repeating || scanning || calibrationSaving}
          onPress={() => { void persistCalibration(null) }} />}
      </View>
      <Text style={styles.body}>Stationary prototype. Use your usual mobility tools. Silence gives no information about whether the path is clear.</Text>
      </View>
    </ScrollView>
    {workerOpen && workerSource && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.worker}>
      <WebView<{}> ref={worker} key={generation} source={workerSource}
        originWhitelist={__DEV__ ? ['http://*', 'https://*'] : ['file://*']}
        allowFileAccess={!__DEV__} allowFileAccessFromFileURLs={!__DEV__}
        javaScriptEnabled scrollEnabled={false} onShouldStartLoadWithRequest={event => event.url === workerUrl}
        onMessage={event => { if (generation === workerEpoch.current) receive(event.nativeEvent.data) }}
        onError={event => { if (generation === workerEpoch.current) failWorker('The models could not open. ' + event.nativeEvent.description) }}
        onHttpError={event => { if (generation === workerEpoch.current) failWorker('The PC could not serve the model files. HTTP ' + event.nativeEvent.statusCode) }}
        onContentProcessDidTerminate={() => { if (generation === workerEpoch.current) failWorker('The model view closed. Restart the camera to retry.') }}
        onRenderProcessGone={() => { if (generation === workerEpoch.current) failWorker('The model view closed. Restart the camera to retry.') }} />
    </View>}
  </SafeAreaView>
}

export default function ClosestHazardMonitor() {
  return <SafeAreaProvider><Monitor /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: retro.teal },
  content: { paddingBottom: 24 },
  masthead: { minHeight: 78, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    gap: 10, backgroundColor: retro.paper, borderBottomWidth: 2, borderColor: retro.ink },
  logoMark: { width: 38, height: 38, borderWidth: 2, borderRadius: 9, borderColor: retro.ink,
    backgroundColor: retro.blue, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoLetter: { color: retro.ink, fontSize: 25, lineHeight: 29, fontWeight: '900' },
  logoDot: { position: 'absolute', right: 5, bottom: 5, width: 7, height: 7, borderRadius: 4,
    backgroundColor: retro.pink, borderWidth: 1, borderColor: retro.ink },
  wordmark: { color: retro.ink, fontSize: 25, fontWeight: '900', letterSpacing: -.8 },
  wordmarkPeriod: { color: retro.pink },
  monitor: { paddingHorizontal: 20, paddingVertical: 20, gap: 16, backgroundColor: retro.teal, overflow: 'hidden' },
  monitorTitle: { color: retro.ink, fontSize: 29, fontWeight: '900' },
  privacyNote: { alignSelf: 'flex-start', color: retro.ink, backgroundColor: retro.cream,
    borderColor: retro.ink, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12,
    paddingVertical: 8, fontSize: 12, fontWeight: '700' },
  card: { borderWidth: 2, borderColor: retro.ink, borderRadius: 14, overflow: 'hidden', backgroundColor: retro.paper },
  bar: { backgroundColor: retro.blue, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row',
    alignItems: 'center', gap: 10, borderBottomWidth: 2, borderColor: retro.ink },
  barText: { color: retro.ink, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  windowLights: { flexDirection: 'row', gap: 5 },
  windowLight: { width: 10, height: 10, borderWidth: 1, borderRadius: 5, borderColor: retro.ink },
  preview: { justifyContent: 'center', alignItems: 'center', padding: 16 },
  livePreview: { aspectRatio: 3 / 4, backgroundColor: retro.ink },
  idlePreview: { minHeight: 225, gap: 10, backgroundColor: retro.cream },
  cameraBadge: { width: 62, height: 62, borderWidth: 2, borderColor: retro.ink, borderRadius: 14,
    backgroundColor: retro.orange, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  texture: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  cameraIcon: { width: 34, height: 34 },
  placeholderTitle: { color: retro.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  placeholderText: { textAlign: 'center' },
  cameraControls: { paddingHorizontal: 14, paddingBottom: 16 },
  corridorLine: { position: 'absolute', borderTopWidth: 2, borderColor: '#e6ff73', borderStyle: 'dotted' },
  status: { padding: 14, borderTopWidth: 2, borderColor: retro.ink, color: retro.ink, fontSize: 17, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 9,
    borderWidth: 2, borderColor: retro.ink, borderRadius: 10 },
  buttonText: { color: retro.ink, fontWeight: '800', fontSize: 16 },
  calibration: { gap: 10, borderWidth: 2, borderRadius: 10, borderColor: retro.ink, backgroundColor: retro.paper, padding: 14 },
  section: { color: retro.ink, fontSize: 20, fontWeight: '800', marginHorizontal: -14, marginTop: -14,
    paddingHorizontal: 14, paddingVertical: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderBottomWidth: 2, borderColor: retro.ink },
  body: { color: retro.ink, fontSize: 16, lineHeight: 23 },
  input: { color: retro.ink, backgroundColor: retro.cream, fontSize: 16, minHeight: 48, padding: 10, borderWidth: 1, borderRadius: 8, borderColor: retro.muted },
  worker: { position: 'absolute', top: 0, left: 0, width: 8, height: 8, opacity: .01 },
})
