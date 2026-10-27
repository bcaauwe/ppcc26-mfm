import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FaBuilding, FaCircleCheck, FaTriangleExclamation, FaCircleXmark, FaCube, FaTableCellsLarge, FaTractor, FaWrench } from 'react-icons/fa6'
import { loadFleet } from './data/fleetRepository'
import { assessAsset, assetStatusTone, currentCustomerLabel, maintenanceAlert, matchesAssetStatus, needsServiceReview, rentalMilestones, signalLabels, statusLabels, summarizeMoney } from './domain/fleet'
import type { Assessment, AssetStatusFilter, FleetAccount, FleetAsset, Signal } from './domain/fleet'
import Equipment from './components/EquipmentImage'
import './App.css'

const FleetVisualization = lazy(() => import('./components/FleetVisualization'))
type Place = 'overview' | 'rental' | 'yard' | 'service' | 'finance'
type AssetView = { asset: FleetAsset; assessment: Assessment }
const places: { id: Place; label: string; icon: string; subtitle: string }[] = [
  { id: 'overview', label: 'Fleet overview', icon: 'grid', subtitle: 'The whole operation. One clear picture.' },
  { id: 'rental', label: 'Rental Office', icon: 'office', subtitle: 'Connect customer commitments to fleet readiness.' },
  { id: 'yard', label: 'The Yard', icon: 'yard', subtitle: 'Know what can go out. Know what needs a second look.' },
  { id: 'service', label: 'Service Center', icon: 'tool', subtitle: 'Put the right equipment at the front of the queue.' },
  { id: 'finance', label: 'Finance & resale', icon: 'chart', subtitle: 'Bring asset value and repair exposure into the conversation.' },
]
const zoneLabels = { yard: 'Yard', service: 'Service workflow', customer: 'With customer' }
const bookingLabels: Record<number, string> = {
  100000000: 'Pending', 100000001: 'Confirmed', 100000002: 'Arrived', 100000003: 'Cancelled',
}
const rentalLabels: Record<number, string> = {
  100000000: 'Active', 100000001: 'Returned', 100000002: 'Cancelled',
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    office: 'M4 21V5l8-3 8 3v16 M9 21v-5h6v5 M8 7h1 M15 7h1 M8 11h1 M15 11h1',
    yard: 'M2 20h20 M4 20V9l8-6 8 6v11 M8 20v-7h8v7 M2 9h20',
    tool: 'M14 6a6 6 0 0 0-7 7L2 18l4 4 5-5a6 6 0 0 0 7-7l-4 4-4-4z',
    chart: 'M4 3v18h18 M8 16l4-5 4 2 5-8',
    search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow: 'M4 12h16 M14 6l6 6-6 6',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M20 12a8 8 0 0 0-14-5 M4 12a8 8 0 0 0 14 5',
    close: 'M6 6l12 12 M6 18 18 6',
    external: 'M14 3h7v7 M10 14 21 3 M10 3H3v18h18v-7',
    clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    pin: 'M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0 M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    check: 'M5 12l4 4L19 6',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name] ?? paths.grid} />
  </svg>
}
const readinessIcons = { green: FaCircleCheck, amber: FaTriangleExclamation, red: FaCircleXmark }
function ReadinessIcon({ signal, size = 16 }: { signal: Signal; size?: number }) {
  const StatusIcon = readinessIcons[signal]
  return <StatusIcon className={`readiness-icon ${signal}`} size={size} aria-hidden="true" focusable="false" />
}
function Badge({ signal }: { signal: Signal }) {
  return <span className={`badge ${signal}`}><ReadinessIcon signal={signal} />{signalLabels[signal]}</span>
}
function AssetStatusBadge({ status }: { status?: number }) {
  return <span className={`asset-status-badge status-${assetStatusTone(status)}`} title="Recorded asset status, separate from calculated readiness">
    <span className="sr-only">Asset status: </span>{statusLabels[status ?? -1] ?? 'Status unverified'}
  </span>
}
function MaintenanceAlert({ asset }: { asset: FleetAsset }) {
  const alert = maintenanceAlert(asset)
  if (!alert) return null
  return <span className="maintenance-alert"><FaWrench aria-hidden="true" focusable="false" />
    <span><strong>{alert.label}</strong><small>{alert.detail}</small></span></span>
}
function date(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}
function RentalTiming({ asset, assessment }: AssetView) {
  const milestones = rentalMilestones(asset, assessment)
  if (!milestones.length) return null
  return <dl className="rental-timing">{milestones.map(m => {
    const value = m.kind === 'return' ? m.booking?.slot : m.rental.start
    const missing = m.kind === 'return' && !m.rental ? 'Agreement not found' :
      m.kind === 'return' && !m.booking ? 'Not booked' : 'Date not recorded'
    return <div key={`${m.rental?.id ?? 'missing'}-${m.kind === 'return' ? m.booking?.id ?? 'missing' : 'ready'}`}>
      <dt>{m.kind === 'return' ? 'Expected return' : 'Ready by'}</dt>
      <dd><strong>{value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{date(value)}</time> : missing}</strong>
        {m.rental && <small>Rental agreement: {m.rental.number}</small>}
        {m.kind === 'return' && m.booking && <small>Return booking: {m.booking.number}</small>}
        {m.kind === 'ready' && m.rental.account && <small>Customer: {m.rental.account}</small>}</dd>
    </div>
  })}</dl>
}
function money(value?: number, currency?: string) {
  if (value === undefined) return 'Not recorded'
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return `${value.toLocaleString()} (currency unverified)`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}
function recordUrl(table: string, id: string) {
  return `https://ppcc27-mfm.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`
}
function RecordLink({ table, id, children }: { table: string; id: string; children: React.ReactNode }) {
  return <a className="record-link" href={recordUrl(table, id)} target="_blank" rel="noreferrer">{children}<Icon name="external" size={13} /></a>
}

