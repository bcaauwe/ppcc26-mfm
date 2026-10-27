# Summit Fleet Command

Read-only Fleet Coordinator workspace for Summit Equipment, built with the
Microsoft Copilot Managed Runtime SDK, React, TypeScript and Vite.

## Environment

- Dataverse: https://ppcc27-mfm.crm.dynamics.com/
- Environment ID: `a8995412-eaba-ed8a-bb79-85561816011c`
- Managed app ID: `828dad2a-3185-4700-9fb1-b158918c6888`
- Source control: platform-managed Git.

## Develop and validate

```powershell
npm install
ms app dev
npm test
npm run lint
npm run build
```

Open the Local Play URL printed by `ms app dev`, in the tenant's browser profile.
Opening bare localhost does not establish the managed host connection.
Node.js >=24.11 is required, including for the native TypeScript unit tests.

## Workspace

The visual brand follows the supplied Summit Equipment logo: a black sidebar,
white wordmark with red mountain ridge, cool neutral surfaces and red interaction
accents. The source attachment is unchanged; the app uses a trimmed transparent
copy in `public/summit-logo.png`. Readiness green/amber/red retain their semantic
meaning and text labels independently of the brand color.
Readiness uses React Icons consistently: green circle check (Good to go), amber
warning triangle (Needs attention) and red circle X (Cannot allocate now).
Icons accompany text and are decorative to assistive technology; shape and
labels ensure readiness is not communicated by color alone.
The summary cards use equipment (Total fleet), circle check (Good to go),
corporate building (With customers) and wrench (Service review) React Icons.
Equipment images on the dashboard cards, miniature yard and dashboard asset dialog
are transparent PNG thumbnails rendered locally from the same detailed blue 3D
class models used by the map and inspector. Images are cached per equipment class,
not per record, with one temporary renderer per batch; its graphics resources are
released after rendering. The dashboard does not create a live canvas for every
asset. The model renderer loads asynchronously, while loading/unavailable-image
states are explicit. Classification is shared across all equipment surfaces;
unknown classes retain the neutral industrial model. Images represent equipment
classes, not actual asset photographs, manufacturer digital twins or condition evidence.

- **Fleet overview:** navigable campus illustration, fleet counts and review queue.
- **Rental Office:** upcoming agreement starts, return bookings and customer context.
- **The Yard:** assets labelled Yard with evidence-based readiness; locations
  remain inferred, not a verified physical headcount.
- **Service Center:** review queue for pending inspections, holds, maintenance and service conflicts.
  Equipment recorded as On Rent or inferred to be with a current customer is excluded,
  including from the shared service-review counts. Due/overdue PM remains a readiness
  blocker and appears as a wrench warning on equipment cards and in asset details
  (including the map inspector). The warning shows hours beyond the earliest due
  meter threshold when verifiable; an overdue schedule without supporting meter
  evidence is labelled explicitly rather than given an invented overrun.
- **Finance & resale:** recorded book values, YTD repairs, SAP identifiers and
  disposal alerts, grouped by currency. No invented depreciation or market valuation.
