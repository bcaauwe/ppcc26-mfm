import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createEquipmentLibrary } from './equipmentModels'
import { createTerrainCanvas } from './terrain'
import { campusFocus, countLocationAssets } from '../domain/visualization'
import type { CampusArea, CampusLayout, Point } from '../domain/visualization'

interface Props {
  layout: CampusLayout
  area: CampusArea
  focused?: string
  locationId?: string
  focusRevision: number
  visibleIds: ReadonlySet<string>
  onAsset: (id: string) => void
  onArea: (area: CampusArea) => void
  onLocation: (id: string) => void
}
interface SceneHandle {
  focus: (area: CampusArea, id?: string, locationId?: string) => void
  highlight: (ids: ReadonlySet<string>, focused?: string) => void
}
const areaColors = { rental: 0xd94850, yard: 0x6caa9c, service: 0xf1b656, customer: 0x759fe6, unlocated: 0xb69ad9 }
const readinessColors = { green: 0x48db9c, amber: 0xffc65c, red: 0xff7078 }

export default function FleetScene({ layout, area, focused, locationId, focusRevision, visibleIds, onAsset, onArea, onLocation }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<SceneHandle | null>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  useEffect(() => {
    const container = host.current!
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch (reason) {
      console.error('Fleet visualization could not initialize WebGL', reason)
      // WebGL is an external imperative resource; report synchronous creation failure to the accessible UI.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('3D rendering is unavailable in this browser. Enable WebGL / hardware acceleration, or open Assets & filters to access all fleet records.')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x101d2b)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    container.append(renderer.domElement)
    renderer.domElement.setAttribute('aria-label', 'Interactive geographic 3D fleet map. North is toward negative Z. Click site pins or buildings to explore. Use Locations and Assets & filters for keyboard access.')
    renderer.domElement.setAttribute('role', 'img')
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x101d2b, layout.extent * 2.5, layout.extent * 7)
    const environment = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environmentMap = pmrem.fromScene(environment, .04)
    scene.environment = environmentMap.texture
    scene.environmentIntensity = .55
    environment.dispose()
    pmrem.dispose()
    const equipmentLibrary = createEquipmentLibrary()
    const camera = new THREE.PerspectiveCamera(46, 1, .1, layout.extent * 12)
    let graphicsLost = false
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = .08
    controls.maxPolarAngle = Math.PI / 2.15
    controls.minDistance = 8
    controls.maxDistance = layout.extent * 5
    controls.enablePan = true
    scene.add(new THREE.HemisphereLight(0xd8eaff, 0x4c5953, 1.3))
    const sun = new THREE.DirectionalLight(0xffefdb, 3.2)
    sun.position.set(-30, 70, 25)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -layout.extent
    sun.shadow.camera.right = layout.extent
    sun.shadow.camera.top = layout.extent
    sun.shadow.camera.bottom = -layout.extent
    sun.shadow.camera.far = layout.extent * 6
    sun.shadow.normalBias = .035
    sun.shadow.bias = -.0002
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x7db4ff, .7)
    fill.position.set(40, 20, -40)
    scene.add(fill)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    const materialCache = new Map<number, THREE.MeshStandardMaterial>()
    function material(color: number) {
      let m = materialCache.get(color)
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .15 })
        materialCache.set(color, m)
        materials.add(m)
      }
      return m
    }
    const cube = new THREE.BoxGeometry(1, 1, 1)
    geometries.add(cube)
    function box(parent: THREE.Object3D, position: Point, size: Point, color: number) {
      const mesh = new THREE.Mesh(cube, material(color))
      mesh.position.set(...position)
      mesh.scale.set(...size)
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }
    function label(text: string, position: Point, width: number, accent = '#e9f1f8', regional = false, city = false, assetCount?: number) {
      const canvas = document.createElement('canvas')
      canvas.width = regional ? 512 : 768
      canvas.height = 112
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas text rendering is unavailable')
      if (!city) {
        ctx.fillStyle = '#142536'
        ctx.fillRect(0, 0, canvas.width, 112)
        ctx.fillStyle = accent
        ctx.fillRect(0, 0, 8, 112)
      }
      ctx.font = `600 ${regional ? 44 : 32}px Segoe UI, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const suffix = assetCount === undefined ? '' : ` (${assetCount})`
      const nameLength = 34 - suffix.length
      const display = (text.length > nameLength ? `${text.slice(0, Math.max(0, nameLength - 3))}...` : text) + suffix
      if (city) {
        ctx.strokeStyle = '#17251d'
        ctx.lineWidth = 10
        ctx.lineJoin = 'round'
        ctx.strokeText(display, canvas.width / 2, 56, canvas.width - 30)
      }
      ctx.fillStyle = city ? '#f4edcf' : accent
      ctx.fillText(display, canvas.width / 2, 56, canvas.width - 30)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      textures.add(texture)
      const m = new THREE.SpriteMaterial({ map: texture, depthTest: false })
      materials.add(m)
      const sprite = new THREE.Sprite(m)
      sprite.position.set(...position)
      sprite.scale.set(width, width * 112 / canvas.width, 1)
      scene.add(sprite)
      return sprite
    }
    if (layout.geography) {
      const terrainTexture = new THREE.CanvasTexture(createTerrainCanvas(layout))
      terrainTexture.colorSpace = THREE.SRGBColorSpace
      terrainTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      textures.add(terrainTexture)
      const terrainGeometry = new THREE.PlaneGeometry(layout.extent * 3, layout.extent * 3)
      const terrainMaterial = new THREE.MeshBasicMaterial({ map: terrainTexture, toneMapped: false })
      geometries.add(terrainGeometry)
      materials.add(terrainMaterial)
      const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial)
      terrain.rotation.x = -Math.PI / 2
      terrain.position.y = -.13
      scene.add(terrain)
    } else {
      box(scene, [0, -.65, 0], [layout.extent * 3, 1, layout.extent * 3], 0x1a2d38)
      const grid = new THREE.GridHelper(layout.extent * 3, 60, 0x304751, 0x263d48)
      grid.position.y = -.12
      scene.add(grid)
      geometries.add(grid.geometry)
      materials.add(grid.material)
    }
    const picks: THREE.Object3D[] = []
    const minX = Math.min(...layout.locations.map(l => l.center[0] - l.width / 2)) - 5
    const maxX = Math.max(...layout.locations.map(l => l.center[0] + l.width / 2)) + 5
    const regionalLabels: THREE.Sprite[] = []
    const cityLabels: THREE.Sprite[] = []
    if (!layout.geography) {
      const roadZ = (layout.locations.find(l => l.area === 'customer')?.center[2] ?? 40) - 19
      box(scene, [(minX + maxX) / 2, -.03, roadZ], [maxX - minX, .12, 7], 0x35424d)
      for (let x = minX; x < maxX; x += 7) box(scene, [x, .05, roadZ], [3, .03, .12], 0x83939a)
    } else {
      const minZ = Math.min(...layout.locations.map(l => l.center[2] - l.depth / 2))
      const compassX = minX - 20
      box(scene, [compassX, .25, minZ + 10], [.7, .3, 14], 0x87b7ce)
      const arrowGeometry = new THREE.ConeGeometry(2, 5, 3)
      geometries.add(arrowGeometry)
      const arrow = new THREE.Mesh(arrowGeometry, material(0x87b7ce))
      arrow.rotation.x = -Math.PI / 2
      arrow.position.set(compassX, .4, minZ + 1)
      scene.add(arrow)
      label('N / True north', [compassX, 4, minZ - 5], 22)
      const scaleMeters = 10 ** Math.floor(Math.log10(layout.geography.metersPerUnit * 30))
      const scaleWidth = scaleMeters / layout.geography.metersPerUnit
      box(scene, [compassX + scaleWidth / 2, .25, minZ + 28], [scaleWidth, .3, .5], 0x87b7ce)
      for (const x of [compassX, compassX + scaleWidth]) box(scene, [x, .25, minZ + 28], [.5, .3, 3], 0x87b7ce)
      label(scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`, [compassX + scaleWidth / 2, 3, minZ + 33], 18)
      const pinGeometry = new THREE.SphereGeometry(1.8, 12, 8)
      geometries.add(pinGeometry)
      const cityRingGeometry = new THREE.TorusGeometry(2.4, .3, 6, 24)
      geometries.add(cityRingGeometry)
      for (const city of layout.geography.cities) {
        const [x, , z] = city.center
        const ring = new THREE.Mesh(cityRingGeometry, material(0xe3d39e))
        ring.rotation.x = -Math.PI / 2
        ring.position.set(x, .4, z)
        ring.userData = { locationId: city.id }
        scene.add(ring)
        picks.push(ring)
        const pin = new THREE.Mesh(pinGeometry, material(0xe3d39e))
        pin.scale.setScalar(.65)
        pin.position.set(x, 4, z)
        pin.userData = { locationId: city.id }
        scene.add(pin)
        picks.push(pin)
        box(scene, [x, 2, z], [.25, 4, .25], 0xe3d39e)
        const tag = label(city.name.toUpperCase(), [x, 6, z], 24, '#f4edcf', true, true)
        tag.userData = { locationId: city.id }
        tag.renderOrder = 1
        cityLabels.push(tag)
        picks.push(tag)
      }
      for (const site of layout.geography.sites) {
        const [x, , z] = site.center
        const height = Math.max(12, Math.min(28, layout.extent * .04))
        const color = site.summit ? 0xe65c67 : 0x8ab4f0
        box(scene, [x, height / 2, z], [.4, height, .4], color)
        const pin = new THREE.Mesh(pinGeometry, material(color))
        pin.position.set(x, height, z)
        pin.userData = { locationId: site.id }
        scene.add(pin)
        picks.push(pin)
        const title = site.summit ? 'Summit Equipment / HQ' : site.accounts.map(a => a.name).join(' / ')
        const tag = label(title, [x, height + 5, z], 36, site.summit ? '#ff929a' : '#a7ccff', true, false, countLocationAssets(layout, site.locationIds))
        tag.userData = { locationId: site.id }
        tag.renderOrder = 2
        regionalLabels.push(tag)
        picks.push(tag)
      }
      const summit = layout.geography.sites.find(site => site.summit)
      const office = layout.locations.find(location => location.id === 'rental')
      if (summit && office) {
        const [x, , z] = office.center
        const signZ = z + office.depth / 2 + 2
        for (const offset of [-5, 5]) box(scene, [x + offset, 2.8, signZ], [.35, 5.6, .35], 0x9aa7ae)
        box(scene, [x, 5.5, signZ], [14, 5.5, .5], 0x11161b)
        const faceGeometry = new THREE.PlaneGeometry(12, 4.5)
        geometries.add(faceGeometry)
        const faceMaterial = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, toneMapped: false })
        materials.add(faceMaterial)
        const face = new THREE.Mesh(faceGeometry, faceMaterial)
        face.position.set(x, 5.5, signZ + .3)
        face.userData = { locationId: summit.id }
        scene.add(face)
        picks.push(face)
        const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}summit-logo.png`, loaded => {
          if (disposed) { loaded.dispose(); return }
          loaded.colorSpace = THREE.SRGBColorSpace
          const image = loaded.image as HTMLImageElement
          const ratio = image.naturalWidth / image.naturalHeight
          face.scale.set(Math.min(1, ratio * 4.5 / 12), Math.min(1, 12 / (ratio * 4.5)), 1)
          faceMaterial.map = loaded
          faceMaterial.needsUpdate = true
        }, undefined, reason => {
          if (disposed) return
          console.error('Summit map sign image failed to load', reason)
          setWarning('The Summit logo sign could not load. All locations and fleet data remain available.')
        })
        textures.add(texture)
      }
    }
    for (const location of layout.locations) {
      const [x, , z] = location.center
      const color = areaColors[location.area]
      const lot = box(scene, [x, .05, z], [location.width, .3, location.depth], 0x3b5059)
      lot.userData = { locationId: location.id }
      picks.push(lot)
      box(scene, [x, .23, z - location.depth / 2], [location.width, .12, .3], color)
      box(scene, [x - location.width / 2, .23, z], [.3, .12, location.depth], color)
      box(scene, [x + location.width / 2, .23, z], [.3, .12, location.depth], color)
      const buildingZ = z - location.depth / 2 + 4
      const buildingWidth = location.area === 'rental' ? 16 : Math.min(location.width - 5, 22)
      const height = location.area === 'rental' ? 6 : 4
      const building = box(scene, [x, height / 2 + .3, buildingZ], [buildingWidth, height, 6], location.area === 'customer' ? 0x80949e : 0xc1c9cd)
      building.castShadow = true
      building.userData = { locationId: location.id }
      picks.push(building)
      box(scene, [x, height + .5, buildingZ], [buildingWidth + .7, .6, 6.7], 0x273746)
      box(scene, [x, height - .3, buildingZ + 3.05], [buildingWidth, .65, .12], color)
      if (location.area === 'rental') {
        for (let i = -1; i <= 1; i++) {
          box(scene, [x + i * 4.5, 3.6, buildingZ + 3.1], [3, 2, .12], 0x31566d)
          box(scene, [x + i * 4.5, 3.6, buildingZ - 3.1], [3, 2, .12], 0x31566d)
        }
        box(scene, [x, 1.5, buildingZ + 3.2], [2, 2.6, .2], 0x213f51)
        for (const offset of [-9, 9]) {
          box(scene, [x + offset, 1.2, z + 6], [.4, 2, .4], 0x6b7662)
          box(scene, [x + offset, 3, z + 6], [3, 3, 3], 0x4c8974)
        }
      } else {
        for (let i = -1; i <= 1; i++) {
          box(scene, [x + i * 5.3, 1.8, buildingZ + 3.1], [4, 3, .2], 0x283c4a)
          for (let h = .6; h < 3; h += .55) box(scene, [x + i * 5.3, h, buildingZ + 3.23], [3.8, .06, .05], 0x5b717f)
        }
      }
      const sign = label(location.label, [x, height + 3.4, buildingZ], Math.min(location.width, 23), `#${color.toString(16).padStart(6, '0')}`, false, false, countLocationAssets(layout, [location.id]))
      sign.userData = { locationId: location.id }
      picks.push(sign)
    }
    const equipment: { id: string; group: THREE.Group; marker: THREE.Mesh; label: THREE.Sprite }[] = []
    const markerGeometry = new THREE.TorusGeometry(1.65, .09, 6, 32)
    geometries.add(markerGeometry)
    for (const placed of layout.assets) {
      const group = new THREE.Group()
      group.position.set(...placed.position)
      scene.add(group)
      const model = equipmentLibrary.create(placed.asset)
      group.add(model)
      const marker = new THREE.Mesh(markerGeometry, material(readinessColors[placed.assessment.signal]))
      marker.rotation.x = -Math.PI / 2
      marker.position.y = .3
      group.add(marker)
      group.userData = { assetId: placed.asset.id }
      picks.push(group)
      const modelBounds = new THREE.Box3().setFromObject(model)
      const tag = label(placed.asset.number, [placed.position[0], Math.max(4, modelBounds.max.y + .7), placed.position[2]], 5.3)
      tag.userData = { assetId: placed.asset.id }
      picks.push(tag)
      equipment.push({ id: placed.asset.id, group, marker, label: tag })
    }
    const selection = new THREE.Mesh(markerGeometry, material(0xffffff))
    selection.rotation.x = -Math.PI / 2
    selection.scale.setScalar(1.35)
    selection.visible = false
    scene.add(selection)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reference = document.createElement('div')
    reference.className = 'scene-map-reference'
    const northArrow = document.createElement('span')
    northArrow.className = 'map-north-arrow'
    const referenceText = document.createElement('span')
    referenceText.textContent = 'True north / Offline satellite style / Illustrative terrain'
    reference.append(northArrow, referenceText)
    container.append(reference)
    let flight: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | undefined
    function destination(area: CampusArea, id?: string, locationId?: string) {
      const focus = campusFocus(layout, area, id, locationId)
      const target = new THREE.Vector3(...focus.target)
      const aspectFactor = Math.max(1, 1 / camera.aspect)
      const offset = new THREE.Vector3(.65, .85, 1).multiplyScalar(focus.distance * aspectFactor)
      return { target, position: target.clone().add(offset) }
    }
    const initial = destination('all')
    camera.position.copy(initial.position)
    controls.target.copy(initial.target)
    controls.update()
    handle.current = {
      focus(area, id, locationId) {
        if (graphicsLost) return
        const damping = controls.enableDamping
        controls.enableDamping = false
        controls.update()
        controls.enableDamping = damping
        const next = destination(area, id, locationId)
        if (motion.matches) {
          camera.position.copy(next.position)
          controls.target.copy(next.target)
          flight = undefined
        } else {
          flight = { start: performance.now(), from: camera.position.clone(), to: next.position, targetFrom: controls.target.clone(), targetTo: next.target }
        }
      },
      highlight(ids, id) {
        for (const item of equipment) {
          item.group.visible = ids.has(item.id)
          item.label.visible = ids.has(item.id)
          item.marker.scale.setScalar(item.id === id ? 1.2 : 1)
        }
        const selected = layout.assets.find(a => a.asset.id === id && ids.has(a.asset.id))
        selection.visible = !!selected
        if (selected) selection.position.set(selected.position[0], .36, selected.position[2])
        renderer.shadowMap.needsUpdate = true
      },
    }
    const cancelFlight = () => { flight = undefined }
    controls.addEventListener('start', cancelFlight)
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    handle.current.focus('all')
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const labelPoint = new THREE.Vector3()
    const occupiedLabels: { left: number; right: number; top: number; bottom: number }[] = []
    let down = { x: 0, y: 0 }
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY } }
    function pick(event: PointerEvent) {
      if (event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(picks, true).find(h => {
        let object: THREE.Object3D | null = h.object
        while (object) { if (!object.visible) return false; object = object.parent }
        return true
      })
      let object = hit?.object
      while (object) {
        if (typeof object.userData.assetId === 'string') { onAsset(object.userData.assetId); return }
        if (typeof object.userData.locationId === 'string') { onLocation(object.userData.locationId); return }
        const area = object.userData.area
        if (area === 'rental' || area === 'yard' || area === 'service' || area === 'customer') { onArea(area); return }
        object = object.parent ?? undefined
      }
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      console.error('Fleet visualization WebGL context was lost')
      graphicsLost = true
      setError('The browser lost its 3D graphics connection. Reload the page to restore it. All fleet records remain available through Assets & filters.')
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerup', pick)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    let frame = 0
    function animate(now: number) {
      frame = requestAnimationFrame(animate)
      if (graphicsLost || document.hidden || renderer.getContext().isContextLost()) return
      if (flight) {
        const t = motion.matches ? 1 : Math.min(1, (now - flight.start) / 1100)
        const eased = t * t * (3 - 2 * t)
        camera.position.lerpVectors(flight.from, flight.to, eased)
        controls.target.lerpVectors(flight.targetFrom, flight.targetTo, eased)
        if (t === 1) flight = undefined
      }
      if (selection.visible) selection.scale.setScalar(motion.matches ? 1.35 : 1.35 + Math.sin(now / 350) * .07)
      controls.update()
      const near = Math.max(.1, Math.min(20, camera.position.distanceTo(controls.target) / 500))
      if (Math.abs(camera.near - near) > near * .05) {
        camera.near = near
        camera.updateProjectionMatrix()
      }
      const mapCenter = controls.target.clone().project(camera)
      const mapNorth = controls.target.clone().add(new THREE.Vector3(0, 0, -10)).project(camera)
      northArrow.style.transform = `rotate(${Math.atan2(mapNorth.x - mapCenter.x, mapNorth.y - mapCenter.y)}rad)`
      occupiedLabels.length = 0
      function labelBounds(tag: THREE.Sprite) {
        labelPoint.copy(tag.position).project(camera)
        const height = container.clientHeight * tag.scale.y / (2 * camera.position.distanceTo(tag.position) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
        const width = height * tag.scale.x / tag.scale.y
        const left = (labelPoint.x + 1) * container.clientWidth / 2 - width * tag.center.x
        const top = (1 - labelPoint.y) * container.clientHeight / 2 - height * (1 - tag.center.y)
        return { left: left - 5, right: left + width + 5, top: top - 4, bottom: top + height + 4 }
      }
      for (const tag of regionalLabels) {
        const distance = camera.position.distanceTo(tag.position)
        tag.visible = distance > 65
        const width = Math.max(24, Math.min(layout.extent * .4, distance * .32))
        tag.scale.set(width, width * 112 / 512, 1)
        if (tag.visible) occupiedLabels.push(labelBounds(tag))
      }
      for (const tag of cityLabels) {
        const distance = camera.position.distanceTo(tag.position)
        tag.visible = distance > 80
        if (!tag.visible) continue
        const width = Math.max(18, Math.min(layout.extent * .3, distance * .24))
        tag.scale.set(width, width * 112 / 512, 1)
        let placed = false
        for (const [x, y] of [[.5, 1.2], [.5, -.2], [-.1, .5], [1.1, .5], [.5, 2.3], [.5, -1.3]]) {
          tag.center.set(x, y)
          const bounds = labelBounds(tag)
          if (occupiedLabels.some(other => bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top)) continue
          occupiedLabels.push(bounds)
          placed = true
          break
        }
        tag.visible = placed
      }
      for (const item of equipment) item.label.visible = item.group.visible && camera.position.distanceTo(item.group.position) < 120
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      handle.current = null
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointerup', pick)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      controls.removeEventListener('start', cancelFlight)
      controls.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const m of materials) m.dispose()
      for (const texture of textures) texture.dispose()
      equipmentLibrary.dispose()
      environmentMap.dispose()
      sun.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      reference.remove()
    }
  }, [layout, onAsset, onArea, onLocation])
  useEffect(() => { handle.current?.focus(area, focused, locationId) }, [area, focused, locationId, focusRevision, layout])
  useEffect(() => { handle.current?.highlight(visibleIds, focused) }, [visibleIds, focused, layout])
  return <div className="fleet-scene">
    <div className="scene-renderer-host" ref={host} />
    {error && <div className="scene-error" role="alert"><strong>3D view unavailable</strong><p>{error}</p></div>}
    {warning && <div className="scene-warning" role="status">{warning}</div>}
  </div>
}
