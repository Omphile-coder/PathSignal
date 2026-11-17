const fs = require('node:fs')
const { evaluateCorridor } = require('./lidarGeometry.ts')
const { parseTrialExport, reviewTrial } = require('./lidarReview.ts')

try {
  const [input] = process.argv.slice(2)
  if (!input) throw new Error('Usage: node replay-lidar.cjs pathsignal-lidar-trials.json')
  if (fs.statSync(input).size > 30 * 1024 * 1024) throw new Error('The trial file exceeds 30 MB.')
  const rows = parseTrialExport(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''))
    .map(trial => reviewTrial(trial, evaluateCorridor))
  const outcomes = {}
  for (const row of rows) outcomes[row.outcome] = (outcomes[row.outcome] ?? 0) + 1
  console.log(JSON.stringify({ trials: rows.length, outcomes, rows }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
