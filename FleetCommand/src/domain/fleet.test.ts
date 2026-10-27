import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessAsset, assetStatusTone, currentCustomerLabel, dayNumber, maintenanceAlert, matchesAssetStatus, needsServiceReview, rentalMilestones, statusLabels, summarizeMoney } from './fleet.ts'
import type { FleetAsset, Rental, ServiceOrder } from './fleet.ts'

test('every recorded asset status has a distinctive badge tone; unknown values stay neutral', () => {
  const tones = ['green', 'orange', 'red', 'amber', 'purple', 'teal', 'blue']
  Object.keys(statusLabels).forEach((status, index) => {
    assert.equal(assetStatusTone(Number(status)), tones[index])
  })
  assert.equal(assetStatusTone(undefined), 'neutral')
  assert.equal(assetStatusTone(999), 'neutral')
})
test('asset status filters match exact recorded values, all records, or unverified values', () => {
  for (const status of Object.keys(statusLabels).map(Number)) {
    assert.ok(matchesAssetStatus(status, status))
    assert.ok(matchesAssetStatus(status, 'all'))
    assert.ok(!matchesAssetStatus(status, 'unverified'))
    assert.ok(!matchesAssetStatus(status, 999))
  }
  assert.ok(matchesAssetStatus(undefined, 'all'))
  assert.ok(matchesAssetStatus(undefined, 'unverified'))
  assert.ok(matchesAssetStatus(999, 'unverified'))
  assert.ok(!matchesAssetStatus(undefined, 100000000))
  assert.ok(!matchesAssetStatus(100000006, 100000000))
})

