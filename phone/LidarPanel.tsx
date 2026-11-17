import { useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeSyntheticEvent, ViewProps } from 'react-native'
import { requireNativeView, requireOptionalNativeModule } from 'expo'
import { useCameraPermissions } from 'expo-camera'
import * as Speech from 'expo-speech'
import { evaluateCorridor, hazardLabels } from './lidarGeometry'
import { LidarAlertGate } from './lidarAlertGate'
import type { Hazard } from './lidarGeometry'
import { saveLidarTrial, shareLidarTrials } from './lidarTrials'
import type { LidarTrial } from './lidarTrials'

type ScanMode = 'distance' | 'floor' | 'corridor'
type ScanRequest = { id: number; mode: ScanMode }
type Reading = { id: number; metres?: number; error?: string; floorSet?: boolean; floorInvalidated?: boolean; frames?: number[][] }
type CapturedTrial = Omit<Extract<LidarTrial, {kind: 'distance'}>, 'notes' | 'measuredMetres' | 'expected'> |
  Omit<Extract<LidarTrial, {kind: 'corridor'}>, 'notes' | 'measuredMetres' | 'expected'>
type LidarProps = ViewProps & { request: ScanRequest; onReading: (event: NativeSyntheticEvent<Reading>) => void }
const lidar = requireOptionalNativeModule<{ isSupported(): boolean }>('PathSignalLidar')
const Preview = lidar ? requireNativeView<LidarProps>('PathSignalLidar') : null
export const hasLidarModule = lidar !== null

