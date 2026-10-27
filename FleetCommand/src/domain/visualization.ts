import { currentCustomerLabel } from './fleet.ts'
import type { Assessment, FleetAccount, FleetAsset } from './fleet.ts'

export type AssetView = { asset: FleetAsset; assessment: Assessment }
export type CampusArea = 'all' | 'rental' | 'yard' | 'service' | 'customer' | 'unlocated'
export type Point = [number, number, number]
export interface CampusLocation {
  id: string
  area: Exclude<CampusArea, 'all'>
  label: string
  center: Point
  width: number
  depth: number
}
export interface PlacedAsset extends AssetView {
  position: Point
  locationId: string
}
export interface CampusLayout {
  locations: CampusLocation[]
  assets: PlacedAsset[]
  extent: number
  geography?: {
    metersPerUnit: number
    sites: GeographicSite[]
    cities: GeographicCity[]
    unmappedAccounts: FleetAccount[]
    unresolvedAssets: string[]
    issues: string[]
  }
}
export interface GeographicCity {
  id: string
  name: string
  latitude: number
  longitude: number
  center: Point
}
export interface GeographicSite {
  id: string
  accounts: FleetAccount[]
  summit: boolean
  latitude: number
  longitude: number
  center: Point
  locationIds: string[]
}
export const areaLabels: Record<CampusArea, string> = {
  all: 'Whole operation', rental: 'Rental Office', yard: 'The Yard',
  service: 'Service Center', customer: 'Customer sites',
  unlocated: 'Location unresolved',
}

export function countLocationAssets(layout: CampusLayout, locationIds: readonly string[]): number {
  return layout.assets.filter(asset => locationIds.includes(asset.locationId)).length
}

const columns = (count: number) => Math.max(3, Math.ceil(Math.sqrt(count)))
export function campusLocationSize(count: number) {
  return {
    width: Math.max(28, columns(count) * 5 + 8),
    depth: Math.max(26, Math.ceil(count / columns(count)) * 6 + 17),
  }
}
export function placeLocationAssets(location: CampusLocation, rows: readonly AssetView[]): PlacedAsset[] {
  return [...rows].sort((a, b) => a.asset.number.localeCompare(b.asset.number) || a.asset.id.localeCompare(b.asset.id))
    .map((view, index) => ({
      ...view, locationId: location.id, position: [
        location.center[0] + (index % columns(rows.length) - (columns(rows.length) - 1) / 2) * 5,
        0,
        location.center[2] - location.depth / 2 + 13 + Math.floor(index / columns(rows.length)) * 6,
      ],
    }))
}

export function buildCampus(views: readonly AssetView[]): CampusLayout {
  const yard = views.filter(v => v.assessment.zone === 'yard')
  const service = views.filter(v => v.assessment.zone === 'service')
  const customers = new Map<string, { label: string; views: AssetView[] }>()
  for (const view of views.filter(v => v.assessment.zone === 'customer')) {
    const label = currentCustomerLabel(view.assessment.currentRentals)
    const key = label.toLowerCase()
    const group = customers.get(key) ?? { label, views: [] }
    group.views.push(view)
    customers.set(key, group)
  }
  const locations: CampusLocation[] = []
  const assets: PlacedAsset[] = []
  const width = (count: number) => campusLocationSize(count).width
  const depth = (count: number) => campusLocationSize(count).depth
  function add(location: CampusLocation, rows: AssetView[]) {
    locations.push(location)
    assets.push(...placeLocationAssets(location, rows))
  }
  const yardWidth = width(yard.length)
  const serviceWidth = width(service.length)
  add({ id: 'rental', area: 'rental', label: areaLabels.rental, center: [-yardWidth / 2 - 22, 0, -18], width: 30, depth: 26 }, [])
  add({ id: 'yard', area: 'yard', label: areaLabels.yard, center: [0, 0, -18], width: yardWidth, depth: depth(yard.length) }, yard)
  add({ id: 'service', area: 'service', label: areaLabels.service, center: [yardWidth / 2 + serviceWidth / 2 + 10, 0, -18], width: serviceWidth, depth: depth(service.length) }, service)
  let edge = -yardWidth / 2 - 37
  const customerZ = Math.max(...locations.map(l => l.center[2] + l.depth / 2)) + 30
  const groups = [...customers.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (!groups.length) {
    add({ id: 'customer-empty', area: 'customer', label: 'No assets inferred with customers', center: [0, 0, customerZ], width: 30, depth: 26 }, [])
  }
  for (const [key, group] of groups) {
    const w = width(group.views.length)
    add({ id: `customer:${key}`, area: 'customer', label: group.label, center: [edge + w / 2, 0, customerZ], width: w, depth: depth(group.views.length) }, group.views)
    edge += w + 10
  }
  const extent = Math.max(65, ...locations.map(l => Math.max(Math.abs(l.center[0]) + l.width / 2, Math.abs(l.center[2]) + l.depth / 2))) + 12
  return { locations, assets, extent }
}

export function campusFocus(layout: CampusLayout, area: CampusArea, assetId?: string, locationId?: string): { target: Point; distance: number } {
  const asset = layout.assets.find(a => a.asset.id === assetId)
  if (asset) return { target: asset.position, distance: 15 }
  const city = layout.geography?.cities.find(c => c.id === locationId)
  if (city) return { target: city.center, distance: Math.max(70, 7000 / layout.geography!.metersPerUnit) }
  const site = layout.geography?.sites.find(s => s.id === locationId)
  const chosen = layout.locations.filter(l => locationId ? l.id === locationId || site?.locationIds.includes(l.id) : area === 'all' || l.area === area)
  const locations = chosen.length ? chosen : layout.locations
  if (!locations.length) return { target: [0, 0, 0], distance: 65 }
  const context = area === 'all' && !locationId ? layout.geography?.cities ?? [] : []
  const minX = Math.min(...locations.map(l => l.center[0] - l.width / 2), ...context.map(c => c.center[0]))
  const maxX = Math.max(...locations.map(l => l.center[0] + l.width / 2), ...context.map(c => c.center[0]))
  const minZ = Math.min(...locations.map(l => l.center[2] - l.depth / 2), ...context.map(c => c.center[2]))
  const maxZ = Math.max(...locations.map(l => l.center[2] + l.depth / 2), ...context.map(c => c.center[2]))
  return { target: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2], distance: Math.max(35, (maxX - minX) * .95, (maxZ - minZ) * 1.2) }
}
