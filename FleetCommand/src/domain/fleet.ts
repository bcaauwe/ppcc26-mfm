export type Signal = 'green' | 'amber' | 'red'
export type Zone = 'yard' | 'service' | 'customer'
export const statusLabels: Record<number, string> = {
  100000000: 'Available', 100000001: 'Service Hold', 100000002: 'Not Rentable',
  100000003: 'Pending Inspection', 100000004: 'Pending Fleet Reallocation',
  100000005: 'Relocation Recommended', 100000006: 'On Rent',
}
export type AssetStatusTone = 'green' | 'orange' | 'red' | 'amber' | 'purple' | 'teal' | 'blue' | 'neutral'
export type AssetStatusFilter = 'all' | 'unverified' | number
const statusTones: Record<number, AssetStatusTone> = {
  100000000: 'green', 100000001: 'orange', 100000002: 'red',
  100000003: 'amber', 100000004: 'purple', 100000005: 'teal', 100000006: 'blue',
}
export function assetStatusTone(status?: number): AssetStatusTone {
  return statusTones[status ?? -1] ?? 'neutral'
}
export function matchesAssetStatus(status: number | undefined, filter: AssetStatusFilter): boolean {
  return filter === 'all' || (filter === 'unverified' ? !statusLabels[status ?? -1] : status === filter)
}
export const signalLabels: Record<Signal, string> = {
  green: 'Good to go', amber: 'Needs attention', red: 'Cannot allocate now',
}
export interface Rental {
  id: string; number: string; status?: number; start?: string; end?: string
  returned?: string; account?: string; accountId?: string; contact?: string; email?: string
}
export interface FleetAccount {
  id: string; name: string; address: string; latitude?: number; longitude?: number
}
export interface FleetSnapshot {
  assets: FleetAsset[]
  accounts: FleetAccount[]
}
export interface ReturnBooking {
  id: string; number: string; rentalId?: string; status?: number; slot?: string
}
export interface ServiceOrder {
  id: string; number: string; table: string; status?: number; statusLabel: string
  start?: string; end?: string; bay?: string; summary?: string; priority?: string
}
export interface Maintenance {
  status?: number; nextHours?: number; interval?: number; lastDate?: string
}
export interface Condition {
  grade?: number; date?: string; summary?: string
}
export interface Disposal {
  id: string; number: string; status?: number; repairPercent?: number; threshold?: number
}
export interface FleetAsset {
  id: string; number: string; name: string; className: string; status?: number
  hours?: number; bookValue?: number; repairCost?: number; purchasePrice?: number
  currency?: string; serial?: string; equipment?: string; fixedAsset?: string
  recordedLocation?: string; sapLocation?: string
  rentals: Rental[]; returns: ReturnBooking[]; orders: ServiceOrder[]
  maintenance: Maintenance[]; condition?: Condition; disposals: Disposal[]
}
export interface Assessment {
  signal: Signal; reasons: string[]; zone: Zone; locationNote: string
  currentRentals: Rental[]; upcomingRentals: Rental[]; futureRentals: Rental[]; arrivals: ReturnBooking[]
  openOrders: ServiceOrder[]; nextAction: string; priority: number
}
export type RentalMilestone =
  | { kind: 'return'; rental?: Rental; booking?: ReturnBooking }
  | { kind: 'ready'; rental: Rental }

