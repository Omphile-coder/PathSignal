import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { CorridorResult, HazardKind } from './lidarGeometry'

export type LidarTrial = {
  capturedAt: string
  measuredMetres: number | null
  notes: string
  expected: HazardKind | 'clear' | null
} & (
  { kind: 'distance'; metres: number } |
  { kind: 'corridor'; frames: number[][]; result: CorridorResult }
)

const journal = new Directory(Paths.document, 'pathsignal-lidar-trials')

export async function saveLidarTrial(trial: LidarTrial) {
  journal.create({ idempotent: true, intermediates: true })
  const name = 'trial-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.json'
  const temporary = new File(journal, name + '.tmp')
  try {
    await temporary.write(JSON.stringify(trial))
    await temporary.move(new File(journal, name))
  } catch (error) {
    if (temporary.exists) temporary.delete()
    throw error
  }
}

export async function shareLidarTrials() {
  if (!journal.exists) return false
  const trials = journal.list()
    .filter((entry): entry is File => entry instanceof File && /^trial-.*\.json$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!trials.length) return false
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable.')
  const contents = await Promise.all(trials.map(async file => JSON.parse(await file.text())))
  const output = new File(Paths.cache, 'pathsignal-lidar-trials.json')
  await output.write(JSON.stringify({ format: 'pathsignal-lidar-v1', trials: contents }))
  await Sharing.shareAsync(output.uri, { mimeType: 'application/json', UTI: 'public.json' })
  return true
}