function Campus({ views, serviceCount, go }: { views: AssetView[]; serviceCount: number; go: (place: Place) => void }) {
  const yard = views.filter(v => v.assessment.zone === 'yard')
  const customer = views.filter(v => v.assessment.zone === 'customer')
  return <section className="campus panel" aria-labelledby="campus-title">
    <div className="section-heading"><div><span className="eyebrow">YOUR OPERATION, CONNECTED</span>
      <h2 id="campus-title">A walk around Summit</h2></div></div>
    <div className="site-map">
      <div className="map-grid" />
      <div className="road horizontal"><span>ASSET FLOW</span><Icon name="arrow" size={32} /></div>
      <button className="map-place office" onClick={() => go('rental')}>
        <div className="office-building"><div className="building-sign">SUMMIT <span>RENTALS</span></div>
          <div className="windows"><i /><i /><i /><i /></div><div className="door" /></div>
        <div className="map-caption"><span className="map-number">01</span><div><strong>Rental Office</strong>
          <small>{customer.length} assets with customers</small></div><Icon name="arrow" size={16} /></div>
      </button>
      <button className="map-place yard" onClick={() => go('yard')}>
        <div className="yard-lot"><div className="lot-label">EQUIPMENT YARD</div>
          <div className="mini-assets">{yard.slice(0, 3).map(v => <span key={v.asset.id}>
            <Equipment asset={v.asset} small /><span className="map-light"><ReadinessIcon signal={v.assessment.signal} size={13} /></span></span>)}</div>
          {!yard.length && <div className="map-empty">No assets in yard</div>}
          <div className="yard-stripes" /></div>
        <div className="map-caption"><span className="map-number">02</span><div><strong>The Yard</strong>
          <small>{yard.length} in yard · {yard.filter(v => v.assessment.signal === 'green').length} ready</small></div>
          <Icon name="arrow" size={16} /></div>
      </button>
      <button className="map-place service" onClick={() => go('service')}>
        <div className="service-building"><div className="service-roof">SUMMIT <span>SERVICE</span></div>
          <div className="service-doors"><i /><i /><i /></div><div className="service-apron" /></div>
        <div className="map-caption"><span className="map-number">03</span><div><strong>Service Center</strong>
          <small>{serviceCount} require service review</small></div><Icon name="arrow" size={16} /></div>
      </button>
    </div>
    <div className="map-footer"><Icon name="info" size={15} />
      Workflow illustration, not a live location map. Yard and service positions are inferred from records.</div>
  </section>
}