export function rentalMilestones(asset: FleetAsset, assessment: Assessment): RentalMilestone[] {
  if (assessment.zone === 'customer') {
    if (!assessment.currentRentals.length) return [{ kind: 'return' }]
    const milestones: RentalMilestone[] = []
    for (const rental of assessment.currentRentals) {
      const bookings = asset.returns.filter(b => b.rentalId?.toLowerCase() === rental.id.toLowerCase() &&
        (b.status === 100000000 || b.status === 100000001))
        .sort((a, b) => (dayNumber(a.slot) ?? Infinity) - (dayNumber(b.slot) ?? Infinity))
      if (!bookings.length) milestones.push({ kind: 'return', rental })
      for (const booking of bookings) milestones.push({ kind: 'return', rental, booking })
    }
    return milestones
  }
  const next = assessment.futureRentals[0]
  if (!next) return []
  return assessment.futureRentals.filter(r => dayNumber(r.start) === dayNumber(next.start))
    .map<RentalMilestone>(rental => ({ kind: 'ready', rental }))
}
export function currentCustomerLabel(rentals: readonly Rental[]): string {
  if (!rentals.length) return 'Current rental agreement not found'
  const accounts = new Map<string, string>()
  let missingAccount = false
  for (const rental of rentals) {
    const name = rental.account?.trim()
    if (!name) missingAccount = true
    else if (!accounts.has(name.toLowerCase())) accounts.set(name.toLowerCase(), name)
  }
  const names = [...accounts.values()]
  if (missingAccount) names.push('Account not recorded on current rental')
  return names.join(' / ')
}
const DAY = 86_400_000

export function dayNumber(value?: string): number | undefined {
  if (!value) return undefined
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  const time = Date.parse(date)
  return Number.isFinite(time) ? Math.floor(time / DAY) : undefined
}

export function isOpenOrder(order: ServiceOrder): boolean {
  if (order.table === 'msdyn_workorder') {
    return ![690970003, 690970004, 690970005].includes(order.status ?? -1)
  }
  // Legacy PM choices have no labels in this environment; don't guess their meaning.
  return !/^(completed|closed|cancelled|canceled)$/i.test(order.statusLabel)
}

export function isMaintenanceDue(pm: Maintenance, hours?: number): boolean {
  return pm.status === 100000002 ||
    (pm.nextHours !== undefined && hours !== undefined && hours >= pm.nextHours)
}

export function maintenanceAlert(asset: FleetAsset): { label: string; detail: string } | undefined {
  const due = asset.maintenance.filter(pm => isMaintenanceDue(pm, asset.hours))
  if (!due.length) return undefined
  const thresholds = due.flatMap(pm => pm.nextHours !== undefined && asset.hours !== undefined &&
    asset.hours >= pm.nextHours ? [pm.nextHours] : [])
  const nextHours = thresholds.length ? Math.min(...thresholds) : undefined
  const overdueHours = nextHours !== undefined && asset.hours !== undefined ? asset.hours - nextHours : undefined
  return {
    label: due.some(pm => pm.status === 100000002) || (overdueHours !== undefined && overdueHours > 0) ?
      'PM overdue' : 'PM due now',
    detail: overdueHours !== undefined && nextHours !== undefined ?
      `${overdueHours.toLocaleString()} hrs past due threshold (${nextHours.toLocaleString()} hrs)` :
      'Schedule marked overdue; meter-based overrun is unverified.',
  }
}

export function needsServiceReview(asset: FleetAsset, assessment: Assessment): boolean {
  if (asset.status === 100000006 || assessment.zone === 'customer') return false
  return assessment.openOrders.length > 0 || asset.maintenance.some(m => m.status !== 100000000) ||
    asset.status === 100000001 || asset.status === 100000002 || asset.status === 100000003 ||
    asset.condition?.grade === 100000003 || asset.maintenance.some(m => isMaintenanceDue(m, asset.hours))
}

