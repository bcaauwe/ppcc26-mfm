import type { FleetAccount } from './fleet.ts'
import { buildCampus, campusLocationSize, placeLocationAssets } from './visualization.ts'
import type { AssetView, CampusLayout, CampusLocation, GeographicSite, Point } from './visualization.ts'
import { cityCenters } from './cityCenters.ts'

export function hasCoordinates(account: FleetAccount): account is FleetAccount & { latitude: number; longitude: number } {
  return typeof account.latitude === 'number' && Number.isFinite(account.latitude) && Math.abs(account.latitude) <= 90 &&
    typeof account.longitude === 'number' && Number.isFinite(account.longitude) && Math.abs(account.longitude) <= 180
}

export function projectCoordinates(latitude: number, longitude: number, originLatitude: number, originLongitude: number): Point {
  const radians = Math.PI / 180
  const longitudeDelta = ((longitude - originLongitude + 540) % 360) - 180
  return [6_371_000 * longitudeDelta * radians * Math.cos(originLatitude * radians), 0,
    6_371_000 * (originLatitude - latitude) * radians]
}

export function buildGeographicCampus(views: readonly AssetView[], accounts: readonly FleetAccount[]): CampusLayout {
  const issues: string[] = []
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const summitAccounts = sorted.filter(a => a.name.trim().replace(/\s+/g, ' ').toLowerCase() === 'summit equipment')
  const summit = summitAccounts.length === 1 ? summitAccounts[0] : undefined
  if (!summit) issues.push(summitAccounts.length ? 'Multiple Summit Equipment accounts found; the home location cannot be identified.' : 'The Summit Equipment account was not found.')
  const unmappedAccounts = sorted.filter(a => !hasCoordinates(a))
  if (unmappedAccounts.length) issues.push(`${unmappedAccounts.length} account(s) have missing or invalid coordinates and are not plotted.`)
  const origin = summit && hasCoordinates(summit) ? summit : sorted.find(hasCoordinates)
  const sites: GeographicSite[] = []
  for (const account of sorted) {
    if (!hasCoordinates(account) || !origin || !hasCoordinates(origin)) continue
    const isSummit = account.id.toLowerCase() === summit?.id.toLowerCase()
    const colocated = sites.find(s => s.latitude === account.latitude && s.longitude === account.longitude)
    if (colocated) {
      colocated.accounts.push(account)
      colocated.summit ||= isSummit
    } else {
      sites.push({
        id: `site:${account.id.toLowerCase()}`, accounts: [account], summit: isSummit,
        latitude: account.latitude, longitude: account.longitude,
        center: projectCoordinates(account.latitude, account.longitude, origin.latitude, origin.longitude),
        locationIds: [],
      })
    }
  }
  const base = buildCampus(views.filter(v => v.assessment.zone !== 'customer'))
  const homeLocations = base.locations.filter(l => l.area !== 'customer')
  const homeMinX = Math.min(...homeLocations.map(l => l.center[0] - l.width / 2))
  const homeMaxX = Math.max(...homeLocations.map(l => l.center[0] + l.width / 2))
  const homeMinZ = Math.min(...homeLocations.map(l => l.center[2] - l.depth / 2))
  const homeMaxZ = Math.max(...homeLocations.map(l => l.center[2] + l.depth / 2))
  const homeCenterX = (homeMinX + homeMaxX) / 2
  const homeCenterZ = (homeMinZ + homeMaxZ) / 2
  const largestSpan = Math.max(120, homeMaxX - homeMinX, homeMaxZ - homeMinZ,
    campusLocationSize(views.length).width, campusLocationSize(views.length).depth)
  let closest = Infinity
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    closest = Math.min(closest, Math.hypot(sites[i].center[0] - sites[j].center[0], sites[i].center[2] - sites[j].center[2]))
  }
  const metersPerUnit = Number.isFinite(closest) ? Math.max(1, Math.min(250, closest / (largestSpan * 1.5 + 40))) : 100
  sites.forEach(site => { site.center = [site.center[0] / metersPerUnit, 0, site.center[2] / metersPerUnit] })
  const locations: CampusLocation[] = []
  const assets: CampusLayout['assets'] = []
  const home = sites.find(s => s.summit)
  if (home) {
    for (const location of homeLocations) {
      locations.push({ ...location, center: [
        home.center[0] + location.center[0] - homeCenterX, 0,
        home.center[2] + location.center[2] - homeCenterZ,
      ] })
      home.locationIds.push(location.id)
    }
    for (const placed of base.assets) {
      assets.push({ ...placed, position: [
        home.center[0] + placed.position[0] - homeCenterX, 0,
        home.center[2] + placed.position[2] - homeCenterZ,
      ] })
    }
  } else {
    issues.push('Summit Equipment has no usable home coordinates; yard/service assets remain in Location unresolved.')
  }
  const assignment = new Map<string, AssetView[]>()
  const unresolved: AssetView[] = []
  for (const view of views) {
    if (view.assessment.zone !== 'customer') {
      if (!home) unresolved.push(view)
      continue
    }
    const rentals = view.assessment.currentRentals
    const rentalSites = rentals.map(r => sites.find(s => s.accounts.some(a => a.id.toLowerCase() === r.accountId?.toLowerCase())))
    const site = rentalSites[0]
    if (!rentals.length || !site || rentalSites.some(s => s?.id !== site.id)) {
      unresolved.push(view)
    } else {
      const rows = assignment.get(site.id) ?? []
      rows.push(view)
      assignment.set(site.id, rows)
    }
  }
  for (const site of sites) {
    const rows = assignment.get(site.id) ?? []
    if (site.summit && !rows.length) continue
    const size = campusLocationSize(rows.length)
    const location: CampusLocation = {
      id: `customer:${site.id}`, area: 'customer',
      label: site.accounts.filter(a => a.id !== summit?.id).map(a => a.name).join(' / ') || 'Customer rental at Summit',
      center: [site.center[0], 0, site.center[2] + (site.summit ? (homeMaxZ - homeMinZ) / 2 + size.depth / 2 + 8 : 0)],
      ...size,
    }
    locations.push(location)
    site.locationIds.push(location.id)
    assets.push(...placeLocationAssets(location, rows))
  }
  if (unresolved.length || !locations.length) {
    const size = campusLocationSize(unresolved.length)
    const minX = Math.min(0, ...locations.map(l => l.center[0] - l.width / 2))
    const minZ = Math.min(0, ...locations.map(l => l.center[2] - l.depth / 2))
    const location: CampusLocation = { id: 'unlocated', area: 'unlocated', label: 'Location unresolved / not geographically plotted',
      center: [minX - size.width / 2 - 30, 0, minZ], ...size }
    locations.push(location)
    assets.push(...placeLocationAssets(location, unresolved))
  }
  if (unresolved.length) issues.push(`${unresolved.length} asset(s) have no unambiguous mapped location; shown separately in Location unresolved.`)
  if (!sites.length) issues.push('No valid account coordinates are available. Addresses are not geocoded or guessed.')
  const cities = origin && hasCoordinates(origin) ? cityCenters.map(city => {
    const offset = projectCoordinates(city.latitude, city.longitude, origin.latitude, origin.longitude)
    const center: Point = [offset[0] / metersPerUnit, 0, offset[2] / metersPerUnit]
    const distance = Math.min(...sites.map(site => Math.hypot(center[0] - site.center[0], center[2] - site.center[2]))) * metersPerUnit
    return { ...city, id: `city:${city.id}`, center, distance }
  }).filter(city => city.distance <= 15_000).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name)).slice(0, 8) : []
  const extent = Math.max(65, ...locations.map(l => Math.max(Math.abs(l.center[0]) + l.width / 2, Math.abs(l.center[2]) + l.depth / 2)),
    ...cities.map(city => Math.max(Math.abs(city.center[0]), Math.abs(city.center[2])) + 20)) + 12
  return { locations, assets, extent, geography: {
    metersPerUnit, sites, cities, unmappedAccounts, unresolvedAssets: unresolved.map(v => v.asset.id), issues,
  } }
}