export function LidarPanel({ onExit }: { onExit: () => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [active, setActive] = useState(false)
  const [watching, setWatching] = useState(false)
  const watch = useRef(false)
  const nextCheck = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const gate = useRef(new LidarAlertGate())
  const [alertCount, setAlertCount] = useState(0)
  const [lastAnnouncement, setLastAnnouncement] = useState('')
  const speechRequest = useRef(0)
  const latestAlertTrial = useRef<CapturedTrial | null>(null)
  const [request, setRequest] = useState<ScanRequest>({ id: 0, mode: 'distance' })
  const [floorSet, setFloorSet] = useState(false)
  const [hazards, setHazards] = useState<Hazard[]>([])
  const [busy, setBusy] = useState(false)
  const [trial, setTrial] = useState<CapturedTrial | null>(null)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [expected, setExpected] = useState<LidarTrial['expected']>(null)
  const [journalStatus, setJournalStatus] = useState('')
  const [sharing, setSharing] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [status, setStatus] = useState('Preview off')
  const pending = useRef<number | null>(null)
  const sequence = useRef(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const supported = lidar?.isSupported() ?? false

  function cancelSpeech() {
    speechRequest.current++
    void Speech.stop()
  }

  function announce(message: string) {
    const id = ++speechRequest.current
    setLastAnnouncement(message)
    void Speech.stop().catch(() => {}).then(() => {
      if (speechRequest.current === id) Speech.speak(message, { language: 'en' })
    })
  }

  function clearPending() {
    pending.current = null
    clearTimeout(timeout.current)
    setBusy(false)
  }

  function stopWatching() {
    if (watch.current) {
      watch.current = false
      clearTimeout(nextCheck.current)
      clearPending()
      cancelSpeech()
      if (latestAlertTrial.current) setTrial(latestAlertTrial.current)
      setWatching(false)
    }
  }

  function stop(message: string) {
    stopWatching()
    cancelSpeech()
    clearPending()
    setRequest({ id: 0, mode: 'distance' })
    setFloorSet(false)
    setHazards([])
    setActive(false)
    setStatus(message)
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') stop('Preview stopped in the background.')
    })
    return () => {
      sub.remove()
      clearTimeout(timeout.current)
      clearTimeout(nextCheck.current)
      watch.current = false
      cancelSpeech()
    }
  }, [])

  async function start() {
    try {
      const allowed = permission?.granted || (await requestPermission()).granted
      if (!allowed) {
        setStatus('Allow camera access in your iPhone settings.')
        return
      }
      setAlertCount(0)
      setLastAnnouncement('')
      setActive(true)
      setStatus('Aim at a solid target and hold still.')
    } catch {
      setStatus('Could not request camera access.')
    }
  }

  function toggleWatching() {
    if (watch.current) {
      stopWatching()
      setStatus('Repeated checks stopped.')
      return
    }
    if (!active || !floorSet || pending.current !== null || savingRef.current) return
    gate.current.reset()
    latestAlertTrial.current = null
    setAlertCount(0)
    setLastAnnouncement('')
    cancelSpeech()
    watch.current = true
    setWatching(true)
    setStatus('Repeated checks started. Stand still.')
    setReference('')
    setNotes('')
    setExpected(null)
    setJournalStatus('')
    setTrial(null)
    scan('corridor', true)
  }

  function scan(mode: ScanMode, repeated = false) {
    if (!active || pending.current !== null || savingRef.current || repeated !== watch.current) return
    const id = ++sequence.current
    pending.current = id
    setBusy(true)
    if (mode === 'floor') setFloorSet(false)
    if (!repeated) {
      setHazards([])
      setTrial(null)
      setReference('')
      setNotes('')
      setExpected(null)
      setJournalStatus('')
      cancelSpeech()
      setStatus(mode === 'floor' ? 'Finding the floor plane…' : mode === 'corridor' ? 'Checking the corridor…' : 'Reading LiDAR…')
    }
    setRequest({ id, mode })
    timeout.current = setTimeout(() => {
      if (pending.current === id) {
        const message = 'LiDAR did not respond. Reopen the preview and try again.'
        stop(message)
        announce(message)
      }
    }, 8500)
  }

  function onReading({ nativeEvent }: NativeSyntheticEvent<Reading>) {
    const { id, metres, error, floorSet: calibrated, floorInvalidated, frames } = nativeEvent
    if (floorInvalidated) {
      stopWatching()
      clearPending()
      setFloorSet(false)
      setHazards([])
      const message = 'Floor reference lost. Set it again before checking the corridor.'
      setStatus(message)
      announce(message)
      return
    }
    if (pending.current !== id) return
    clearPending()
    if (error) {
      const message = watch.current ? 'Repeated checks paused. ' + error : error
      stopWatching()
      setStatus(message)
      announce(message)
      return
    }
    if (calibrated) {
      setFloorSet(true)
      setStatus('Floor reference set. Aim forward and check the corridor.')
      announce('Floor reference set.')
      return
    }
    const capturedAt = new Date().toISOString()
    if (frames) {
      const result = evaluateCorridor(frames)
      const ordered = result.hazards
      const captured: CapturedTrial = { capturedAt, kind: 'corridor', frames, result }
      setTrial(captured)
      setHazards(ordered)
      if (result.usableFrames < 3) {
        const message = watch.current
          ? 'Repeated checks paused. Not enough depth coverage.'
          : 'Not enough depth coverage. Aim forward and try again.'
        stopWatching()
        setStatus(message)
        announce(message)
        return
      }
      setStatus(ordered.length ? 'Possible hazards detected' : 'No candidate flagged in the sampled area.')
      const alerts = watch.current ? gate.current.update(ordered) : ordered.slice(0, 1)
      if (alerts.length) {
        if (watch.current) latestAlertTrial.current = captured
        setAlertCount(count => count + 1)
        const message = alerts.map(alert => hazardLabels[alert.kind] + ', about ' +
          alert.metresAhead.toFixed(1) + ' metres ahead.').join(' ')
        announce(message)
      }
      if (watch.current) nextCheck.current = setTimeout(() => scan('corridor', true), 750)
      return
    }
    if (metres === undefined || !Number.isFinite(metres) || metres <= 0) {
      setStatus('No stable reading.')
      return
    }
    setTrial({ capturedAt, kind: 'distance', metres })
    const value = metres.toFixed(2)
    setStatus(value + ' m from camera plane')
    announce(value + ' metres')
  }

  async function saveTrial() {
    if (!trial || savingRef.current) return
    const measuredMetres = reference.trim() ? Number(reference.trim().replace(',', '.')) : null
    if (measuredMetres !== null && (!Number.isFinite(measuredMetres) || measuredMetres <= 0)) {
      setJournalStatus('Enter a positive measured distance in metres, or leave it blank.')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await saveLidarTrial({ ...trial, measuredMetres, expected, notes: notes.trim() })
      setTrial(null)
      setJournalStatus('Trial saved on this iPhone.')
    } catch {
      setJournalStatus('The trial could not be saved.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function shareTrials() {
    setSharing(true)
    try {
      if (!await shareLidarTrials()) setJournalStatus('Save at least one trial first.')
    } catch {
      setJournalStatus('Trial export could not open.')
    } finally {
      setSharing(false)
    }
  }

  return <View style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>LiDAR distance</Text>
    <Text style={styles.text}>Stand still. Aim the crosshair at a broad target and read its depth.</Text>
    {active && Preview && <View style={styles.preview}>
      <Preview style={StyleSheet.absoluteFill} request={request} onReading={onReading} />
      <View pointerEvents="none" accessible={false} style={styles.crosshair} />
    </View>}
    <Text accessibilityLiveRegion="polite" style={styles.status}>{supported ? status : 'LiDAR scene depth is unavailable on this device.'}</Text>
    <View style={styles.controls}>
      {supported && (active
        ? <>
          <Action title="Read LiDAR distance" onPress={() => scan('distance')} disabled={busy || saving || watching} />
          <Action title={floorSet ? 'Reset floor reference' : 'Set floor reference'} onPress={() => scan('floor')} disabled={busy || saving || watching} />
          <Action title="Check corridor" onPress={() => scan('corridor')} disabled={busy || saving || watching || !floorSet} primary />
          <Action title={watching ? 'Stop repeated checks' : 'Repeat stationary checks'} onPress={toggleWatching}
            disabled={!watching && (busy || saving || !floorSet)} />
          <Action title="Stop preview" onPress={() => stop('Preview off')} />
        </>
        : <Action title="Start LiDAR preview" onPress={() => void start()} primary />)}
      <Action title="Back to obstacle monitor" onPress={onExit} />
    </View>
    {!!lastAnnouncement && <Action title="Repeat last announcement" onPress={() => announce(lastAnnouncement)} />}
    {alertCount > 0 && <Text style={styles.text}>{alertCount} alert{alertCount === 1 ? '' : 's'} in this preview</Text>}
    {hazards.map(hazard => <Text key={hazard.kind} style={styles.text}>
      {hazardLabels[hazard.kind]} · about {hazard.metresAhead.toFixed(1)} m ahead
    </Text>)}
    {trial && !watching && <View style={styles.journal}>
      <Text accessibilityRole="header" style={styles.status}>Save this trial</Text>
      <Text style={styles.text}>{trial.kind === 'distance' ? trial.metres.toFixed(2) + ' m camera depth' :
        trial.result.hazards.length ? trial.result.hazards.map(h => hazardLabels[h.kind] + ' · ' + h.metresAhead.toFixed(2) + ' m').join('\n')
          : trial.result.usableFrames < 3 ? 'Insufficient depth coverage' : 'No candidate flagged'}</Text>
      <TextInput accessibilityLabel="Tape-measured distance in metres" value={reference} onChangeText={setReference}
        keyboardType="decimal-pad" placeholder="Measured distance in metres (optional)" placeholderTextColor="#a6b4b4" style={styles.input} />
      <TextInput accessibilityLabel="Trial notes" value={notes} onChangeText={setNotes} maxLength={300}
        placeholder="Trial notes (optional)" placeholderTextColor="#a6b4b4" style={styles.input} />
      {trial.kind === 'corridor' && <>
        <Text style={styles.text}>Observed condition (optional)</Text>
        <View style={styles.controls}>
          {([['clear', 'Empty'], ['raised', 'Raised'], ['drop', 'Drop-off'], ['upper', 'Upper']] as const).map(([kind, title]) =>
            <Action key={kind} title={title} selected={expected === kind} onPress={() => setExpected(expected === kind ? null : kind)} />)}
        </View>
      </>}
      <Action title={saving ? "Saving trial" : "Save trial"} disabled={saving} onPress={() => void saveTrial()} />
    </View>}
    {supported && <Action title="Export saved trials" disabled={busy || sharing || saving || watching} onPress={() => void shareTrials()} />}
    {!!journalStatus && <Text accessibilityLiveRegion="polite" style={styles.text}>{journalStatus}</Text>}
    {active && <Text style={styles.text}>{floorSet
      ? 'Aim forward and stand still while checking. Silence carries no information about the path.'
      : 'To check the corridor, first aim at a clear patch of floor and set the floor reference.'}</Text>}
  </View>
}

function Action({ title, onPress, disabled = false, primary = false, selected }: {
  title: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled}
    onPress={onPress} style={[styles.action, (primary || selected) && styles.primary, disabled && styles.disabled]}>
    <Text style={[styles.actionText, (primary || selected) && styles.primaryText]}>{title}</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  title: { color: '#f0f1ed', fontWeight: '800', fontSize: 34 },
  text: { color: '#c0cbcb', fontSize: 16, lineHeight: 24 },
  status: { color: '#ffe0b4', fontSize: 18, fontWeight: '600' },
  preview: { aspectRatio: 1, maxHeight: 370, backgroundColor: '#181e21', borderRadius: 12,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  crosshair: { width: 26, height: 26, borderWidth: 2, borderColor: '#ffc474', borderRadius: 13 },
  journal: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#394345', borderRadius: 8 },
  input: { minHeight: 46, color: '#f0f1ed', padding: 9, borderRadius: 6, backgroundColor: '#222b2d' },
  controls: { gap: 8, flexDirection: 'row', flexWrap: 'wrap' },
  action: { backgroundColor: '#222b2d', padding: 12, minHeight: 48, borderRadius: 8, justifyContent: 'center' },
  primary: { backgroundColor: '#ffc474' },
  disabled: { opacity: .45 },
  actionText: { color: '#f0f1ed', fontSize: 15, fontWeight: '700' },
  primaryText: { color: '#201b15' },
})
