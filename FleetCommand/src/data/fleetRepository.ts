import Assets from '../../generated/services/Msftmfm_assetsService'
import Rentals from '../../generated/services/Msftmfm_rentalagreementsService'
import Returns from '../../generated/services/Msftmfm_returnbookingsService'
import Orders from '../../generated/services/Msdyn_workordersService'
import PM from '../../generated/services/Msftmfm_pmschedulesService'
import Classes from '../../generated/services/Msftmfm_assetclassesService'
import CustomerAssets from '../../generated/services/Msdyn_customerassetsService'
import Disposals from '../../generated/services/Msftmfm_disposalalertsService'
import Sap from '../../generated/services/Msftmfm_sapmasterdatasService'
import Accounts from '../../generated/services/AccountsService'
import Contacts from '../../generated/services/ContactsService'
import Conditions from '../../generated/services/Msftmfm_conditionlogsService'
import PMOrders from '../../generated/services/Msftmfm_pmworkordersService'
import Locations from '../../generated/services/Msdyn_functionallocationsService'
import Currencies from '../../generated/services/TransactioncurrenciesService'
import { readAll } from './pagination'
import type { FleetSnapshot, ServiceOrder } from '../domain/fleet'

const active = { $filter: 'statecode eq 0' }
function byId<T>(rows: T[], key: (row: T) => string) {
  return new Map(rows.map(row => [key(row).toLowerCase(), row]))
}
function find<T>(map: Map<string, T>, id?: string) {
  return id ? map.get(id.toLowerCase()) : undefined
}
function same(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

let pending: Promise<FleetSnapshot> | undefined
export function loadFleet(): Promise<FleetSnapshot> {
  pending ??= fetchFleet().finally(() => { pending = undefined })
  return pending
}
function formatted(row: object, field: string): string | undefined {
  const value: unknown = Reflect.get(row, `${field}@OData.Community.Display.V1.FormattedValue`)
  return typeof value === 'string' ? value : undefined
}
async function fetchFleet(): Promise<FleetSnapshot> {
  const [assets, rentals, returns, orders, maintenance, classes, customerAssets, disposals,
    sap, accounts, contacts, conditions, pmOrders, locations, currencies] = await Promise.all([
    readAll('Asset Register', o => Assets.ListRecords({ ...active, ...o })),
    readAll('Rental Agreements', o => Rentals.ListRecords({ ...active, ...o })),
    readAll('Return Bookings', o => Returns.ListRecords({ ...active, ...o })),
    readAll('Work Orders', o => Orders.ListRecords({ ...active, ...o })),
    readAll('PM Schedules', o => PM.ListRecords({ ...active, ...o })),
    readAll('Asset Classes', o => Classes.ListRecords({ ...active, ...o })),
    readAll('Customer Assets', o => CustomerAssets.ListRecords({ ...active, ...o })),
    readAll('Disposal Alerts', o => Disposals.ListRecords({ ...active, ...o })),
    readAll('SAP Master Data', o => Sap.ListRecords({ ...active, ...o })),
    readAll('Accounts', o => Accounts.ListRecords({ ...o, $select: 'accountid,name,address1_line1,address1_line2,address1_line3,address1_city,address1_stateorprovince,address1_postalcode,address1_country,address1_latitude,address1_longitude' })),
    readAll('Contacts', o => Contacts.ListRecords({ ...o, $select: 'contactid,fullname,emailaddress1' })),
    readAll('Condition Logs', o => Conditions.ListRecords({ ...active, ...o })),
    readAll('PM Work Orders', o => PMOrders.ListRecords({ ...active, ...o })),
    readAll('Functional Locations', o => Locations.ListRecords({ ...active, ...o })),
    readAll('Currencies', o => Currencies.ListRecords({ ...o, $select: 'transactioncurrencyid,isocurrencycode' })),
  ])
  const classMap = byId(classes, c => c.msftmfm_assetclassid)
  const customerMap = byId(customerAssets, c => c.msdyn_customerassetid)
  const accountMap = byId(accounts, c => c.accountid)
  const contactMap = byId(contacts, c => c.contactid)
  const locationMap = byId(locations, c => c.msdyn_functionallocationid)
  const currencyMap = byId(currencies, c => c.transactioncurrencyid)
  const fleetAssets = assets.map(asset => {
    const id = asset.msftmfm_assetid
    const assetClass = find(classMap, asset._msftmfm_classcodeid_value)
    const customerAsset = find(customerMap, asset._msftmfm_fleetasset_value)
    const assetRentals = rentals.filter(r => same(r._msftmfm_assetid_value, id))
    const assetConditions = conditions.filter(c => same(c._msftmfm_assetid_value, id))
      .sort((a, b) => Date.parse(b.msftmfm_returntimestamp ?? b.createdon ?? '1970-01-01') -
        Date.parse(a.msftmfm_returntimestamp ?? a.createdon ?? '1970-01-01'))
    const condition = assetConditions[0]
    const sapRows = sap.filter(s => same(s._msftmfm_assetid_value, id))
      .sort((a, b) => Date.parse(b.modifiedon ?? '1970-01-01') - Date.parse(a.modifiedon ?? '1970-01-01'))
    const serviceOrders: ServiceOrder[] = orders.filter(o => same(o._msftmfm_assetid_value, id) ||
      same(o._msdyn_customerasset_value, asset._msftmfm_fleetasset_value)).map(o => ({
      id: o.msdyn_workorderid, number: o.msdyn_name, table: 'msdyn_workorder',
      status: o.msdyn_systemstatus,
      statusLabel: ({ 690970000: 'Unscheduled', 690970001: 'Scheduled', 690970002: 'In Progress',
        690970003: 'Completed', 690970004: 'Posted', 690970005: 'Canceled' })[o.msdyn_systemstatus] ?? 'Unknown',
      start: o.msdyn_timefrompromised ?? o.msdyn_datewindowstart,
      end: o.msdyn_timetopromised ?? o.msdyn_datewindowend,
      bay: o.msftmfm_bayassignment, summary: o.msdyn_workordersummary,
      priority: o.msdyn_priorityname,
    }))
    serviceOrders.push(...pmOrders.filter(o => same(o._msftmfm_assetid_value, id)).map(o => ({
      id: o.msftmfm_pmworkorderid, number: o.msftmfm_pmnumber ?? 'PM order', table: 'msftmfm_pmworkorder',
      status: o.msftmfm_status, statusLabel: o.msftmfm_statusname ??
        formatted(o, 'msftmfm_status') ?? `Unverified (${o.msftmfm_status ?? 'missing'})`,
      summary: o.msftmfm_pmchecklist,
    })))
    return {
      id, number: asset.msftmfm_assetnumber ?? 'Unnamed asset',
      name: customerAsset?.msdyn_name ?? asset.msftmfm_manufacturerproductnumber ?? assetClass?.msftmfm_classname ?? 'Equipment',
      className: assetClass?.msftmfm_classname ?? 'Unclassified', status: asset.msftmfm_status,
      hours: asset.msftmfm_lifetimecumulativehours,
      bookValue: asset.msftmfm_bookvalue, repairCost: asset.msftmfm_ytdrepaircost,
      purchasePrice: assetClass?.msftmfm_purchaseprice,
      currency: find(currencyMap, asset._transactioncurrencyid_value)?.isocurrencycode,
      serial: asset.msftmfm_manufacturerserialnumber, equipment: asset.msftmfm_sapequipmentnumber,
      fixedAsset: asset.msftmfm_sapfixedassetid,
      recordedLocation: find(locationMap, customerAsset?._msdyn_functionallocation_value)?.msdyn_name,
      sapLocation: sapRows[0]?.msftmfm_sapfunctionallocation,
      rentals: assetRentals.map(r => {
        const contact = find(contactMap, r._msftmfm_customercontactid_value)
        return { id: r.msftmfm_rentalagreementid, number: r.msftmfm_agreementnumber,
          status: r.msftmfm_status, start: r.msftmfm_rentalstartdate,
          end: r.msftmfm_scheduledreturndate, returned: r.msftmfm_actualreturndate,
          account: find(accountMap, r._msftmfm_customeraccountid_value)?.name,
          accountId: r._msftmfm_customeraccountid_value,
          contact: contact?.fullname, email: contact?.emailaddress1 }
      }),
      returns: returns.filter(b => assetRentals.some(r => same(r.msftmfm_rentalagreementid, b._msftmfm_rentalagreementid_value)))
        .map(b => ({ id: b.msftmfm_returnbookingid, number: b.msftmfm_bookingreference,
          rentalId: b._msftmfm_rentalagreementid_value, status: b.msftmfm_status, slot: b.msftmfm_requestedreturnslot })),
      orders: serviceOrders,
      maintenance: maintenance.filter(m => same(m._msftmfm_assetid_value, id)).map(m => ({
        status: m.msftmfm_compliancestatus, nextHours: m.msftmfm_nextduehours,
        interval: m.msftmfm_pmintervalhours, lastDate: m.msftmfm_lastservicedate,
      })),
      condition: { grade: condition ? condition.msftmfm_overallconditiongrade : asset.msftmfm_checkoutconditiongrade,
        date: condition?.msftmfm_returntimestamp, summary: condition?.msftmfm_aifusionsummary },
      disposals: disposals.filter(d => same(d._msftmfm_assetid_value, id)).map(d => ({
        id: d.msftmfm_disposalalertid, number: d.msftmfm_alertreference ?? 'Disposal review',
        status: d.msftmfm_status, repairPercent: d.msftmfm_repaircostpct, threshold: d.msftmfm_thresholdpct,
      })),
    }
  })
  return {
    assets: fleetAssets,
    accounts: accounts.map(account => ({
      id: account.accountid, name: account.name,
      address: [account.address1_line1, account.address1_line2, account.address1_line3,
        account.address1_city, account.address1_stateorprovince, account.address1_postalcode, account.address1_country]
        .filter(part => part?.trim()).join(', '),
      latitude: account.address1_latitude, longitude: account.address1_longitude,
    })),
  }
}
