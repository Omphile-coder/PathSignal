export type Scene = 'block' | 'empty' | 'off-path' | 'distractor'
export const scenes: Record<Scene, string> = {
  block: 'Foam block in path', empty: 'Empty path',
  'off-path': 'Foam block outside path', distractor: 'Orange floor marking',
}
export const duration = 7

// Rendered frames are used to produce the bundled synthetic test videos.
export function drawScene(ctx: CanvasRenderingContext2D, seconds: number, scene: Scene) {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.scale(width / 960, height / 540)
  const floor = ctx.createLinearGradient(0, 0, 0, 540)
  floor.addColorStop(0, '#77756d'); floor.addColorStop(.48, '#a9a399'); floor.addColorStop(1, '#777671')
  ctx.fillStyle = floor
  ctx.fillRect(0, 0, 960, 540)
  const line = (points: number[], color: string, size: number) => {
    ctx.beginPath(); ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.stroke()
  }
  for (let i = -4; i <= 4; i++) line([480 + i * 82, 0, 480 + i * 320, 540], '#3b39345c', 2)
  for (let i = 0; i < 8; i++) {
    const v = ((i + seconds * .67) % 8) / 8
    const y = 540 * v * v
    line([0, y, 960, y], '#3d39366b', 1 + v * 3)
    line([0, y + 3, 960, y + 3], '#e7dfd02c', 1)
  }
  for (let i = 0; i < 8000; i++) {
    const x = ((i * 4019) % 11011) / 11011 * 960
    const y = ((i * i * 13 + i * 131) % 9973) / 9973 * 540
    ctx.fillStyle = i % 2 ? '#26231c18' : '#fff7df20'
    ctx.fillRect(x, y, 1 + (i % 3), 1)
  }
  if (scene !== 'empty' && seconds > .65 && seconds < 5.9) {
    const progress = (seconds - .65) / 5.25
    const x = scene === 'off-path' ? 145 - progress * 100 : 500 + progress * 18
    const y = 140 + progress * 325
    const w = 26 + progress * 155
    const h = scene === 'distractor' ? 3 : 9 + progress * 37
    const polygon = (points: number[], color: string) => {
      ctx.beginPath(); ctx.moveTo(points[0], points[1])
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
      ctx.closePath(); ctx.fillStyle = color; ctx.fill()
    }
    ctx.fillStyle = '#23211c45'
    ctx.beginPath(); ctx.ellipse(x + w * .12, y + h * .65, w * .67, w * .18, -.08, 0, Math.PI * 2); ctx.fill()
    polygon([x-w*.52,y,x+w*.48,y,x+w*.42,y+h,x-w*.59,y+h], '#bf501c')
    polygon([x-w*.52,y,x-w*.32,y-w*.29,x+w*.56,y-w*.29,x+w*.48,y], '#ef7a2f')
    polygon([x+w*.48,y,x+w*.56,y-w*.29,x+w*.51,y+h-w*.24,x+w*.42,y+h], '#99431c')
    line([x-w*.49,y-1,x+w*.45,y-1], '#ffab65', 2)
  }
  const vignette = ctx.createRadialGradient(480, 260, 180, 480, 260, 580)
  vignette.addColorStop(0, '#14171800'); vignette.addColorStop(1, '#12161665')
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, 960, 540)
  ctx.restore()
}
