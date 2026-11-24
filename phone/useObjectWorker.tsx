import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import WebView from 'react-native-webview'
import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import type { DetectedObject } from '@tensorflow-models/coco-ssd'

type Result = { hazards: DetectedObject[]; seen: string[]; milliseconds: number; model: string }
type Pending = { id: number; resolve(result: Result): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }

export function useObjectWorker(enabled: boolean, mode: 'objects' | 'stairs' | 'rod' = 'objects') {
  const modelName = mode === 'stairs' ? 'YOLOv8n stairs' : mode === 'rod' ? 'ROD YOLOv8n · 25 classes' : 'YOLOX-S'
  const view = useRef<WebView<{}>>(null)
  const [html, setHtml] = useState('')
  const [status, setStatus] = useState('Preparing object model')
  const [ready, setReady] = useState(false)
  const [generation, setGeneration] = useState(0)
  const pending = useRef<Pending | null>(null)
  const sequence = useRef(0)
  const bootTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cancel() {
    const request = pending.current
    if (!request) return
    pending.current = null
    clearTimeout(request.timer)
    request.reject(Error('Scan cancelled'))
  }

  function reset() {
    cancel()
    setReady(false)
    setStatus('Preparing ' + modelName)
  }

  function fail(message: string) {
    cancel()
    clearTimeout(bootTimeout.current)
    setReady(false)
    setStatus(modelName + ' unavailable. ' + message)
  }

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    setReady(false)
    setStatus('Opening ' + modelName)
    bootTimeout.current = setTimeout(() => {
      if (!disposed) fail('Loading timed out. Stop and start the camera to retry.')
    }, 90000)
    void (async () => {
      try {
        const assetModule = mode === 'stairs' ? require('./assets/model/stairs-detector.html')
          : mode === 'rod' ? require('./assets/model/rod-detector.html') : require('./assets/model/detector.html')
        const asset = await Asset.fromModule(assetModule).downloadAsync()
        if (!asset.localUri) throw Error('Detector file unavailable')
        const content = await new File(asset.localUri).text()
        if (!disposed) setHtml(content)
      } catch (error) {
        if (!disposed) fail(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => {
      disposed = true
      clearTimeout(bootTimeout.current)
      cancel()
      setHtml('')
      setReady(false)
    }
  }, [enabled, generation, mode])

  function scan(jpeg: string): Promise<Result> {
    if (!ready || !view.current) return Promise.reject(Error('The selected model is still loading'))
    if (pending.current) return Promise.reject(Error('A scan is already running'))
    const id = ++sequence.current
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.current?.id !== id) return
        pending.current = null
        reject(Error('Detection timed out. Restart the camera to retry.'))
        setReady(false)
        setStatus('Object model timed out')
        setGeneration(value => value + 1)
      }, 20000)
      pending.current = { id, timer, resolve, reject }
      view.current!.postMessage(JSON.stringify({ id, jpeg }))
    })
  }

  const worker = enabled && html ? <View pointerEvents="none" accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, opacity: .01 }}>
    <WebView<{}> ref={view} key={mode + generation} source={{ html }} originWhitelist={['*']}
      javaScriptEnabled scrollEnabled={false}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
      onError={event => fail(event.nativeEvent.description)}
      onContentProcessDidTerminate={() => { fail('Processing view restarted'); setGeneration(value => value + 1) }}
      onMessage={event => {
        let message
        try { message = JSON.parse(event.nativeEvent.data) } catch { return }
        if (message.type === 'ready') {
          clearTimeout(bootTimeout.current)
          setReady(true)
          setStatus('Model ready · ' + modelName)
        } else if (message.type === 'failed') fail(String(message.error))
        else if (message.type === 'progress' && (!message.id || pending.current?.id === message.id)) {
          setStatus(String(message.text))
        } else if (pending.current?.id === message.id && ['result', 'error'].includes(message.type)) {
          const request = pending.current
          if (!request) return
          pending.current = null
          clearTimeout(request.timer)
          setStatus('Model ready · ' + modelName)
          if (message.type === 'error') request.reject(Error(String(message.error)))
          else request.resolve(message as Result)
        }
      }} />
  </View> : null

  return { scan, cancel, reset, ready, status, worker }
}