export function assessAsset(asset: FleetAsset, now: Date, horizon: number): Assessment {
  const today = Math.floor(now.getTime() / DAY)
  const endWindow = today + horizon
  const reasons: string[] = []
  const levels: Signal[] = []
  const flag = (level: Signal, reason: string) => {
    levels.push(level)
    reasons.push(reason)
  }
  const arrivals = asset.returns.filter(b => b.status === 100000002 &&
    b.slot !== undefined && Date.parse(b.slot) <= now.getTime())
  const hasArrived = (id: string) => arrivals.some(b => b.rentalId === id)
  const liveRentals = asset.rentals.filter(r => r.status === 100000000 &&
    !(r.returned && (dayNumber(r.returned) ?? Infinity) <= today) && !hasArrived(r.id))
  const currentRentals = liveRentals.filter(r => (dayNumber(r.start) ?? -Infinity) <= today)
  const futureRentals = liveRentals.filter(r => {
    const start = dayNumber(r.start)
    return start !== undefined && start > today
  }).sort((a, b) => (dayNumber(a.start) ?? 0) - (dayNumber(b.start) ?? 0))
  const upcomingRentals = futureRentals.filter(r => (dayNumber(r.start) ?? Infinity) <= endWindow)
  const openOrders = asset.orders.filter(isOpenOrder)
  const blockingOrders = openOrders.filter(o => o.table === 'msdyn_workorder' &&
    (dayNumber(o.start) ?? -Infinity) <= today &&
    [690970000, 690970001, 690970002].includes(o.status ?? -1))
  const staleOnRent = asset.status === 100000006 && currentRentals.length === 0 &&
    (arrivals.length > 0 || asset.rentals.some(r =>
      r.status === 100000001 || (r.returned && (dayNumber(r.returned) ?? Infinity) <= today)))

  if (currentRentals.length || (asset.status === 100000006 && !staleOnRent)) {
    flag('red', 'On rent / committed to a customer; not available for allocation.')
  }
  if (staleOnRent) flag('amber', 'Return evidence exists but Asset Status is still On Rent. Reconcile before release.')
  if (asset.status === 100000001) flag('red', 'Service Hold: service release is required.')
  if (asset.status === 100000002) flag('red', 'Not Rentable: safety / service approval is required.')
  if (asset.status === 100000003) flag('amber', 'Pending inspection: condition has not been cleared.')
  if (asset.status === 100000004) flag('amber', 'Pending fleet reallocation: review the rental commitment.')
  if (asset.status === 100000005) flag('amber', 'Relocation recommended: confirm branch demand before allocating.')
  if (asset.status === undefined || !statusLabels[asset.status]) flag('amber', 'Asset Status is missing or unrecognized.')
  if (blockingOrders.length) flag('red', `${blockingOrders.length} open service order(s) block release.`)
  if (openOrders.some(o => o.table !== 'msdyn_workorder' ||
    ![690970000, 690970001, 690970002].includes(o.status ?? -1))) {
    flag('amber', 'An open maintenance order has an unverified status; Service must review.')
  }
  if (openOrders.some(o => {
    const start = dayNumber(o.start)
    return start !== undefined && start > today && start <= endWindow
  })) flag('amber', `Service is scheduled within the next ${horizon} days.`)

  if (!asset.maintenance.length) flag('amber', 'No active PM schedule found; maintenance clearance is unverified.')
  for (const pm of asset.maintenance) {
    if (isMaintenanceDue(pm, asset.hours)) {
      flag('red', 'Preventive maintenance is overdue / due at the current meter reading.')
    } else if (pm.status === 100000001) {
      flag('amber', 'Preventive maintenance is due soon.')
    } else if (pm.status !== 100000000) flag('amber', 'Maintenance compliance is unverified.')
    if (pm.nextHours === undefined || asset.hours === undefined) {
      flag('amber', 'PM threshold or asset meter reading is missing.')
    }
  }
  if (asset.condition?.grade === 100000003) flag('red', 'Condition is Unrentable; do not release.')
  else if (asset.condition?.grade === 100000002) flag('amber', 'Poor condition: service review is required.')
  else if (asset.condition?.grade === 100000001) flag('amber', 'Fair condition: verify suitability for the next job.')
  else if (asset.condition?.grade !== 100000000) flag('amber', 'Condition evidence is missing or unrecognized.')
  if (upcomingRentals.length) flag('amber', `${upcomingRentals.length} upcoming rental(s) within ${horizon} days.`)
  if (asset.rentals.some(r => ![100000000, 100000001, 100000002].includes(r.status ?? -1))) {
    flag('amber', 'A linked rental has an unrecognized status; confirm its commitment.')
  }
  if (asset.rentals.some(r => r.status === 100000001 && (dayNumber(r.returned) ?? -Infinity) > today)) {
    flag('amber', 'A Returned agreement has a future actual return date; reconcile the evidence.')
  }
  if (liveRentals.some(r => !r.start || !r.end)) flag('amber', 'An active rental is missing its start or scheduled return date.')
  if (currentRentals.some(r => (dayNumber(r.end) ?? Infinity) < today)) {
    flag('amber', 'Scheduled return is overdue; confirm the asset is physically back.')
  }
  const conflicts = liveRentals.some((a, i) => liveRentals.slice(i + 1).some(b => {
    const aStart = dayNumber(a.start), aEnd = dayNumber(a.end)
    const bStart = dayNumber(b.start), bEnd = dayNumber(b.end)
    return aStart !== undefined && bStart !== undefined &&
      Math.max(aStart, bStart) <= endWindow &&
      Math.min(aEnd ?? Infinity, bEnd ?? Infinity) >= today &&
      aStart <= (bEnd ?? Infinity) && bStart <= (aEnd ?? Infinity)
  }))
  if (conflicts) flag('amber', 'Rental dates overlap; review a substitute or schedule change.')
  if (upcomingRentals.some(r => openOrders.some(o =>
    (dayNumber(o.start) ?? -Infinity) <= (dayNumber(r.end) ?? Infinity) &&
    (dayNumber(o.end) ?? Infinity) >= (dayNumber(r.start) ?? Infinity)))) {
    flag('amber', 'A service window overlaps an upcoming rental; fleet reallocation needs review.')
  }
  const onCustomerSite = currentRentals.length > 0 || (asset.status === 100000006 && !staleOnRent)
  const zone: Zone = onCustomerSite ? 'customer' :
    (blockingOrders.length > 0 || asset.status === 100000001 || asset.status === 100000003) ? 'service' : 'yard'
  const locationNote = onCustomerSite ? 'Customer site inferred from rental evidence; not GPS.' :
    zone === 'service' ? 'Service workflow inferred from inspection / hold / work order; physical bay must be confirmed.' :
      'Yard location inferred from status / return evidence; physical presence is not confirmed.'
  const signal: Signal = levels.includes('red') ? 'red' : levels.includes('amber') ? 'amber' : 'green'
  const nextAction = reasons.some(r => r.includes('Unrentable') || r.includes('Not Rentable')) ?
    'Request safety / service release' :
    reasons.some(r => r.includes('overlap') || r.includes('reallocation')) ? 'Review rental / service conflict' :
    blockingOrders.length ? 'Coordinate service completion' :
    onCustomerSite ? 'Confirm return and next availability' :
    signal === 'amber' ? 'Review evidence before allocation' : 'Ready for rental office review'
  const priority = (signal === 'red' ? 30 : signal === 'amber' ? 20 : 0) +
    (conflicts ? 5 : 0) + (upcomingRentals.length && openOrders.length ? 8 : 0) +
    (asset.status === 100000002 || asset.condition?.grade === 100000003 ? 20 : 0)
  return { signal, reasons: [...new Set(reasons)], zone, locationNote, currentRentals,
    upcomingRentals, futureRentals, arrivals, openOrders, nextAction, priority }
}

export function summarizeMoney(assets: FleetAsset[], field: 'bookValue' | 'repairCost') {
  const groups = new Map<string, { total: number; count: number }>()
  for (const asset of assets) {
    const value = asset[field]
    if (value === undefined || !asset.currency) continue
    const group = groups.get(asset.currency) ?? { total: 0, count: 0 }
    groups.set(asset.currency, { total: group.total + value, count: group.count + 1 })
  }
  return [...groups].map(([currency, value]) => ({ currency, ...value }))
}