- **Visualize:** the upper-right React badge opens a lazy-loaded Three.js operations
  page (`#visualize`); **Dashboard** returns to the previous main workspace. Browser
  back/forward navigation is supported. Both pages share the same loaded records,
  planning clock, horizon, refresh/error handling and full asset-details dialog.
  The geographic 3D map loads account addresses and latitude/longitude in the same
  snapshot as the fleet. Every account with valid coordinates receives a geographic
  pin, including customers without current equipment. East is positive X and north
  is negative Z in a local equirectangular projection. The offline satellite-style
  ground uses deterministic, locally generated fields, woodland, a waterway, roads
  and built-up textures. It is explicitly **illustrative terrain, not actual aerial
  photography**: those features and urban footprints are not surveyed geography,
  actual streets or usable routes. A persistent offline/illustrative notice, rotating
  north indicator and ground distance scale distinguish presentation from evidence.
  Gold pins and outlined city names add geographic context using bundled public
  city-center coordinates, separately styled from Summit/customer pins. Nearby cities
  (within 15 km of a mapped account, at most eight) can be clicked or reached through
  **Locations**, which also exposes their coordinates. Coverage is central Ohio,
  not a worldwide gazetteer; no city is invented for locations outside that coverage.
  Overview framing includes the city context. City labels try alternate positions
  to avoid covering account labels; their pins/list entries remain available if crowded.
  The uniquely named Summit Equipment account anchors the rental office, yard and
  service center at one address, with enlarged illustrative internal offsets.
  A freestanding sign at the office uses the existing local Summit logo.
  Campuses and equipment are enlarged for visibility; only account pins and their
  relative distances use geographic scale. Recorded coordinates are not independently
  geocoded or verified, and addresses never leave the app for external geocoding.
  Current rental account IDs associate customer assets with sites, not display names,
  historical/future agreements or guessed addresses. Co-located accounts share a pin.
  Every asset appears once; missing/conflicting associations or an unavailable Summit
  location put affected assets in an explicitly non-geographic **Location unresolved**
  holding area. Accounts with missing/invalid coordinates remain listed with their
  addresses and mapping notices but receive no invented pin. Missing or ambiguous
  Summit accounts are reported instead of selecting an arbitrary home address.
  The rental office coordinates equipment rather than representing an inferred
  physical asset location.
  Service placement follows the inferred service zone, not the broader service-review queue.
  Company pins and area signs include total assigned asset counts in parentheses.
  Summit's company count combines its office, yard and service locations; co-located
  companies share a site total. Counts include assets dimmed by filters, while the
  visible-assets indicator reflects the active filters. Empty sites show `(0)`,
  and unresolved equipment is counted separately rather than assigned to a guessed company.
  Pending Inspection assets belong to Service rather than Yard, even without a work
  order. Current customer rental evidence still takes precedence; an inspection status
  does not prove that equipment has returned from a customer site.
  Blue equipment models, readiness rings and labels are illustrative. Generated
  class-specific models include excavators, mobile cranes, telehandlers, forklifts,
  loaders, rollers, scissor lifts and generators, with a neutral industrial model
  for unrecognized equipment. They include treaded tires / tracks, glass cabs,
  seats, mirrors, hydraulic cylinders, attachment details and differentiated rubber,
  paint and metal materials. These are representative models, not manufacturer
  digital twins or visual evidence of asset condition. Environment reflections and
  soft directional shadows are generated locally, with no external textures.
  Geometry is cached by class, batched by material and shared across instances.
  Model bounds are constrained to existing parking spaces; asset picking and
  map inspector details retain their original record associations.
  Click map pins or buildings to fly to a specific site or area; **Locations** opens
  an in-viewport address/coordinate list with keyboard navigation and mapping notices.
  Top-level location filter tiles remain omitted to leave more of the scene visible.
  Regional site labels stay readable at overview distances; equipment labels appear
  when closer to a site. Reset view restores the full map. Clicking
  equipment opens a slide-in inspector anchored to the right inside the map viewport,
  not a modal or a world-space billboard. Its dark navy surfaces, compact typography
  and blue accents match the 3D explorer. On wide screens the map reserves space
  beside the inspector; on narrow screens the panel stays contained within the map.
  The shared details retain every evidence section, linked record and internal scroll,
  with a sticky close header, wrapping long titles and no document-height expansion.
  A locally rendered Three.js preview uses the same equipment factory, materials
  and class mapping as the map and dashboard thumbnails. Drag
  to rotate, or use its labeled rotation buttons. The preview renders only on
  interaction/resize, and disposes its graphics resources when closed or changed.
  Models remain representative, not digital twins or evidence of recorded condition.
  Opening Locations or Assets & filters closes the inspector to avoid stacked drawers.
  Escape, Close or Done dismiss it and restore keyboard focus. Reduced-motion
  preferences disable the entry animation. Closing the panel
  preserves the current camera and filters. The main dashboard retains its modal.
  The visualization fills the remaining browser height beneath a compact heading,
  rather than imposing a minimum scene height that causes page scrolling.
  **Assets & filters** opens a floating navigator inside the viewport, with search,
  readiness/status filters, direct asset-panel access and separate focus controls.
  The navigator supports Escape to close and returns focus to its toggle.
  Without WebGL, the same inspector retains all details and explicitly reports
  unavailable map/preview graphics; it never substitutes a misleading image.
  There are no asset information panels below the scene; map context is available
  through the in-scene **About this map** disclosure.
  Drag to orbit, scroll/pinch to zoom, and use Reset view to restore the full campus.
  Full asset details retain all original rental, return, service and finance evidence.
  Equipment placement is rental/service inference, not GPS or evidence of a physical
  dispatch; site coordinates describe account addresses, not individual jobsite tracking.
  Animations are camera transitions and selection highlights, not actual dispatch
  events or record updates. Reduced-motion preferences disable animated transitions.
  The asset navigator and details remain accessible without WebGL; graphics failures
  are explicit. No external map, model, texture, or tracking service is used.

### Offline city-data attribution

