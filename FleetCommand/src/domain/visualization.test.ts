import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessAsset } from './fleet.ts'
import { buildCampus, campusFocus, countLocationAssets } from './visualization.ts'
import type { FleetAccount, FleetAsset } from './fleet.ts'
import { buildGeographicCampus, hasCoordinates, projectCoordinates } from './geography.ts'
import { cityCenters } from './cityCenters.ts'
import { createTerrainRaster } from '../components/terrain.ts'

function view(id: string, overrides: Partial<FleetAsset> = {}) {
  const asset: FleetAsset = { id, number: id, name: 'Excavator', className: 'Excavators',
    status: 100000000, rentals: [], returns: [], orders: [], maintenance: [], disposals: [], ...overrides }
  return { asset, assessment: assessAsset(asset, new Date('2026-10-22T12:00:00Z'), 7) }
}
test('campus preserves every asset once and uses existing workflow inference', () => {
  const views = [view('yard'), view('service', { status: 100000001 }),
    view('customer', { rentals: [{ id: 'r', number: 'R1', account: 'Acme', status: 100000000, start: '2026-10-01' }] }),
    view('unknown', { status: 100000006 })]
  const layout = buildCampus(views)
  assert.equal(layout.assets.length, views.length)
  assert.equal(new Set(layout.assets.map(v => v.asset.id)).size, views.length)
  for (const placed of layout.assets) {
    assert.equal(layout.locations.find(l => l.id === placed.locationId)?.area, placed.assessment.zone)
    assert.equal(placed.asset, views.find(v => v.asset.id === placed.asset.id)?.asset)
  }
  assert.ok(layout.locations.some(l => l.label === 'Acme'))
  assert.ok(layout.locations.some(l => l.label === 'Current rental agreement not found'))
  assert.equal(layout.assets.filter(v => v.locationId === 'rental').length, 0)
})
test('large fleets have unique positions inside non-overlapping locations', () => {
  const layout = buildCampus(Array.from({ length: 500 }, (_, i) => view(String(i), { status: i % 2 ? 100000001 : 100000000 })))
  assert.equal(new Set(layout.assets.map(v => v.position.join(','))).size, 500)
  for (const asset of layout.assets) {
    const location = layout.locations.find(l => l.id === asset.locationId)!
    assert.ok(Math.abs(asset.position[0] - location.center[0]) < location.width / 2 - 1)
    assert.ok(Math.abs(asset.position[2] - location.center[2]) < location.depth / 2 - 1)
  }
  for (const a of layout.locations) for (const b of layout.locations) {
    if (a === b) continue
    assert.ok(Math.abs(a.center[0] - b.center[0]) >= (a.width + b.width) / 2 ||
      Math.abs(a.center[2] - b.center[2]) >= (a.depth + b.depth) / 2)
  }
})
test('customer grouping ignores case and excludes historical or future accounts', () => {
  const rentals = (account: string) => [{ id: account, number: account, account, status: 100000000, start: '2026-10-01' }]
  const layout = buildCampus([view('a', { rentals: rentals('ACME') }), view('b', { rentals: rentals('acme') }),
    view('c', { rentals: [{ ...rentals('Future')[0], start: '2026-11-01' }, { ...rentals('Old')[0], status: 100000001 }] })])
  assert.equal(layout.locations.filter(l => l.area === 'customer').length, 1)
  assert.equal(layout.assets.filter(a => a.assessment.zone === 'customer').length, 2)
  assert.deepEqual(buildCampus([...layout.assets].reverse()).assets.map(a => a.asset.id), layout.assets.map(a => a.asset.id))
})
test('empty campus and every area have finite camera targets; asset focus is exact', () => {
  for (const layout of [buildCampus([]), buildCampus([view('a')])]) {
    for (const area of ['all', 'rental', 'yard', 'service', 'customer'] as const) {
      const focus = campusFocus(layout, area)
      assert.ok([...focus.target, focus.distance].every(Number.isFinite))
    }
  }
  const layout = buildCampus([view('a')])
  assert.deepEqual(campusFocus(layout, 'all', 'a').target, layout.assets[0].position)
})