const now = new Date('2026-10-21T12:00:00Z')
function asset(overrides: Partial<FleetAsset> = {}): FleetAsset {
  return { id: 'a', number: 'TH-1', name: 'Telehandler', className: 'Telehandler',
    status: 100000000, hours: 100, rentals: [], returns: [], orders: [], disposals: [],
    maintenance: [{ status: 100000000, nextHours: 200 }], condition: { grade: 100000000 }, ...overrides }
}
function rental(overrides: Partial<Rental> = {}): Rental {
  return { id: 'r', number: 'RA-1', status: 100000000, start: '2026-10-20', end: '2026-10-25', ...overrides }
}
function order(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return { id: 'wo', number: 'WO-1', table: 'msdyn_workorder', status: 690970001, statusLabel: 'Scheduled', ...overrides }
}
test('expected returns use only pending or confirmed bookings for the current agreement', () => {
  const a = asset({ rentals: [rental(), rental({ id: 'future', start: '2026-11-01' }),
    rental({ id: 'old', status: 100000001 })], returns: [
    { id: 'later', number: 'B-2', rentalId: 'r', status: 100000000, slot: '2026-10-29' },
    { id: 'next', number: 'B-1', rentalId: 'R', status: 100000001, slot: '2026-10-23' },
    { id: 'cancelled', number: 'B-3', rentalId: 'r', status: 100000003, slot: '2026-10-22' },
    { id: 'unknown', number: 'B-4', rentalId: 'r', status: 999, slot: '2026-10-22' },
    { id: 'future', number: 'B-5', rentalId: 'future', status: 100000001, slot: '2026-11-02' },
    { id: 'old', number: 'B-6', rentalId: 'old', status: 100000001, slot: '2026-10-22' },
    { id: 'orphan', number: 'B-7', status: 100000001, slot: '2026-10-22' },
  ] })
  const assessment = assessAsset(a, now, 7)
  const milestones = rentalMilestones(a, assessment)
  assert.deepEqual(milestones.map(m => m.kind === 'return' && m.booking?.id), ['next', 'later'])
  assert.ok(milestones.every(m => m.rental?.id === 'r'))
  assert.equal(assessment.zone, 'customer')
  assert.equal(assessment.signal, 'red')
})
test('missing bookings never fall back to the agreement scheduled return date', () => {
  const a = asset({ rentals: [rental()] })
  assert.deepEqual(rentalMilestones(a, assessAsset(a, now, 7)), [{ kind: 'return', rental: a.rentals[0] }])
})
test('on-rent equipment without a current agreement reports missing evidence, not a future ready date', () => {
  const a = asset({ status: 100000006, rentals: [rental({ start: '2026-11-01' })] })
  assert.deepEqual(rentalMilestones(a, assessAsset(a, now, 7)), [{ kind: 'return' }])
})
test('all current agreements remain represented, including missing or invalid booking dates', () => {
  const a = asset({ rentals: [rental(), rental({ id: 'second' }), rental({ id: 'third' })], returns: [
    { id: 'invalid', number: 'B-1', rentalId: 'r', status: 100000001, slot: 'invalid' },
    { id: 'missing-date', number: 'B-2', rentalId: 'second', status: 100000000 },
  ] })
  const milestones = rentalMilestones(a, assessAsset(a, now, 7))
  assert.deepEqual(milestones.map(m => [m.rental?.id, m.kind === 'return' && m.booking?.id]),
    [['r', 'invalid'], ['second', 'missing-date'], ['third', undefined]])
})
test('overdue pending bookings remain visible and never prove the asset has returned', () => {
  const a = asset({ rentals: [rental()], returns: [
    { id: 'b', number: 'B-1', rentalId: 'r', status: 100000001, slot: '2026-10-19' },
  ] })
  const assessment = assessAsset(a, now, 7)
  assert.equal(assessment.zone, 'customer')
  assert.equal(assessment.signal, 'red')
  assert.deepEqual(rentalMilestones(a, assessment), [{ kind: 'return', rental: a.rentals[0], booking: a.returns[0] }])
})
test('ready-by uses the earliest active future start independently of the readiness horizon', () => {
  const a = asset({ rentals: [
    rental({ id: 'later', start: '2026-12-01', end: '2026-12-10' }),
    rental({ id: 'next', start: '2026-11-15', end: '2026-11-20' }),
    rental({ id: 'cancelled', status: 100000002, start: '2026-10-22' }),
    rental({ id: 'returned', status: 100000001, start: '2026-10-23' }),
    rental({ id: 'actual-return', returned: '2026-10-20', start: '2026-10-24' }),
    rental({ id: 'arrived', start: '2026-10-25' }),
  ], returns: [{ id: 'b', number: 'B-1', rentalId: 'arrived', status: 100000002, slot: '2026-10-21T09:00:00Z' }] })
  for (const horizon of [7, 14, 30]) {
    const assessment = assessAsset(a, now, horizon)
    assert.deepEqual(rentalMilestones(a, assessment), [{ kind: 'ready', rental: a.rentals[1] }])
    assert.equal(assessment.upcomingRentals.length, horizon === 30 ? 1 : 0)
    assert.equal(assessment.signal, horizon === 30 ? 'amber' : 'green')
  }
})
test('ready-by includes tied earliest agreements using UTC calendar days', () => {
  const a = asset({ rentals: [
    rental({ id: 'one', start: '2026-11-15' }),
    rental({ id: 'two', start: '2026-11-16T00:30:00+02:00' }),
    rental({ id: 'later', start: '2026-11-17' }),
  ] })
  assert.deepEqual(rentalMilestones(a, assessAsset(a, now, 7)).map(m => m.rental?.id), ['one', 'two'])
})
test('service assets can have ready-by commitments without becoming cleared for rental', () => {
  const a = asset({ status: 100000001, rentals: [rental({ start: '2026-11-15' })] })
  const assessment = assessAsset(a, now, 7)
  assert.equal(assessment.zone, 'service')
  assert.equal(assessment.signal, 'red')
  assert.deepEqual(rentalMilestones(a, assessment), [{ kind: 'ready', rental: a.rentals[0] }])
})
test('equipment without future commitments has no invented ready-by date', () => {
  const a = asset()
  assert.deepEqual(rentalMilestones(a, assessAsset(a, now, 7)), [])
})
test('green requires available status and complete usable maintenance and condition evidence', () => {
  const result = assessAsset(asset(), now, 7)
  assert.equal(result.signal, 'green')
  assert.equal(result.zone, 'yard')
  assert.match(result.locationNote, /not confirmed/)
})
test('on rent is unavailable, not automatically broken', () => {
  const result = assessAsset(asset({ status: 100000006 }), now, 7)
  assert.equal(result.signal, 'red')
  assert.equal(result.zone, 'customer')
  assert.match(result.nextAction, /return/)
})
test('an active agreement overrides Available status even after the scheduled return', () => {
  const result = assessAsset(asset({ rentals: [rental({ end: '2026-10-19' })] }), now, 7)
  assert.equal(result.signal, 'red')
  assert.equal(result.zone, 'customer')
  assert.ok(result.reasons.some(r => r.includes('overdue')))
})
test('future rental is not a physical checkout and is amber within the planning window', () => {
  const a = asset({ rentals: [rental({ start: '2026-10-28', end: '2026-10-30' })] })
  assert.equal(assessAsset(a, now, 7).signal, 'amber')
  assert.equal(assessAsset(a, now, 7).zone, 'yard')
  assert.equal(assessAsset(a, now, 6).signal, 'green')
})
test('horizon is inclusive and cancelled or returned agreements do not reserve assets', () => {
  const a = asset({ rentals: [rental({ status: 100000002 }), rental({ id: 'r2', status: 100000001 })] })
  assert.equal(assessAsset(a, now, 7).signal, 'green')
})
test('confirmed return does not prove arrival', () => {
  const result = assessAsset(asset({ status: 100000006, rentals: [rental()],
    returns: [{ id: 'b', number: 'B-1', rentalId: 'r', status: 100000001, slot: '2026-10-21T09:00:00Z' }] }), now, 7)
  assert.equal(result.signal, 'red')
  assert.equal(result.zone, 'customer')
})
test('arrived return with stale On Rent status is amber, never automatically released', () => {
  const result = assessAsset(asset({ status: 100000006, rentals: [rental()],
    returns: [{ id: 'b', number: 'B-1', rentalId: 'r', status: 100000002, slot: '2026-10-21T09:00:00Z' }] }), now, 7)
  assert.equal(result.signal, 'amber')
  assert.equal(result.zone, 'yard')
  assert.ok(result.reasons.some(r => r.includes('Reconcile')))
})
test('a future arrival or future actual return cannot release an asset today', () => {
  const result = assessAsset(asset({ status: 100000006, rentals: [rental({ returned: '2026-10-22' })],
    returns: [{ id: 'b', number: 'B-1', rentalId: 'r', status: 100000002, slot: '2026-10-22T09:00:00Z' }] }), now, 7)
  assert.equal(result.signal, 'red')
})
test('a recorded actual return clears a stale active rental but not stale asset status', () => {
  const result = assessAsset(asset({ status: 100000006, rentals: [rental({ returned: '2026-10-21' })] }), now, 7)
  assert.equal(result.signal, 'amber')
})
test('holds, not rentable and unrentable conditions block allocation', () => {
  for (const a of [asset({ status: 100000001 }), asset({ status: 100000002 }),
    asset({ condition: { grade: 100000003 } })]) assert.equal(assessAsset(a, now, 7).signal, 'red')
})
test('pending inspection places equipment in service without requiring a work order', () => {
  for (const rentals of [[], [rental({ start: '2026-11-01' })], [rental({ status: 100000001 })]]) {
    const result = assessAsset(asset({ status: 100000003, rentals }), now, 7)
    assert.equal(result.zone, 'service')
    assert.equal(result.signal, 'amber')
    assert.match(result.locationNote, /inspection/)
    assert.match(result.locationNote, /physical bay must be confirmed/)
    assert.ok(result.reasons.includes('Pending inspection: condition has not been cleared.'))
  }
  assert.equal(assessAsset(asset(), now, 7).zone, 'yard')
})
test('current customer rental evidence still takes precedence over pending inspection', () => {
  const result = assessAsset(asset({ status: 100000003, rentals: [rental()] }), now, 7)
  assert.equal(result.zone, 'customer')
  assert.equal(result.signal, 'red')
  assert.match(result.locationNote, /Customer site/)
})
test('a PM threshold equal to the meter is due even if compliance says Current', () => {
  assert.equal(assessAsset(asset({ hours: 200 }), now, 7).signal, 'red')
  assert.equal(assessAsset(asset({ hours: 201 }), now, 7).signal, 'red')
  assert.equal(assessAsset(asset({ hours: 199 }), now, 7).signal, 'green')
})
test('TH-4471 displays its PM overrun but stays out of Service Center while On Rent', () => {
  const a = asset({ number: 'TH-4471', status: 100000006, hours: 2636,
    rentals: [rental()], maintenance: [{ status: 100000002, nextHours: 2625 }] })
  const result = assessAsset(a, now, 7)
  assert.deepEqual(maintenanceAlert(a), { label: 'PM overdue', detail: '11 hrs past due threshold (2,625 hrs)' })
  assert.equal(needsServiceReview(a, result), false)
  assert.equal(result.zone, 'customer')
  assert.equal(result.signal, 'red')
  assert.ok(result.reasons.some(r => r.includes('Preventive maintenance is overdue')))
})
test('PM warnings handle meter thresholds, multiple schedules and missing evidence', () => {
  assert.equal(maintenanceAlert(asset()), undefined)
  assert.equal(maintenanceAlert(asset({ maintenance: [] })), undefined)
  assert.equal(maintenanceAlert(asset({ maintenance: [{ status: 100000001, nextHours: 200 }] })), undefined)
  assert.equal(maintenanceAlert(asset({ hours: 200 }))?.label, 'PM due now')
  assert.equal(maintenanceAlert(asset({ hours: 201 }))?.detail, '1 hrs past due threshold (200 hrs)')
  assert.equal(maintenanceAlert(asset({ hours: 250, maintenance: [
    { status: 100000000, nextHours: 225 }, { status: 100000000, nextHours: 200 },
  ] }))?.detail, '50 hrs past due threshold (200 hrs)')
  for (const a of [asset({ hours: undefined, maintenance: [{ status: 100000002, nextHours: 200 }] }),
    asset({ maintenance: [{ status: 100000002 }] }),
    asset({ maintenance: [{ status: 100000002, nextHours: 200 }] })]) {
    assert.deepEqual(maintenanceAlert(a), {
      label: 'PM overdue', detail: 'Schedule marked overdue; meter-based overrun is unverified.',
    })
  }
})
test('Service Center excludes rented assets even with open work or conflicting recorded status', () => {
  for (const a of [
    asset({ status: 100000006, orders: [order()] }),
    asset({ status: 100000001, rentals: [rental()], orders: [order()] }),
    asset({ status: 100000002, rentals: [rental()] }),
  ]) assert.equal(needsServiceReview(a, assessAsset(a, now, 7)), false)
})
test('Service Center retains non-rented service criteria and PM warnings after return', () => {
  for (const a of [
    asset({ status: 100000001 }), asset({ status: 100000002 }), asset({ status: 100000003 }),
    asset({ orders: [order()] }), asset({ condition: { grade: 100000003 } }),
    asset({ maintenance: [{ status: 100000001 }] }), asset({ maintenance: [{ status: undefined }] }),
    asset({ hours: 200 }), asset({ maintenance: [{ status: 100000002, nextHours: 200 }] }),
    asset({ hours: 201, rentals: [rental({ status: 100000001, returned: '2026-10-21' })] }),
  ]) assert.equal(needsServiceReview(a, assessAsset(a, now, 7)), true)
  assert.equal(needsServiceReview(asset(), assessAsset(asset(), now, 7)), false)
})
test('missing PM, condition, meter or status cannot turn green', () => {
  for (const a of [asset({ maintenance: [] }), asset({ condition: undefined }),
    asset({ hours: undefined }), asset({ status: undefined }),
    asset({ maintenance: [{ status: 100000000 }] })]) assert.equal(assessAsset(a, now, 7).signal, 'amber')
})
test('open work blocks now, future work warns, completed work does not block', () => {
  assert.equal(assessAsset(asset({ orders: [order()] }), now, 7).signal, 'red')
  assert.equal(assessAsset(asset({ orders: [order({ start: '2026-10-24' })] }), now, 7).signal, 'amber')
  for (const status of [690970003, 690970004, 690970005]) {
    assert.equal(assessAsset(asset({ orders: [order({ status })] }), now, 7).signal, 'green')
  }
})
test('legacy PM status without known labels requires review, not a fabricated mapping', () => {
  assert.equal(assessAsset(asset({ orders: [order({ table: 'msftmfm_pmworkorder', status: 100000002, statusLabel: '100000002' })] }), now, 7).signal, 'amber')
})
test('future service colliding with a rental is explained', () => {
  const result = assessAsset(asset({ rentals: [rental({ start: '2026-10-24', end: '2026-10-27' })],
    orders: [order({ start: '2026-10-23', end: '2026-10-25' })] }), now, 7)
  assert.ok(result.reasons.some(r => r.includes('overlaps an upcoming rental')))
})
test('overlapping active agreements are flagged, but historical overlaps are not', () => {
  const future = assessAsset(asset({ rentals: [rental({ start: '2026-10-23' }),
    rental({ id: 'r2', start: '2026-10-24' })] }), now, 7)
  assert.ok(future.reasons.some(r => r.includes('Rental dates overlap')))
  const past = assessAsset(asset({ rentals: [rental({ start: '2026-10-01', end: '2026-10-05' }),
    rental({ id: 'r2', start: '2026-10-02', end: '2026-10-06' })] }), now, 7)
  assert.ok(!past.reasons.some(r => r.includes('Rental dates overlap')))
})
test('safety signals are not downgraded by missing evidence', () => {
  assert.equal(assessAsset(asset({ status: 100000002, maintenance: [], condition: undefined }), now, 7).signal, 'red')
})
test('unknown rental status and conflicting future return evidence never produce green', () => {
  assert.equal(assessAsset(asset({ rentals: [rental({ status: undefined })] }), now, 7).signal, 'amber')
  assert.equal(assessAsset(asset({ rentals: [rental({ status: 100000001, returned: '2026-10-22' })] }), now, 7).signal, 'amber')
})
test('money is grouped by currency; missing values are not treated as zero', () => {
  const result = summarizeMoney([asset({ bookValue: 50, currency: 'USD' }), asset({ bookValue: 40, currency: 'CAD' }),
    asset({ bookValue: 0, currency: 'USD' }), asset({ bookValue: undefined, currency: 'USD' }),
    asset({ bookValue: 500 })], 'bookValue')
  assert.deepEqual(result, [{ currency: 'USD', total: 50, count: 2 }, { currency: 'CAD', total: 40, count: 1 }])
})
test('date-only calculations are UTC-stable and invalid dates stay unknown', () => {
  assert.equal(dayNumber('2026-10-21'), dayNumber('2026-10-21T23:59:00Z'))
  assert.equal(dayNumber('invalid'), undefined)
})
test('current customer labels exclude historical, cancelled and future agreements', () => {
  const result = assessAsset(asset({ rentals: [
    rental({ account: 'Summit Construction' }),
    rental({ id: 'old', status: 100000001, account: 'Historical Customer' }),
    rental({ id: 'cancelled', status: 100000002, account: 'Cancelled Customer' }),
    rental({ id: 'future', start: '2026-11-01', end: '2026-11-05', account: 'Future Customer' }),
  ] }), now, 7)
  assert.equal(currentCustomerLabel(result.currentRentals), 'Summit Construction')
})
test('current customer labels preserve multiple accounts and deduplicate account names', () => {
  assert.equal(currentCustomerLabel([
    rental({ account: ' Acme Construction ' }), rental({ id: 'r2', account: 'ACME CONSTRUCTION' }),
    rental({ id: 'r3', account: 'Northstar Rentals' }),
  ]), 'Acme Construction / Northstar Rentals')
})
test('missing current customer evidence is explicit, even alongside a known account', () => {
  assert.equal(currentCustomerLabel([]), 'Current rental agreement not found')
  assert.equal(currentCustomerLabel([rental()]), 'Account not recorded on current rental')
  assert.equal(currentCustomerLabel([rental({ account: 'Acme' }), rental({ id: 'r2', account: ' ' })]),
    'Acme / Account not recorded on current rental')
})