The city-center subset in `src/domain/cityCenters.ts` contains 12 central Ohio
place-name/coordinate records extracted on 2026-10-22 from the
[GeoNames cities5000 gazetteer](https://download.geonames.org/export/dump/).
GeoNames data is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Names, IDs and latitude/longitude are retained; the application selects nearby
cities and projects coordinates into its local scene. Data is provided without
warranty and is not survey-grade. Attribution is also available in **About this map**.
The synthetic terrain is generated independently and does not derive land cover or
street geometry from GeoNames. The bundled facts require no runtime requests;
neither customer data nor map bounds are sent to an imagery/geocoding provider.

## Data presentation

- Asset details link to existing Dynamics records. The app does not create or
  update operational records, change work order priorities, or release equipment.
- Solid-color React Asset Status badges show the recorded status separately from
  calculated readiness: Available (green), Service Hold (orange), Not Rentable
  (red), Pending Inspection (amber), Pending Fleet Reallocation (purple),
  Relocation Recommended (teal), On Rent (blue), or unverified (gray).
- The Asset Status filter combines with search, area and readiness. Facet counts
  reflect the other active filters; switching areas or clearing filters resets it.
- User identity is supplied by the managed runtime header. The app sidebar has
  no placeholder coordinator profile or environment block. The app header shows
  breadcrumbs without a read-only workspace label; operational writes remain disabled.
- Assets inferred to be with a customer show the account name resolved through
  their current rental agreement on cards, in asset details and in the finance
  register. Historical, cancelled and future rentals do not supply this label.
  Multiple current accounts are listed; missing agreements/accounts are explicit.
- Other equipment cards show Summit Equipment in a company box. All company
  boxes, including customer accounts, use the recorded Asset Status badge palette
  for their accent and tinted background, not calculated readiness or company type.
  Unverified status uses neutral gray. Service assets retain their service-workflow
  label, and separate readiness indicators remain unchanged.
- Equipment cards share grid rows for headings, imagery, customer/company
  information, status, reasons and actions. Long names wrap without clipping or
  fixed heights, and neighboring card sections remain aligned.
- Cards, asset details and the finance register show rental timing. For equipment
  with customers, Expected return comes only from Pending / Confirmed Return
  Bookings linked to each current agreement, never the agreement's scheduled
  return date. Multiple bookings remain visible with separately labeled Rental
  agreement and Return booking references; missing agreements, bookings and dates
  are explicit. Ready-by references also label the agreement and customer.
- For equipment not with a customer, Ready by is the earliest future active
  agreement start, including commitments beyond the selected planning window and
  agreements tied for that date. Cancelled, returned and completed-arrival rentals
  are excluded. Readiness warnings still use the selected planning window, and
  expected dates never imply that a return or service clearance has occurred.

## Data

Generated Dataverse services connect Asset Register (`msftmfm_asset`) to Rental
Agreements, Return Bookings, Accounts, Contacts, Asset Classes, Customer Assets,
Functional Locations, Work Orders, PM Schedules, legacy PM Work Orders, Condition
Logs, SAP Master Data, Disposal Alerts and transaction currencies.

Asset, rental, return, service, PM and evidence records are filtered to active
table records. Accounts, contacts and currencies remain resolvable even if inactive.
All continuation pages are read. Any source failure blocks readiness display
rather than treating missing data as safe. No production data is bundled in source.

Use `ms app add data-source` / `ms app refresh data-source` to manage connectors
and generated code. Do not hand-edit `ms.config.json` or `generated/`.

## Readiness rules (first iteration)

These are conservative planning rules approved for this iteration, not a safety
certification or an automatic change to the Asset Status in Dataverse.

- **Green / good to go:** Available status, no current rental, no blocking service,
  current PM with a known threshold and meter, usable condition and no warning
  in the selected planning window.
- **Amber / needs attention:** missing or unrecognized evidence, inspections,
  fair/poor condition, due-soon PM, relocation/reallocation, upcoming rentals,
  future service, overlapping commitments or a stale On Rent status after return.
- **Red / cannot allocate now:** current rental, On Rent without a completed
  return, Service Hold, Not Rentable, Unrentable condition, blocking open Field
  Service work or PM due at / above the meter threshold.

The 7/14/30-day planning window changes warnings, not recorded statuses.
Date-only commitments are compared as UTC calendar days. A scheduled return or
Confirmed booking alone never proves arrival. Arrived bookings are considered
only when their recorded slot is in the past; actual returns dated in the future
do not release an asset today. On Rent with completed return evidence still
requires status reconciliation and cannot turn green automatically.

Some legacy PM choice labels are absent in the environment. Unmapped statuses
require review; numeric values are never guessed to mean completed.

Locations in the campus illustration are workflow inferences, not GPS or a
verified physical yard count. Recorded functional and SAP locations are displayed
separately. Service ranking is a proposed review order, not a write to priorities.
Data refresh is manual; the planning clock updates every minute.

## Preview

After validating locally, commit and push using standard Git, then run:

```powershell
ms app play --mode preview
ms app build-status
```

A push alone does not build or deploy. Preview triggers a platform build.
Live deployment is a separate, explicit `ms app deploy` action.