const homeAccount: FleetAccount = { id: 'home', name: 'Summit Equipment', address: '1 Test Road', latitude: 40, longitude: -80 }
const eastAccount: FleetAccount = { id: 'east', name: 'Example East', address: '2 Test Road', latitude: 40, longitude: -79.8 }
const northAccount: FleetAccount = { id: 'north', name: 'Example North', address: '3 Test Road', latitude: 40.2, longitude: -80 }
test('site asset counts aggregate assigned areas once and exclude unresolved equipment', () => {
  const views = [view('yard'), view('inspection', { status: 100000003 }),
    rented('east-1', 'east'), rented('east-2', 'east'), rented('unresolved', 'missing')]
  const layout = buildGeographicCampus(views, [homeAccount, eastAccount, northAccount])
  const home = layout.geography!.sites.find(site => site.summit)!
  const east = layout.geography!.sites.find(site => site.accounts.some(account => account.id === 'east'))!
  const north = layout.geography!.sites.find(site => site.accounts.some(account => account.id === 'north'))!
  assert.equal(countLocationAssets(layout, home.locationIds), 2)
  assert.equal(countLocationAssets(layout, [...home.locationIds, ...home.locationIds]), 2)
  assert.equal(countLocationAssets(layout, east.locationIds), 2)
  assert.equal(countLocationAssets(layout, north.locationIds), 0)
  assert.equal(countLocationAssets(layout, ['yard']), 1)
  assert.equal(countLocationAssets(layout, ['service']), 1)
  assert.equal(countLocationAssets(layout, ['rental']), 0)
  assert.equal(countLocationAssets(layout, ['unlocated']), 1)
  assert.equal(countLocationAssets(layout, []), 0)
})
test('co-located company labels share their site count without duplicating equipment', () => {
  const second = { ...eastAccount, id: 'second', name: 'Co-located Company' }
  const layout = buildGeographicCampus([rented('east', 'east'), rented('second', 'second')], [homeAccount, eastAccount, second])
  const site = layout.geography!.sites.find(site => site.accounts.some(account => account.id === 'east'))!
  assert.equal(site.accounts.length, 2)
  assert.equal(countLocationAssets(layout, site.locationIds), 2)
})
test('pending inspection is placed in Service rather than Yard in both campus layouts', () => {
  const views = [view('inspection', { status: 100000003 }), view('yard')]
  for (const layout of [buildCampus(views), buildGeographicCampus(views, [homeAccount])]) {
    assert.equal(layout.assets.length, views.length)
    assert.equal(layout.assets.find(a => a.asset.id === 'inspection')?.locationId, 'service')
    assert.equal(layout.assets.find(a => a.asset.id === 'yard')?.locationId, 'yard')
    assert.equal(layout.locations.find(l => l.id === 'service')?.area, 'service')
  }
})
function rented(id: string, accountId?: string) {
  return view(id, { rentals: [{ id: `r-${id}`, number: id, accountId, account: 'Duplicate display name', status: 100000000, start: '2026-10-01' }] })
}
test('geographic projection preserves north/east and real distance without sending addresses anywhere', () => {
  assert.deepEqual(projectCoordinates(40, -80, 40, -80), [0, 0, 0])
  const east = projectCoordinates(40, -79, 40, -80)
  const north = projectCoordinates(41, -80, 40, -80)
  assert.ok(east[0] > 85_000 && east[0] < 85_300)
  assert.ok(north[2] < -111_000 && north[2] > -111_300)
  assert.ok(projectCoordinates(0, -179, 0, 179)[0] > 0, 'wrap longitude across the date line')
  assert.ok(hasCoordinates({ ...homeAccount, latitude: 0, longitude: 0 }))
  for (const latitude of [undefined, NaN, Infinity, 91]) assert.ok(!hasCoordinates({ ...homeAccount, latitude }))
  assert.ok(!hasCoordinates({ ...homeAccount, longitude: -181 }))
})
test('Summit office, yard and service share one geographic site; all customer accounts are plotted', () => {
  const views = [view('yard'), view('service', { status: 100000001 }), rented('east-asset', 'EAST')]
  const layout = buildGeographicCampus(views, [northAccount, homeAccount, eastAccount])
  assert.equal(layout.geography?.sites.length, 3)
  const home = layout.geography!.sites.find(s => s.summit)!
  assert.deepEqual(home.center, [0, 0, 0])
  assert.deepEqual(home.locationIds, ['rental', 'yard', 'service'])
  assert.equal(layout.assets.find(a => a.asset.id === 'yard')?.locationId, 'yard')
  assert.equal(layout.assets.find(a => a.asset.id === 'service')?.locationId, 'service')
  const east = layout.geography!.sites.find(s => s.accounts[0].id === 'east')!
  const north = layout.geography!.sites.find(s => s.accounts[0].id === 'north')!
  assert.ok(east.center[0] > home.center[0])
  assert.ok(north.center[2] < home.center[2])
  assert.equal(layout.assets.find(a => a.asset.id === 'east-asset')?.locationId, east.locationIds[0])
  assert.ok(layout.locations.some(l => north.locationIds.includes(l.id)), 'accounts without equipment remain visible')
  assert.equal(layout.assets.length, views.length)
  assert.equal(layout.geography?.issues.length, 0)
  const meters = east.center[0] * layout.geography!.metersPerUnit
  assert.ok(Math.abs(meters - projectCoordinates(40, -79.8, 40, -80)[0]) < .001)
})
test('account IDs, not names or historical agreements, determine the customer location', () => {
  const customer = rented('asset', 'east')
  customer.asset.rentals.push({ id: 'old', number: 'Old', accountId: 'north', status: 100000001 })
  customer.asset.rentals.push({ id: 'future', number: 'Future', accountId: 'north', status: 100000000, start: '2027-01-01' })
  const layout = buildGeographicCampus([view('local'), view('asset', customer.asset)], [
    homeAccount, { ...eastAccount, name: 'Same display name' }, { ...northAccount, name: 'Same display name' },
  ])
  assert.equal(layout.assets.find(a => a.asset.id === 'asset')?.locationId, 'customer:site:east')
})
test('missing/invalid coordinates and conflicting current customers remain explicitly unresolved', () => {
  const invalid = { ...northAccount, latitude: undefined }
  const conflict = view('conflict', { rentals: [
    { id: 'one', number: 'one', accountId: 'east', status: 100000000 },
    { id: 'two', number: 'two', accountId: 'home', status: 100000000 },
  ] })
  const views = [rented('missing-id'), rented('invalid', 'north'), conflict]
  const layout = buildGeographicCampus(views, [homeAccount, eastAccount, invalid])
  assert.equal(layout.geography?.unmappedAccounts[0].id, 'north')
  assert.deepEqual(new Set(layout.geography?.unresolvedAssets), new Set(views.map(v => v.asset.id)))
  assert.equal(layout.assets.filter(a => a.locationId === 'unlocated').length, 3)
  assert.ok(layout.geography?.issues.length)
  assert.equal(new Set(layout.assets.map(a => a.asset.id)).size, 3)
})
test('co-located accounts share one true pin without duplicating assets or misidentifying Summit', () => {
  const same = { ...eastAccount, latitude: homeAccount.latitude, longitude: homeAccount.longitude }
  const layout = buildGeographicCampus([view('yard'), rented('rental', 'east')], [same, homeAccount])
  assert.equal(layout.geography?.sites.length, 1)
  assert.ok(layout.geography?.sites[0].summit)
  assert.equal(layout.assets.length, 2)
  assert.equal(layout.assets.find(a => a.asset.id === 'rental')?.locationId, `customer:${layout.geography?.sites[0].id}`)
})
test('missing/ambiguous home accounts never assign yard assets to a guessed address', () => {
  for (const accounts of [[], [eastAccount], [homeAccount, { ...homeAccount, id: 'home-two' }]]) {
    const layout = buildGeographicCampus([view('yard')], accounts)
    assert.equal(layout.assets[0].locationId, 'unlocated')
    assert.ok(layout.geography?.issues.length)
    for (const area of ['all', 'rental', 'yard', 'service', 'customer', 'unlocated'] as const) {
      assert.ok(Object.values(campusFocus(layout, area)).flat().every(Number.isFinite))
    }
  }
})
test('site camera bounds include the whole Summit campus and focus a single customer site', () => {
  const layout = buildGeographicCampus([view('yard'), rented('rental', 'east')], [homeAccount, eastAccount])
  const home = layout.geography!.sites.find(s => s.summit)!
  const east = layout.geography!.sites.find(s => !s.summit)!
  const homeFocus = campusFocus(layout, 'all', undefined, home.id)
  const eastFocus = campusFocus(layout, 'all', undefined, east.id)
  assert.ok(homeFocus.distance > eastFocus.distance)
  assert.deepEqual(eastFocus.target, east.center)
  assert.deepEqual(campusFocus(layout, 'all', 'rental').target, layout.assets.find(a => a.asset.id === 'rental')?.position)
})
test('large geographic fleets retain unique, contained positions and separate site footprints', () => {
  const views = Array.from({ length: 500 }, (_, i) => i % 3 === 0 ? rented(String(i), i % 2 ? 'east' : 'north') :
    view(String(i), { status: i % 2 ? 100000001 : 100000000 }))
  const layout = buildGeographicCampus(views, [homeAccount, eastAccount, northAccount])
  assert.equal(layout.assets.length, 500)
  assert.equal(new Set(layout.assets.map(a => a.position.join(','))).size, 500)
  for (const placed of layout.assets) {
    const location = layout.locations.find(l => l.id === placed.locationId)!
    assert.ok(Math.abs(placed.position[0] - location.center[0]) < location.width / 2 - 1)
    assert.ok(Math.abs(placed.position[2] - location.center[2]) < location.depth / 2 - 1)
  }
  for (const a of layout.locations) for (const b of layout.locations) {
    if (a === b) continue
    assert.ok(Math.abs(a.center[0] - b.center[0]) >= (a.width + b.width) / 2 ||
      Math.abs(a.center[2] - b.center[2]) >= (a.depth + b.depth) / 2)
  }
  const reversed = buildGeographicCampus([...views].reverse(), [northAccount, eastAccount, homeAccount])
  assert.deepEqual(reversed.assets.map(a => [a.asset.id, a.position]), layout.assets.map(a => [a.asset.id, a.position]))
})
test('offline city context uses public centers, the exact account projection and bounded local coverage', () => {
  const accounts = [
    { ...homeAccount, latitude: 39.95, longitude: -83.02 },
    { ...eastAccount, latitude: 39.89, longitude: -82.90 },
    { ...northAccount, latitude: 40.29, longitude: -83.06 },
    { ...eastAccount, id: 'south', latitude: 39.72, longitude: -82.61 },
  ]
  const layout = buildGeographicCampus([view('yard')], accounts)
  const cities = layout.geography!.cities
  assert.ok(cities.length > 0 && cities.length <= 8)
  for (const name of ['Columbus', 'Delaware', 'Groveport', 'Lancaster']) assert.ok(cities.some(city => city.name === name), name)
  for (const city of cities) {
    const source = cityCenters.find(record => `city:${record.id}` === city.id)!
    assert.equal(city.latitude, source.latitude)
    assert.equal(city.longitude, source.longitude)
    const projected = projectCoordinates(city.latitude, city.longitude, accounts[0].latitude, accounts[0].longitude)
    assert.deepEqual(city.center, [projected[0] / layout.geography!.metersPerUnit, 0, projected[2] / layout.geography!.metersPerUnit])
    const distance = Math.min(...layout.geography!.sites.map(site => Math.hypot(city.center[0] - site.center[0], city.center[2] - site.center[2]))) * layout.geography!.metersPerUnit
    assert.ok(distance <= 15_000)
    const focus = campusFocus(layout, 'all', undefined, city.id)
    assert.deepEqual(focus.target, city.center)
    assert.ok(Number.isFinite(focus.distance) && focus.distance >= 70)
    assert.ok(Math.abs(city.center[0]) < layout.extent && Math.abs(city.center[2]) < layout.extent)
  }
  assert.equal(layout.assets.length, 1)
  assert.equal(layout.assets[0].locationId, 'yard')
})
test('offline city context never fabricates centers for unsupported regions or missing coordinates', () => {
  for (const accounts of [[], [homeAccount], [{ ...homeAccount, latitude: undefined }]]) {
    assert.deepEqual(buildGeographicCampus([], accounts).geography?.cities, [])
  }
  assert.equal(new Set(cityCenters.map(city => city.id)).size, cityCenters.length)
})
test('offline aerial terrain has deterministic, opaque, varied earth-toned pixels', () => {
  const raster = createTerrainRaster(64)
  assert.equal(raster.width, 64)
  assert.equal(raster.height, 64)
  assert.equal(raster.pixels.length, 64 * 64 * 4)
  assert.deepEqual(createTerrainRaster(64).pixels, raster.pixels)
  assert.notDeepEqual(createTerrainRaster(64, 74).pixels, raster.pixels)
  let green = 0, blue = 0
  const colors = new Set<string>()
  for (let i = 0; i < raster.pixels.length; i += 4) {
    assert.equal(raster.pixels[i + 3], 255)
    green += raster.pixels[i + 1]
    blue += raster.pixels[i + 2]
    colors.add(raster.pixels.slice(i, i + 3).join(','))
  }
  assert.ok(green > blue, 'earth/vegetation colors, not the old blue ground')
  assert.ok(colors.size > 100, 'fields, woodland, water and fine texture are not a flat fill')
})
test('offline terrain rejects invalid dimensions and seeds instead of silently falling back', () => {
  for (const size of [0, 15, 2049, 64.5, NaN, Infinity]) assert.throws(() => createTerrainRaster(size), RangeError)
  assert.throws(() => createTerrainRaster(32, Infinity), RangeError)
})