function AssetCard({ view, open }: { view: AssetView; open: () => void }) {
  const { asset, assessment } = view
  return <button className="asset-card" onClick={open} aria-label={`View ${asset.number}: ${signalLabels[assessment.signal]}`}>
    <div className="asset-card-top"><span className="asset-number">{asset.number}</span><span className={`small-signal ${assessment.signal}`}><ReadinessIcon signal={assessment.signal} />{signalLabels[assessment.signal]}</span></div>
    <div className="asset-picture"><Equipment asset={asset} /><span className="asset-class">{asset.className}</span></div>
    <div className="asset-card-body"><h3>{asset.name}</h3>
      <div className="asset-meta"><span><Icon name="pin" size={13} />{zoneLabels[assessment.zone]}</span>
        <span>{asset.hours?.toLocaleString() ?? '?'} hrs</span></div>
      <div className={`account-slot status-${assetStatusTone(asset.status)}`}>{assessment.zone === 'customer' ? <div className="asset-account customer-account"><span>Customer</span>
        <strong>{currentCustomerLabel(assessment.currentRentals)}</strong></div> :
        <div className="asset-account summit-account"><span>Company</span><strong>Summit Equipment</strong></div>}
        <RentalTiming asset={asset} assessment={assessment} /></div>
      <div className="asset-status"><AssetStatusBadge status={asset.status} /><MaintenanceAlert asset={asset} /></div>
      <p className="asset-reason">{assessment.reasons[0] ?? 'No rental, condition or maintenance blockers found.'}</p>
      <div className="asset-card-bottom"><span>{assessment.nextAction}</span><Icon name="arrow" size={16} /></div>
    </div>
  </button>
}

