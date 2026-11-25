import { useEffect, useRef, type RefObject } from 'react'
import { useAudioPlayer } from 'expo-audio'
import { Platform, Vibration } from 'react-native'
import type { Pulse } from './proximityFeedback'

export const hasVibrationPulses = Platform.OS === 'android'
const toneOptions = { downloadFirst: true }

export function useProximityFeedback(pulse: Pulse | null, beeps: boolean, vibration: boolean,
  quietUntil: RefObject<number>) {
  const left = useAudioPlayer(require('./assets/pulses/left.wav'), toneOptions)
  const centre = useAudioPlayer(require('./assets/pulses/centre.wav'), toneOptions)
  const right = useAudioPlayer(require('./assets/pulses/right.wav'), toneOptions)
  const lastPulseAt = useRef(0)

  useEffect(() => {
    const vibrate = vibration && hasVibrationPulses
    if (!pulse || (!beeps && !vibrate)) {
      lastPulseAt.current = 0
      return
    }

    const player = pulse.bearing === 'left' ? left : pulse.bearing === 'right' ? right : centre
    let ended = false
    let timeout: ReturnType<typeof setTimeout>
    let seeking = false
    if (beeps) {
      player.shouldCorrectPitch = false
      player.volume = Math.min(.8, pulse.volume * 1.5)
    }

    function next() {
      if (ended || !pulse) return
      const now = Date.now()
      if (now >= pulse.expiresAt) {
        lastPulseAt.current = 0
        if (beeps) player.pause()
        if (vibrate) Vibration.cancel()
        return
      }
      const wait = Math.min(pulse.interval, Math.max(0, pulse.expiresAt - now))
      lastPulseAt.current = now
      if (vibrate) Vibration.vibrate(Math.min(pulse.vibration, pulse.expiresAt - now))
      // Android reports isLoaded=false after a clip ends. Seeking back to
      // zero must still be allowed so the next pulse can play.
      if (beeps && !seeking && now >= quietUntil.current) {
        seeking = true
        void player.seekTo(0).then(() => {
          if (!ended && Date.now() < pulse.expiresAt && Date.now() >= quietUntil.current) {
            player.setPlaybackRate(pulse.speed)
            player.play()
          }
        }).catch(() => {}).finally(() => { seeking = false })
      }
      timeout = setTimeout(next, wait)
    }

    const now = Date.now()
    const delay = Math.max(0, Math.min(pulse.expiresAt, lastPulseAt.current + pulse.interval) - now)
    timeout = setTimeout(next, delay)
    return () => {
      ended = true
      clearTimeout(timeout)
      if (beeps) player.pause()
      if (vibrate) Vibration.cancel()
    }
  }, [pulse, beeps, vibration, left, centre, right, quietUntil])
}
