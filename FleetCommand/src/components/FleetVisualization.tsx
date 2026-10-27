import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { FaArrowRight, FaCrosshairs, FaLocationDot, FaMagnifyingGlass, FaRotateLeft, FaXmark } from 'react-icons/fa6'
import { matchesAssetStatus, signalLabels, statusLabels } from '../domain/fleet'
import type { AssetStatusFilter, FleetAccount, Signal } from '../domain/fleet'
import { areaLabels, countLocationAssets } from '../domain/visualization'
import { buildGeographicCampus } from '../domain/geography'
import type { AssetView, CampusArea } from '../domain/visualization'
import FleetScene from './FleetScene'
import EquipmentPreview from './EquipmentPreview'
import './FleetVisualization.css'

export default function FleetVisualization({ views, accounts, horizon, Details }: {
  views: AssetView[]; accounts: FleetAccount[]; horizon: number; Details: ComponentType<{ view: AssetView; close: () => void; preview?: ReactNode }>
}) {
  const layout = useMemo(() => buildGeographicCampus(views, accounts), [views, accounts])
  const [area, setArea] = useState<CampusArea>('all')
  const [focused, setFocused] = useState<string>()
  const [locationId, setLocationId] = useState<string>()
  const [focusRevision, setFocusRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [readiness, setReadiness] = useState<Signal | 'all'>('all')
  const [status, setStatus] = useState<AssetStatusFilter>('all')
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [navigatorTab, setNavigatorTab] = useState<'assets' | 'locations'>('assets')
  const [detailId, setDetailId] = useState<string>()
  const detailsPanel = useRef<HTMLElement>(null)
  const navigatorButton = useRef<HTMLButtonElement>(null)
  const locationButton = useRef<HTMLButtonElement>(null)
  const selectArea = useCallback((next: CampusArea) => { setArea(next); setFocused(undefined); setLocationId(undefined); setDetailId(undefined); setFocusRevision(n => n + 1) }, [])
  const selectAsset = useCallback((id: string) => { setFocused(id); setLocationId(undefined); setDetailId(undefined); setFocusRevision(n => n + 1) }, [])
  const selectLocation = useCallback((id: string) => {
    setArea('all'); setFocused(undefined); setDetailId(undefined); setLocationId(id)
    setFocusRevision(n => n + 1); setNavigatorOpen(false)
  }, [])
  const showAsset = useCallback((id: string) => {
    selectAsset(id)
    setDetailId(id)
    setNavigatorOpen(false)
  }, [selectAsset])
  const matching = useMemo(() => views.filter(v => {
    const areaMatch = area === 'all' || area === 'rental' || v.assessment.zone === area
    const text = `${v.asset.number} ${v.asset.name} ${v.asset.className} ${v.asset.rentals.map(r => `${r.account ?? ''} ${r.contact ?? ''}`).join(' ')}`
    return areaMatch && text.toLowerCase().includes(query.toLowerCase()) &&
      (readiness === 'all' || v.assessment.signal === readiness) && matchesAssetStatus(v.asset.status, status)
  }), [views, area, query, readiness, status])
  const visibleIds = useMemo(() => new Set(matching.map(v => v.asset.id)), [matching])
  const activeId = focused && visibleIds.has(focused) ? focused : undefined
  const selected = views.find(v => v.asset.id === activeId)
  const detailView = matching.find(v => v.asset.id === detailId)
  const shownDetailId = detailView?.asset.id
  const selectedSite = layout.geography?.sites.find(site => site.id === locationId || site.locationIds.includes(locationId ?? ''))
  const selectedLocation = layout.locations.find(location => location.id === locationId)
  const selectedCity = layout.geography?.cities.find(city => city.id === locationId)
  const selectedPlaceLabel = selectedLocation ?
    `${selectedLocation.label} (${countLocationAssets(layout, [selectedLocation.id])})` :
    selectedSite ? `${selectedSite.summit ? 'Summit Equipment' : selectedSite.accounts.map(account => account.name).join(' / ')} (${countLocationAssets(layout, selectedSite.locationIds)})` : undefined
  const mapIssues = layout.geography?.issues ?? []
  useEffect(() => {
    if (shownDetailId) detailsPanel.current?.querySelector<HTMLButtonElement>('[aria-label="Close asset details"]')?.focus({ preventScroll: true })
  }, [shownDetailId])
  function reset() {
    selectArea('all')
    setQuery('')
    setReadiness('all')
    setStatus('all')
  }
  function closeNavigator() {
    setNavigatorOpen(false)
    const button = navigatorTab === 'locations' ? locationButton : navigatorButton
    button.current?.focus()
  }
  function openNavigator(tab: 'assets' | 'locations') {
    setDetailId(undefined)
    setNavigatorTab(tab)
    setNavigatorOpen(value => navigatorTab === tab ? !value : true)
  }
  const closeDetails = useCallback(() => {
    setDetailId(undefined)
    navigatorButton.current?.focus()
  }, [])
  useEffect(() => {
    if (!detailView) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detailView, closeDetails])
  return <section className="visual-workspace" aria-label="3D fleet operations">
    <div className={`visual-stage${detailView ? ' has-asset-panel' : ''}`}>
      <FleetScene layout={layout} area={area} focused={activeId} locationId={locationId} focusRevision={focusRevision} visibleIds={visibleIds} onAsset={showAsset} onArea={selectArea} onLocation={selectLocation} />
      {detailView && <aside ref={detailsPanel} className="map-asset-panel" aria-labelledby="asset-detail-title" key={detailView.asset.id}>
        <Details view={detailView} close={closeDetails} preview={<EquipmentPreview asset={detailView.asset} />} />
      </aside>}
      <div className="scene-toolbar">
        <div className="scene-heading"><span className="eyebrow">SUMMIT / GEOGRAPHIC OPERATIONS</span><h2>{selected ? selected.asset.number : selectedCity?.name ?? selectedPlaceLabel ?? areaLabels[area]}</h2>
          <span aria-live="polite">{matching.length} of {views.length} assets visible</span></div>
        <div className="scene-actions">
          <button ref={locationButton} className="scene-button" aria-expanded={navigatorOpen && navigatorTab === 'locations'} aria-controls="visual-asset-navigator"
            onClick={() => openNavigator('locations')}><FaLocationDot />Locations{mapIssues.length > 0 && <span className="map-alert" title="Mapping notices">!</span>}</button>
          <button ref={navigatorButton} className="scene-button" aria-expanded={navigatorOpen && navigatorTab === 'assets'} aria-controls="visual-asset-navigator"
          onClick={() => openNavigator('assets')}><FaMagnifyingGlass />Assets & filters</button>
          <button className="scene-button" onClick={reset}><FaRotateLeft />Reset view</button></div>
      </div>
      <section id="visual-asset-navigator" className="visual-roster panel" aria-labelledby="visual-roster-title" hidden={!navigatorOpen} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeNavigator() }
      }}>
        <div className="visual-roster-heading"><div><span className="eyebrow">EXPLORE THE FLEET</span><h3 id="visual-roster-title">{navigatorTab === 'locations' ? 'Locations' : 'Asset navigator'} <span className="inline-count">{navigatorTab === 'locations' ? accounts.length + (layout.geography?.cities.length ?? 0) : matching.length}</span></h3></div>
          <button className="icon-button" aria-label="Close navigator" onClick={closeNavigator}><FaXmark /></button></div>
        {navigatorTab === 'locations' ? <div className="visual-location-list">
          <p className="map-description">Recorded account coordinates. Campuses and equipment are enlarged, not to geographic scale.</p>
          {layout.geography?.sites.flatMap(site => site.accounts.map(account => <button className="visual-location" key={account.id} onClick={() => selectLocation(site.id)}>
            <span><strong>{account.name}</strong><small>{account.address || 'Street address not recorded'}</small>
              <small>{countLocationAssets(layout, site.locationIds)} assets at this site</small>
              <small>{site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}</small>
              {site.summit && account.name.trim().toLowerCase() === 'summit equipment' && <small>Rental Office / Yard / Service Center</small>}</span><FaArrowRight />
          </button>))}
          {layout.geography?.unmappedAccounts.map(account => <div className="visual-location unmapped" key={account.id}><span><strong>{account.name}</strong>
            <small>{account.address || 'Street address not recorded'}</small><small>Not plotted: missing or invalid coordinates</small></span></div>)}
          {!!layout.geography?.unresolvedAssets.length && <button className="visual-location" onClick={() => selectLocation('unlocated')}>
            <span><strong>Location unresolved</strong><small>{layout.geography.unresolvedAssets.length} assets / separate non-geographic holding area</small></span><FaArrowRight /></button>}
          <h4 className="city-context-heading">Nearby cities / geographic context</h4>
          <p className="map-description">Gold pins mark public city centers, not customer sites. Bundled context covers central Ohio.</p>
          {layout.geography?.cities.map(city => <button className="visual-location city-location" key={city.id} onClick={() => selectLocation(city.id)}>
            <span><strong>{city.name}, Ohio</strong><small>City center / {city.latitude.toFixed(5)}, {city.longitude.toFixed(5)}</small></span><FaLocationDot />
          </button>)}
          {!layout.geography?.cities.length && <p className="map-description">No bundled city centers are within 15 km of these mapped accounts.</p>}
          {mapIssues.length > 0 && <div className="map-issues" role="status"><strong>Mapping notices</strong><ul>{mapIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        </div> : <>
        <label className="search-box visual-search"><FaMagnifyingGlass /><input aria-label="Search 3D assets" placeholder="Asset, class, or customer..." value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="visual-filters"><label>Readiness<select value={readiness} onChange={e => setReadiness(e.target.value as Signal | 'all')}>
          <option value="all">All readiness</option>{Object.entries(signalLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Asset status<select value={status} onChange={e => setStatus(e.target.value === 'all' || e.target.value === 'unverified' ? e.target.value : Number(e.target.value))}>
            <option value="all">All statuses</option>{Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            <option value="unverified">Status unverified</option></select></label>
          <button className="text-button" onClick={reset}>Clear / reset</button></div>
        <div className="visual-asset-list">
          {matching.map(v => <div className={`visual-asset-row ${activeId === v.asset.id ? 'selected' : ''}`} key={v.asset.id}>
            <button className="visual-focus" onClick={() => showAsset(v.asset.id)} aria-label={`Open ${v.asset.number} asset details`}>
              <span><strong>{v.asset.number}</strong><small>{v.asset.name}</small>
                <small>{areaLabels[v.assessment.zone]} / {statusLabels[v.asset.status ?? -1] ?? 'Status unverified'}</small>
                <span className={`badge ${v.assessment.signal}`}>{signalLabels[v.assessment.signal]}</span></span><FaArrowRight /></button>
            <button className="icon-button" onClick={() => { selectAsset(v.asset.id); closeNavigator() }} aria-label={`Focus ${v.asset.number} in 3D`}><FaCrosshairs /></button>
          </div>)}
          {!matching.length && <div className="empty-state"><h3>{views.length ? 'No assets match these filters' : 'No active fleet assets'}</h3>
            <p>{views.length ? 'Clear the filters or explore another area.' : 'The connected Asset Register returned no active records.'}</p><button className="secondary-button" onClick={reset}>Reset view</button></div>}
        </div>
        </>}
      </section>
      {selectedSite && <section className="scene-site" aria-label="Selected location" aria-live="polite">
        {selectedSite.accounts.map(account => <div key={account.id}><strong>{account.name}</strong><address>{account.address || 'Street address not recorded'}</address></div>)}
        <small>{countLocationAssets(layout, selectedSite.locationIds)} assets at this site</small>
        <small>{selectedSite.latitude.toFixed(5)}, {selectedSite.longitude.toFixed(5)} / recorded account coordinates</small>
      </section>}
      {selectedCity && <section className="scene-site" aria-label="Selected city" aria-live="polite">
        <strong>{selectedCity.name}, Ohio</strong><p>Public city center / geographic context</p>
        <small>{selectedCity.latitude.toFixed(5)}, {selectedCity.longitude.toFixed(5)} / GeoNames</small>
      </section>}
      <div className="scene-legend" aria-label="Map and readiness legend">
        {(['green', 'amber', 'red'] as const).map(signal => <span key={signal}><i className={signal} />{signalLabels[signal]}</span>)}
        <span><FaLocationDot className="city-legend-pin" />City center</span>
      </div>
      <div className="scene-hint">Drag to orbit / Scroll or pinch to zoom / Click equipment for full asset details</div>
      <details className="visual-disclaimer"><summary>About this map</summary><p><strong>Recorded account locations, not live equipment tracking.</strong> Pins use account latitude/longitude with north pointing toward negative Z.
        The Rental Office, Yard, and Service Center share Summit Equipment&apos;s address. Site footprints are enlarged for visibility, with illustrative internal offsets.
        The offline satellite-style ground is procedurally generated, not aerial photography. Fields, woodland, water, roads and urban footprints are illustrative, not surveyed geography or routing data.
        Gold city pins use bundled public GeoNames city-center coordinates; nearby city context covers central Ohio, not every city worldwide.
        No external imagery, tile, tracking or geocoding service is contacted.
        Customer equipment is associated using current rental account IDs; service and yard placement remains inferred. Uncertain locations are explicitly separated.
        Counts in company and area labels show total assigned assets, including those dimmed by filters. Co-located companies share a site total.
        Camera animations do not move equipment or change records.
        Equipment models represent asset classes, not exact manufacturer models or recorded condition.
        Readiness uses a {horizon}-day planning horizon. The rental office coordinates all equipment.
        Use Locations or Assets & filters for keyboard navigation, search, or access without WebGL.</p>
        <p>City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>, central Ohio extract (2026-10-22), licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Coordinates were projected locally; terrain is independently generated.</p></details>
    </div>
  </section>
}
