const assert = require('node:assert/strict')
const { evaluateCorridor } = require('./lidarGeometry.ts')

const floor = Array.from({ length: 60 }, (_, index) => [50 + index * 3, (index % 7) * 10 - 30, 0]).flat()
function cluster(height, forward = 100, lateral = 0) {
  return Array.from({ length: 12 }, (_, index) => [forward + index, lateral + index % 3, height]).flat()
}
const frames = (...sets) => Array.from({ length: 3 }, () => [...floor, ...sets.flat()])
const check = (points, kinds) => assert.deepEqual(evaluateCorridor(points).hazards.map(hazard => hazard.kind), kinds)

check(frames(), [])
check(frames(cluster(14)), ['raised'])
check(frames(cluster(76)), ['raised'])
check(frames(cluster(-24)), ['drop'])
check(frames(cluster(155)), ['upper'])
check(frames(cluster(14, 100, 60)), [])
check(frames(cluster(14, 100, 0).slice(0, 15)), [])
check([frames(cluster(14))[0], floor, floor], [])
check([frames(cluster(14, 100))[0], frames(cluster(14, 140))[0], frames(cluster(14, 170))[0]], [])
check(frames(cluster(14, 140), cluster(-30, 80), cluster(155, 110)), ['drop', 'upper', 'raised'])
assert.deepEqual(evaluateCorridor([[], [], []]), { hazards: [], usableFrames: 0, sampledReturns: 0 })
assert.deepEqual(evaluateCorridor([floor, [], floor]).hazards, [])

// A single object split across the edges of adjacent cells should remain detectable.
const acrossCellEdge = [...cluster(14, 105).slice(0, 18), ...cluster(14, 120).slice(0, 18)]
check(frames(acrossCellEdge), ['raised'])

console.log('13 LiDAR corridor checks passed.')

const { LidarAlertGate } = require('./lidarAlertGate.ts')
const gate = new LidarAlertGate()
const raised = { kind: 'raised', metresAhead: 1.2 }
const drop = { kind: 'drop', metresAhead: .8 }
assert.deepEqual(gate.update([raised]), [raised])
assert.deepEqual(gate.update([raised, drop]), [drop])
assert.deepEqual(gate.update([drop]), [])
assert.deepEqual(gate.update([raised, drop]), [])
gate.update([drop])
gate.update([drop])
assert.deepEqual(gate.update([raised, drop]), [raised])
gate.reset()
assert.deepEqual(gate.update([drop]), [drop])
console.log('Repeated-alert gating checks passed.')