function AssetDetails({ view, close }: { view: AssetView; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className="asset-dialog" onClose={close} onClick={event => {
    if (event.target === ref.current) ref.current?.close()
  }} aria-labelledby="asset-detail-title">
    <AssetDetailsContent view={view} close={() => ref.current?.close()} />
  </dialog>
}

function AssetDetailsContent({ view, close, preview }: { view: AssetView; close: () => void; preview?: ReactNode }) {
  const { asset: a, assessment: s } = view
  return (
    <div className="dialog-content"><div className="dialog-top"><span className="eyebrow">{preview ? 'SUMMIT / ASSET INSPECTOR' : 'ASSET WORKSPACE'}</span>
      <button className="icon-button" onClick={close} aria-label="Close asset details"><Icon name="close" /></button></div>
      <div className="detail-hero"><div><span className="asset-number">{a.number}</span><h2 id="asset-detail-title">{a.name}</h2>
        <p>{a.className}</p><div className="detail-badges"><AssetStatusBadge status={a.status} /><Badge signal={s.signal} /></div></div>{!preview && <Equipment asset={a} />}</div>
      {preview}
      <MaintenanceAlert asset={a} />
      <div className={`readiness-box ${s.signal}`}><div className="readiness-title"><ReadinessIcon signal={s.signal} size={22} /><strong>{s.nextAction}</strong></div>
        <ul>{(s.reasons.length ? s.reasons : ['Available status, current PM, usable condition and no conflicting commitments found.']).map(r => <li key={r}>{r}</li>)}</ul></div>
      <section className="detail-section"><h3><Icon name="pin" />Location & identity</h3><p className="muted">{s.locationNote}</p>
        <dl className="detail-facts">
          {s.zone === 'customer' && <div><dt>Customer on current rental</dt><dd>{currentCustomerLabel(s.currentRentals)}</dd></div>}
          <div><dt>Recorded functional location</dt><dd>{a.recordedLocation ?? 'Not recorded'}</dd></div>
          <div><dt>SAP functional location</dt><dd>{a.sapLocation ?? 'Not recorded'}</dd></div>
          <div><dt>Serial number</dt><dd>{a.serial ?? 'Not recorded'}</dd></div><div><dt>Lifetime meter</dt><dd>{a.hours?.toLocaleString() ?? 'Not recorded'} hours</dd></div></dl>
      </section>
      <section className="detail-section"><h3><Icon name="office" />Rental agreements</h3>
        <RentalTiming asset={a} assessment={s} />
        {!a.rentals.length && <p className="muted">No linked active-table rental records.</p>}
        {a.rentals.map(r => <div className="linked-record" key={r.id}><div><RecordLink table="msftmfm_rentalagreement" id={r.id}>{r.number}</RecordLink>
          <p>{r.account ?? 'Account not recorded'} · {r.contact ?? 'Contact not recorded'}</p>
          {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}</div>
          <div className="record-right"><strong>{rentalLabels[r.status ?? -1] ?? 'Unverified'}</strong>
            <p>{date(r.start)} → {date(r.end)}</p>{r.returned && <small>Returned {date(r.returned)}</small>}</div></div>)}
      </section>
      <section className="detail-section"><h3><Icon name="yard" />Return bookings</h3>
        {!a.returns.length && <p className="muted">No linked return bookings. A scheduled return is not proof of arrival.</p>}
        {a.returns.map(b => <div className="linked-record" key={b.id}><RecordLink table="msftmfm_returnbooking" id={b.id}>{b.number}</RecordLink>
          <span>{bookingLabels[b.status ?? -1] ?? 'Unverified'} · {date(b.slot)}</span></div>)}
      </section>
      <section className="detail-section"><h3><Icon name="tool" />Service & maintenance</h3>
        {!a.orders.length && <p className="muted">No linked work orders.</p>}
        {a.orders.map(o => <div className="linked-record" key={o.id}><div><RecordLink table={o.table} id={o.id}>{o.number}</RecordLink>
          <p>{o.statusLabel} {o.bay && `· Bay ${o.bay}`} {o.priority && `· ${o.priority}`}</p>
          {o.summary && <p className="record-summary">{o.summary}</p>}</div>
          <div className="record-right"><span>{date(o.start)} → {date(o.end)}</span></div></div>)}
        {a.maintenance.map((pm, i) => <div className="linked-record" key={i}><div><strong>Preventive maintenance</strong>
          <p>Last service {date(pm.lastDate)} · interval {pm.interval ?? '?'} hours</p></div>
          <span>Next due: {pm.nextHours?.toLocaleString() ?? 'Unknown'} hours</span></div>)}
        {a.condition?.summary && <div className="condition-note"><strong>Latest recorded condition summary</strong><p>{a.condition.summary}</p>
          <small>Recorded {date(a.condition.date)}. Source evidence, not an automatic release approval.</small></div>}
      </section>
      <section className="detail-section"><h3><Icon name="chart" />Finance & resale context</h3>
        <dl className="detail-facts"><div><dt>Recorded book value</dt><dd>{money(a.bookValue, a.currency)}</dd></div>
          <div><dt>YTD repair cost</dt><dd>{money(a.repairCost, a.currency)}</dd></div>
          <div><dt>SAP fixed asset</dt><dd>{a.fixedAsset ?? 'Not recorded'}</dd></div><div><dt>SAP equipment</dt><dd>{a.equipment ?? 'Not recorded'}</dd></div></dl>
        {a.disposals.map(d => <div className="linked-record" key={d.id}><RecordLink table="msftmfm_disposalalert" id={d.id}>{d.number}</RecordLink>
          <span>Repair {d.repairPercent ?? '?'}% / threshold {d.threshold ?? '?'}%</span></div>)}
        <p className="muted">Book value is the recorded accounting value, not a resale estimate. Depreciation schedules and market valuations are not present in the connected tables; no resale recommendation is calculated.</p>
      </section>
      <div className="dialog-bottom"><RecordLink table="msftmfm_asset" id={a.id}>Open Asset Register in Dynamics</RecordLink>
        <button className="secondary-button" onClick={close}>Done</button></div>
    </div>
  )
}

function App() {
  const [visualizing, setVisualizing] = useState(() => window.location.hash === '#visualize')
  const [place, setPlace] = useState<Place>('overview')
  const [assets, setAssets] = useState<FleetAsset[]>([])
  const [accounts, setAccounts] = useState<FleetAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [loadedAt, setLoadedAt] = useState<Date>()
  const [clock, setClock] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Signal | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>('all')
  const [horizon, setHorizon] = useState(7)
  const [selected, setSelected] = useState<string>()
  useEffect(() => {
    let disposed = false
    loadFleet().then(rows => {
      if (!disposed) { setAssets(rows.assets); setAccounts(rows.accounts); setLoadedAt(new Date()); setClock(new Date()); setLoading(false) }
    }).catch((reason: unknown) => {
      if (!disposed) {
        console.error('Fleet data load failed', reason)
        setError(reason instanceof Error ? reason.message : String(reason))
        setLoading(false)
      }
    })
    return () => { disposed = true }
  }, [revision])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const onHashChange = () => setVisualizing(window.location.hash === '#visualize')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => {
    document.title = visualizing ? '3D Operations | Summit Fleet Command' : 'Summit Fleet Command'
  }, [visualizing])
  const refresh = () => { setLoading(true); setError(''); setRevision(n => n + 1) }
  const views = useMemo(() => assets.map(asset => ({ asset, assessment: assessAsset(asset, clock, horizon) })), [assets, clock, horizon])
  const clearFilters = () => { setFilter('all'); setStatusFilter('all'); setQuery('') }
  const go = (next: Place) => { setPlace(next); clearFilters(); if (visualizing) window.location.assign('#dashboard') }
  const currentPlace = places.find(p => p.id === place)!
  const serviceQueue = views.filter(v => needsServiceReview(v.asset, v.assessment))
    .sort((a, b) => b.assessment.priority - a.assessment.priority || a.asset.number.localeCompare(b.asset.number))
  const placeViews = place === 'yard' ? views.filter(v => v.assessment.zone === 'yard') :
    place === 'service' ? serviceQueue : views
  const searchedViews = placeViews.filter(v =>
    `${v.asset.number} ${v.asset.name} ${v.asset.className} ${v.asset.rentals.map(r => `${r.account} ${r.contact}`).join(' ')}`
      .toLowerCase().includes(query.toLowerCase()))
  const statusViews = searchedViews.filter(v => matchesAssetStatus(v.asset.status, statusFilter))
  const readinessViews = searchedViews.filter(v => filter === 'all' || v.assessment.signal === filter)
  const visible = statusViews.filter(v => filter === 'all' || v.assessment.signal === filter)
  const selectedView = views.find(v => v.asset.id === selected)
  const ready = views.filter(v => v.assessment.signal === 'green').length
  const attention = views.filter(v => v.assessment.signal !== 'green').sort((a, b) =>
    b.assessment.priority - a.assessment.priority || a.asset.number.localeCompare(b.asset.number))
  const returning = views.flatMap(v => v.asset.returns.filter(b =>
    (b.status === 100000000 || b.status === 100000001) && b.slot &&
    Date.parse(b.slot) >= clock.getTime() && Date.parse(b.slot) <= clock.getTime() + horizon * 86_400_000)
    .map(booking => ({ ...v, booking }))).sort((a, b) => Date.parse(a.booking.slot!) - Date.parse(b.booking.slot!))
  const upcoming = views.flatMap(v => v.assessment.upcomingRentals.map(rental => ({ ...v, rental })))
    .sort((a, b) => Date.parse(a.rental.start!) - Date.parse(b.rental.start!))
  const title = place === 'overview' ? 'Your fleet. In perspective.' : currentPlace.label
  const footerTime = loadedAt?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault()
      document.getElementById('main-content')?.focus()
    }}>Skip to fleet workspace</a>
    <aside className="sidebar"><div className="brand"><picture>
      <source media="(max-width: 950px)" srcSet="/favicon.svg" />
      <img src="/summit-logo.png" alt="Summit Equipment - Rentals, Service, Solutions" width="962" height="550" />
    </picture></div>
      <div className="workspace-tag">FLEET COMMAND</div>
      <nav aria-label="Fleet areas"><span className="nav-heading">WORKSPACE</span>{places.map(p =>
        <button key={p.id} aria-label={p.label} className={!visualizing && place === p.id ? 'nav-item active' : 'nav-item'} onClick={() => go(p.id)} aria-current={!visualizing && place === p.id ? 'page' : undefined}>
          <Icon name={p.icon} /><span>{p.label}</span>{p.id === 'service' && !loading && !error && <small>{serviceQueue.length}</small>}</button>)}</nav>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Summit Equipment <span>/</span> <strong>{visualizing ? '3D Operations' : currentPlace.label}</strong></div>
      <a className="visualize-badge" href={visualizing ? '#dashboard' : '#visualize'}>
        {visualizing ? <FaTableCellsLarge aria-hidden="true" /> : <FaCube aria-hidden="true" />}{visualizing ? 'Dashboard' : 'Visualize'}</a></header>
      <main id="main-content" className={visualizing ? 'visual-main' : undefined} tabIndex={-1}><div className="page-heading"><div><span className="eyebrow">SUMMIT EQUIPMENT / FLEET OPERATIONS</span>
        <h1>{visualizing ? 'Your fleet. A whole new dimension.' : title}</h1><p>{visualizing ? 'From the rental desk to the customer site. Explore your operation in 3D.' : currentPlace.subtitle}</p></div><div className="page-actions">
          <label className="horizon-label"><Icon name="clock" size={16} /><select aria-label="Planning window" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            {[7, 14, 30].map(n => <option key={n} value={n}>Next {n} days</option>)}</select></label>
          <button className="secondary-button" onClick={refresh} disabled={loading}><Icon name="refresh" size={16} />Refresh</button></div></div>
        {loading ? <section className="load-state panel" role="status"><div className="loader" /><h2>Connecting the operation</h2>
          <p>Loading Asset Register, rental commitments, return bookings, service and financial records from ppcc-mfm.</p></section> :
          error ? <section className="error-state panel" role="alert"><Icon name="info" size={32} /><h2>Fleet data could not be verified</h2>
            <p>Readiness is unavailable until all connected sources load successfully. No sample data or partial availability is being shown.</p>
            <pre>{error}</pre><button className="primary-button" onClick={refresh}>Retry data connection</button></section> : <>
            {visualizing ? <Suspense fallback={<section className="load-state panel" role="status"><div className="loader" /><h2>Preparing your 3D operation</h2></section>}>
              <FleetVisualization views={views} accounts={accounts} horizon={horizon} Details={AssetDetailsContent} />
              <footer className="workspace-footer"><span><span className="dot" />Live Dataverse records · refreshed {footerTime}</span>
                <span>Read-only · illustrative locations, not GPS</span></footer>
            </Suspense> : <>
            <section className="kpi-grid" aria-label="Fleet snapshot">
              {[{ title: 'Total fleet', value: assets.length, note: 'Active Asset Register records', color: 'neutral', icon: FaTractor, click: () => go('overview') },
                { title: 'Good to go', value: ready, note: 'Cleared by current evidence', color: 'green', icon: FaCircleCheck, click: () => { go('overview'); setFilter('green') } },
                { title: 'With customers', value: views.filter(v => v.assessment.zone === 'customer').length, note: 'Not available to allocate now', color: 'blue', icon: FaBuilding, click: () => go('rental') },
                { title: 'Service review', value: serviceQueue.length, note: 'Inspections, orders, holds or maintenance', color: 'amber', icon: FaWrench, click: () => go('service') }].map(k =>
                <button className={`kpi ${k.color}`} key={k.title} onClick={k.click}><div><k.icon className="kpi-icon" size={18} aria-hidden="true" focusable="false" />{k.title}<Icon name="arrow" size={16} /></div>
                  <strong>{k.value}</strong><small>{k.note}</small></button>)}
            </section>
            {place === 'overview' && <div className="overview-row"><Campus views={views} serviceCount={serviceQueue.length} go={go} />
              <section className="attention-panel panel"><div className="section-heading"><div><span className="eyebrow">FOCUS YOUR DAY</span><h2>Needs a closer look</h2></div>
                <span className="count-pill">{attention.length}</span></div><p className="section-description">Evidence-based review queue. No automatic changes.</p>
                <div className="attention-list">{attention.slice(0, 4).map(v => <button key={v.asset.id} className="attention-item" onClick={() => setSelected(v.asset.id)}>
                  <span className={`attention-icon ${v.assessment.signal}`}><ReadinessIcon signal={v.assessment.signal} size={18} /></span>
                  <div><strong>{v.asset.number}</strong><p>{v.assessment.nextAction}</p></div><Icon name="arrow" size={16} /></button>)}
                  {!attention.length && <div className="empty-small"><Icon name="check" /><p>No readiness concerns found.</p></div>}</div>
                <button className="text-button" onClick={() => { go('overview'); setFilter('amber') }}>Review amber assets <Icon name="arrow" size={16} /></button>
              </section></div>}
            {place === 'rental' && <section className="rental-panels">
              <div className="panel schedule-panel"><span className="eyebrow">COMING BACK</span><h2>Expected returns</h2>
                <p className="muted">Pending / confirmed bookings within {horizon} days. Not proof of arrival.</p>
                {returning.map(v => <button className="schedule-row" key={v.booking.id} onClick={() => setSelected(v.asset.id)}>
                  <span className="date-tile">{date(v.booking.slot)}</span><div><strong>{v.asset.number}</strong><p>{v.booking.number}</p></div>
                  <span>{bookingLabels[v.booking.status!]}</span><Icon name="arrow" size={16} /></button>)}
                {!returning.length && <p className="empty-small">No scheduled return bookings in this window.</p>}</div>
              <div className="panel schedule-panel"><span className="eyebrow">GOING OUT</span><h2>Upcoming commitments</h2>
                <p className="muted">Active agreements starting within {horizon} days.</p>
                {upcoming.map(v => <button className="schedule-row" key={v.rental.id} onClick={() => setSelected(v.asset.id)}>
                  <span className="date-tile">{date(v.rental.start)}</span><div><strong>{v.asset.number}</strong><p>{v.rental.account ?? v.rental.number}</p></div>
                  <Badge signal={v.assessment.signal} /><Icon name="arrow" size={16} /></button>)}
                {!upcoming.length && <p className="empty-small">No upcoming starts in this window.</p>}</div></section>}
            {place === 'yard' && <div className="context-banner"><Icon name="info" /><p><strong>Yard view, not a verified headcount.</strong> Assets without a current rental or service hold are grouped here.
              Confirm physical location and all readiness evidence before dispatch.</p></div>}
            {place === 'service' && <div className="context-banner"><Icon name="tool" /><p><strong>Service review order.</strong> Safety / unrentable conditions rank first, followed by blocking service and rental conflicts.
              On Rent equipment is excluded; PM warnings remain visible in the fleet and rental views.
              This is a proposed review queue; work order priorities are not changed.</p></div>}
            {place === 'finance' && <section className="panel finance-summary"><div><span className="eyebrow">ASSET ECONOMICS</span><h2>A better finance conversation</h2>
              <p>Recorded values, not estimated depreciation or market prices.</p></div>
              <div><small>Recorded book value</small>{summarizeMoney(assets, 'bookValue').map(g => <strong key={g.currency}>{money(g.total, g.currency)} <small>({g.count} assets)</small></strong>)}
                <span>{assets.filter(a => a.bookValue === undefined || !a.currency).length} assets with missing value / currency</span></div>
              <div><small>Recorded YTD repairs</small>{summarizeMoney(assets, 'repairCost').map(g => <strong key={g.currency}>{money(g.total, g.currency)} <small>({g.count} assets)</small></strong>)}
                <span>{assets.filter(a => a.repairCost === undefined || !a.currency).length} assets with missing cost / currency</span></div></section>}
            <section className="fleet-section" aria-labelledby="fleet-section-title"><div className="section-heading fleet-heading"><div><span className="eyebrow">{place === 'service' ? 'PRIORITIZE THE NEXT RELEASE' : 'FROM A BIRD’S-EYE VIEW TO THE DETAILS'}</span>
              <h2 id="fleet-section-title">{place === 'yard' ? 'In the yard' : place === 'service' ? 'Service review queue' : place === 'finance' ? 'Fleet value register' : 'Your equipment'} <span className="inline-count">{visible.length}</span></h2></div>
              <label className="search-box"><Icon name="search" size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search assets, class, customer…" aria-label="Search assets, class, or customer" /></label></div>
              <div className="filter-bar"><div className="filter-tabs" aria-label="Filter readiness">
                {(['all', 'green', 'amber', 'red'] as const).map(f => <button key={f} className={filter === f ? 'filter-tab selected' : 'filter-tab'}
                  onClick={() => setFilter(f)} aria-pressed={filter === f}>{f !== 'all' && <ReadinessIcon signal={f} size={14} />}{f === 'all' ? 'All equipment' : signalLabels[f]}
                  <span>{f === 'all' ? statusViews.length : statusViews.filter(v => v.assessment.signal === f).length}</span></button>)}</div>
                <div className="filter-options"><label className="status-filter">Asset status
                  <select aria-label="Filter by asset status" value={statusFilter} onChange={e =>
                    setStatusFilter(e.target.value === 'all' || e.target.value === 'unverified' ? e.target.value : Number(e.target.value))}>
                    <option value="all">All statuses ({readinessViews.length})</option>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>
                      {label} ({readinessViews.filter(v => matchesAssetStatus(v.asset.status, Number(value))).length})
                    </option>)}
                    <option value="unverified">Status unverified ({readinessViews.filter(v => matchesAssetStatus(v.asset.status, 'unverified')).length})</option>
                  </select>
                </label><span className="window-note">Readiness now · {horizon}-day lookahead</span></div></div>
              {place === 'finance' ? <div className="table-wrap panel"><table><thead><tr><th>Asset</th><th>Asset status</th><th>Readiness</th><th>Book value</th><th>YTD repairs</th><th>Disposal review</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
                {visible.map(v => <tr key={v.asset.id}><td><strong>{v.asset.number}</strong><small>{v.asset.name}</small>
                  {v.assessment.zone === 'customer' && <small className="table-customer">Customer: {currentCustomerLabel(v.assessment.currentRentals)}</small>}
                  <RentalTiming asset={v.asset} assessment={v.assessment} /></td>
                  <td><AssetStatusBadge status={v.asset.status} /></td><td><Badge signal={v.assessment.signal} /></td>
                  <td>{money(v.asset.bookValue, v.asset.currency)}</td><td>{money(v.asset.repairCost, v.asset.currency)}</td>
                  <td>{v.asset.disposals.filter(d => d.status !== 100000003).length} non-closed alerts</td>
                  <td><button className="text-button" onClick={() => setSelected(v.asset.id)} aria-label={`View ${v.asset.number} finance details`}>View <Icon name="arrow" size={15} /></button></td></tr>)}
              </tbody></table></div> : <div className="asset-grid">{visible.map(v => <AssetCard key={v.asset.id} view={v} open={() => setSelected(v.asset.id)} />)}</div>}
              {!visible.length && <div className="empty-state panel"><Icon name="search" size={30} /><h3>No equipment matches this view</h3><p>Try a different search, asset status or readiness filter.</p>
                <button className="secondary-button" onClick={clearFilters}>Clear filters</button></div>}
            </section>
            <footer className="workspace-footer"><span><span className="dot" />Live Dataverse records · refreshed {footerTime}</span>
              <span>Read-only · no operational records changed</span></footer></>}
          </>}
      </main>
    </div>
    {selectedView && <AssetDetails key={selectedView.asset.id} view={selectedView} close={() => setSelected(undefined)} />}
  </div>
}

export default App
