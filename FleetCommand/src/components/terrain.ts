import type { CampusLayout } from '../domain/visualization.ts'

function hash(x: number, y: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 144269)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const sx = x - ix, sy = y - iy
  const u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy)
  const top = hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u
  const bottom = hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u
  return top * (1 - v) + bottom * v
}
const fields = [[85, 97, 59], [112, 108, 70], [74, 93, 57], [125, 113, 78], [63, 82, 55], [95, 107, 68], [107, 118, 77]]

export function createTerrainRaster(size = 1024, seed = 73) {
  if (!Number.isInteger(size) || size < 16 || size > 2048) throw new RangeError('Terrain size must be an integer between 16 and 2048')
  if (!Number.isFinite(seed)) throw new RangeError('Terrain seed must be finite')
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size
    const forest = noise(u * 12, v * 12, seed)
    const grain = (hash(x, y, seed) - .5) * 18
    const warp = noise(u * 7, v * 7, seed + 1) * .05
    const cellX = (u + warp) * 38, cellY = (v + warp * .4) * 46
    const plot = hash(Math.floor(cellX), Math.floor(cellY), seed)
    const color = fields[Math.floor(plot * fields.length)]
    const riverDistance = Math.abs(u - (.43 + .10 * Math.sin(v * 8) + .025 * Math.sin(v * 24)))
    const water = riverDistance < .0025
    const woods = forest > .60 || riverDistance < .009
    const hedge = cellX % 1 < .028 || cellY % 1 < .025
    const stripe = Math.sin((plot < .5 ? x : y) * 2.6) * 2
    const shade = .87 + noise(u * 4, v * 4, seed + 2) * .24
    const base = water ? [39, 67, 67] : woods ? [33, 57, 39] : hedge ? [46, 65, 42] : color
    const index = (y * size + x) * 4
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] = base[channel] * shade + grain + (woods || water ? 0 : stripe)
    pixels[index + 3] = 255
  }
  return { width: size, height: size, pixels }
}

export function createTerrainCanvas(layout: CampusLayout) {
  const raster = createTerrainRaster()
  const base = document.createElement('canvas')
  base.width = base.height = raster.width
  const baseContext = base.getContext('2d')
  if (!baseContext) throw new Error('Offline terrain requires Canvas 2D support')
  baseContext.putImageData(new ImageData(raster.pixels, raster.width, raster.height), 0, 0)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 2048
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Offline terrain requires Canvas 2D support')
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height)
  const span = layout.extent * 3
  for (const city of layout.geography?.cities ?? []) {
    const x = (city.center[0] / span + .5) * canvas.width
    const y = (city.center[2] / span + .5) * canvas.height
    const radius = Math.max(14, Math.min(160, (city.name === 'Columbus' ? 6500 : 1800) / (layout.geography!.metersPerUnit * span) * canvas.width))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((hash(0, 0, Number(city.id.slice(5))) - .5) * .4)
    for (let row = -10; row <= 10; row++) for (let col = -10; col <= 10; col++) {
      const value = hash(col, row, Number(city.id.slice(5)))
      if (Math.hypot(row, col) > 8 + value * 2 || value < .18) continue
      const block = radius / 10
      ctx.fillStyle = ['#777b6d', '#88877b', '#636c61', '#959184', '#6f7667'][Math.floor(value * 5)]
      ctx.fillRect(col * block, row * block, block * .8, block * .8)
      ctx.fillStyle = '#b0ac9c'
      ctx.fillRect(col * block + block * .15, row * block + block * .15, block * .25, block * .22)
    }
    ctx.strokeStyle = '#afa999'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-radius, 0); ctx.lineTo(radius, 0)
    ctx.moveTo(0, -radius); ctx.lineTo(0, radius)
    ctx.stroke()
    ctx.restore()
  }
  ctx.strokeStyle = '#8b8d7a'
  ctx.lineWidth = 2
  for (let i = 0; i < 2; i++) {
    ctx.beginPath()
    for (let step = 0; step <= 40; step++) {
      const x = step / 40 * canvas.width
      const y = canvas.height * (.2 + i * .5 + .045 * Math.sin(step / 5 + i))
      if (!step) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  return canvas
}
