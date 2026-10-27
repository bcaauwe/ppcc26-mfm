import type { FleetAsset } from './fleet.ts'

export type EquipmentIdentity = Pick<FleetAsset, 'name' | 'number' | 'className'>
export type EquipmentKind = 'excavator' | 'crane' | 'telehandler' | 'forklift' | 'loader' | 'roller' | 'scissor' | 'generator' | 'generic'

export function equipmentKind(asset: EquipmentIdentity): EquipmentKind {
  const text = `${asset.name} ${asset.className} ${asset.number}`
  if (/excavat|\bEX-/i.test(text)) return 'excavator'
  if (/crane|\bCR-/i.test(text)) return 'crane'
  if (/telehand|telescopic handler|\bTH-/i.test(text)) return 'telehandler'
  if (/forklift|fork lift|\bFL-/i.test(text)) return 'forklift'
  if (/skid.?steer|loader|bulldoz|dozer|\bSS-|\bLD-/i.test(text)) return 'loader'
  if (/roller|compactor|\bRL-/i.test(text)) return 'roller'
  if (/scissor|\bSL-/i.test(text)) return 'scissor'
  if (/generat|compressor|\bGEN-/i.test(text)) return 'generator'
  return 'generic'
}
