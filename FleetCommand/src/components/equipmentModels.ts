import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { equipmentKind } from '../domain/equipment.ts'
import type { EquipmentIdentity, EquipmentKind } from '../domain/equipment.ts'
export { equipmentKind } from '../domain/equipment.ts'
export type { EquipmentKind } from '../domain/equipment.ts'

export function createEquipmentLibrary() {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const prototypes = new Map<EquipmentKind, THREE.Group>()
  const paint = new THREE.MeshStandardMaterial({ color: 0x287fbd, metalness: .38, roughness: .32 })
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x17517f, metalness: .4, roughness: .42 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x182126, roughness: .95 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xaab8c0, metalness: .85, roughness: .24 })
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b363e, metalness: .65, roughness: .52 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9dc7d5, metalness: .12, roughness: .08, transparent: true, opacity: .5, depthWrite: false })
  const seat = new THREE.MeshStandardMaterial({ color: 0x35434a, roughness: .92 })
  const amber = new THREE.MeshStandardMaterial({ color: 0xffa62e, emissive: 0xd16c00, emissiveIntensity: .3, roughness: .3 })
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf2f0d7, emissive: 0xffe9b0, emissiveIntensity: .3 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb53032, roughness: .4 })
  const primitive = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 2, .09),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    ring: new THREE.TorusGeometry(1, .09, 6, 24),
  }
  Object.values(primitive).forEach(g => geometries.add(g))
  for (const m of [paint, darkPaint, rubber, steel, frame, glass, seat, amber, lamp, red]) materials.add(m)
  type V = [number, number, number]
  function mesh(parent: THREE.Object3D, shape: keyof typeof primitive, at: V, size: V, material: THREE.Material, rotation: V = [0, 0, 0]) {
    const part = new THREE.Mesh(primitive[shape], material)
    part.position.set(...at)
    part.scale.set(...size)
    part.rotation.set(...rotation)
    parent.add(part)
    return part
  }
  function box(parent: THREE.Object3D, at: V, size: V, material = paint, rounded = false) {
    return mesh(parent, rounded ? 'rounded' : 'box', at, size, material)
  }
  function rod(parent: THREE.Object3D, a: V, b: V, radius: number, material = steel) {
    const from = new THREE.Vector3(...a)
    const to = new THREE.Vector3(...b)
    const part = mesh(parent, 'cylinder', from.clone().add(to).multiplyScalar(.5).toArray(), [radius, from.distanceTo(to), radius], material)
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize())
    return part
  }
  function beam(parent: THREE.Object3D, a: V, b: V, thickness: number, width: number, material = paint) {
    const from = new THREE.Vector3(...a)
    const to = new THREE.Vector3(...b)
    const part = box(parent, from.clone().add(to).multiplyScalar(.5).toArray(), [thickness, from.distanceTo(to), width], material, true)
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize())
  }
  function hydraulic(parent: THREE.Object3D, a: V, b: V) {
    const middle = new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), .58).toArray()
    rod(parent, a, middle, .075, darkPaint)
    rod(parent, middle, b, .038, steel)
    for (const end of [a, b]) mesh(parent, 'cylinder', end, [.11, .2, .11], steel, [Math.PI / 2, 0, 0])
  }
  function wheel(parent: THREE.Object3D, x: number, z: number, radius = .54, width = .34) {
    const y = radius + .22
    mesh(parent, 'cylinder', [x, y, z], [radius, width, radius], rubber, [Math.PI / 2, 0, 0])
    for (const side of [-1, 1]) {
      mesh(parent, 'cylinder', [x, y, z + side * width * .49], [radius * .65, .025, radius * .65], rubber, [Math.PI / 2, 0, 0])
      mesh(parent, 'cylinder', [x, y, z + side * width * .54], [radius * .48, .04, radius * .48], steel, [Math.PI / 2, 0, 0])
      mesh(parent, 'cylinder', [x, y, z + side * width * .62], [radius * .21, .07, radius * .21], darkPaint, [Math.PI / 2, 0, 0])
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3
        mesh(parent, 'cylinder', [x + Math.cos(angle) * radius * .32, y + Math.sin(angle) * radius * .32, z + side * width * .58],
          [.025, .035, .025], steel, [Math.PI / 2, 0, 0])
      }
    }
    for (let i = 0; i < 20; i++) {
      const angle = i * Math.PI / 10
      mesh(parent, 'box', [x + Math.sin(angle) * radius, y + Math.cos(angle) * radius, z],
        [radius * .23, .055, width * .96], rubber, [0, 0, -angle])
    }
  }
  function tracks(parent: THREE.Object3D) {
    for (const z of [-.83, .83]) {
      box(parent, [0, .63, z], [2.8, .72, .48], rubber, true)
      for (let i = 0; i < 5; i++) {
        mesh(parent, 'cylinder', [-1 + i * .5, .6, z], [.26, .51, .26], frame, [Math.PI / 2, 0, 0])
        mesh(parent, 'cylinder', [-1 + i * .5, .6, z + Math.sign(z) * .27], [.12, .03, .12], steel, [Math.PI / 2, 0, 0])
      }
      for (let i = 0; i < 30; i++) {
        const angle = i * Math.PI / 15
        mesh(parent, 'box', [Math.cos(angle) * 1.36, .63 + Math.sin(angle) * .38, z],
          [.18, .08, .55], frame, [0, 0, Math.atan2(.38 * Math.cos(angle), -1.36 * Math.sin(angle))])
      }
    }
  }
  function cab(parent: THREE.Object3D, x: number, y: number, z = 0, width = 1.05) {
    box(parent, [x, y, z], [.94, .17, width + .12], frame, true)
    box(parent, [x, y + .65, z], [.88, 1.18, width], glass)
    for (const dx of [-.47, .47]) for (const dz of [-width / 2, width / 2]) {
      box(parent, [x + dx, y + .65, z + dz], [.055, 1.3, .055], frame)
    }
    box(parent, [x, y + 1.32, z], [1.09, .13, width + .2], darkPaint, true)
    box(parent, [x, y + .29, z], [.43, .15, .5], seat, true)
    box(parent, [x - .19, y + .52, z], [.13, .5, .5], seat, true)
    rod(parent, [x + .25, y + .15, z], [x + .33, y + .7, z], .028, frame)
    mesh(parent, 'ring', [x + .33, y + .7, z], [.16, .16, .16], rubber, [.5, Math.PI / 2, 0])
    for (const side of [-1, 1]) {
      rod(parent, [x + .4, y + .95, z + side * width / 2], [x + .48, y + .95, z + side * (width / 2 + .18)], .025, frame)
      box(parent, [x + .48, y + 1, z + side * (width / 2 + .18)], [.07, .17, .13], frame, true)
      box(parent, [x - .12, y + .07, z + side * (width / 2 + .13)], [.43, .07, .22], steel)
      box(parent, [x + .39, y + 1.25, z + side * width * .35], [.09, .09, .13], lamp)
    }
    mesh(parent, 'cylinder', [x - .3, y + 1.45, z], [.07, .17, .07], amber)
  }
  function engine(parent: THREE.Object3D, x: number, y: number, length = 1) {
    box(parent, [x, y, 0], [length, .75, 1.5], paint, true)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) box(parent, [x - length * .32 + i * length * .12, y, side * .756], [.035, .39, .018], frame)
      box(parent, [x - length * .4, y + .16, side * .77], [.2, .06, .015], steel)
      box(parent, [x - length * .45, y - .23, side * .55], [.05, .12, .19], red)
    }
    rod(parent, [x - .2, y + .3, -.4], [x - .2, y + .94, -.4], .055, frame)
    box(parent, [x - .14, y + .95, -.4], [.2, .05, .12], frame)
  }
  function forks(parent: THREE.Object3D, x: number, y: number, width = 1.3) {
    box(parent, [x, y + .43, 0], [.13, .95, width], frame)
    for (const z of [-width * .31, width * .31]) {
      box(parent, [x + .06, y + .28, z], [.12, .72, .12], steel)
      box(parent, [x + .57, y - .04, z], [1.1, .09, .15], steel)
    }
  }
  function bucket(parent: THREE.Object3D, x: number, y: number, width: number) {
    box(parent, [x, y, 0], [.72, .12, width], steel)
    box(parent, [x - .3, y + .3, 0], [.12, .62, width], frame)
    for (const z of [-width / 2, width / 2]) {
      const side = box(parent, [x, y + .18, z], [.73, .4, .07], darkPaint)
      side.rotation.z = -.25
    }
    for (let i = 0; i < 5; i++) box(parent, [x + .42, y - .01, -width * .4 + i * width * .2], [.22, .1, .09], steel)
  }
  function build(kind: EquipmentKind) {
    const group = new THREE.Group()
    if (kind === 'excavator') {
      tracks(group)
      mesh(group, 'cylinder', [0, 1.04, 0], [.6, .22, .6], steel)
      box(group, [-.1, 1.27, 0], [2.25, .36, 1.75], darkPaint, true)
      engine(group, -.75, 1.68, .95)
      cab(group, -.1, 1.44, .37, .92)
      beam(group, [.53, 1.54, -.43], [1.32, 3.15, -.43], .3, .3)
      beam(group, [1.32, 3.15, -.43], [2.12, 1.42, -.43], .24, .24)
      hydraulic(group, [.4, 1.55, -.64], [1.12, 2.88, -.64])
      hydraulic(group, [1.05, 2.9, -.44], [1.85, 2.05, -.44])
      rod(group, [.56, 1.55, -.2], [1.3, 3.12, -.2], .025, rubber)
      bucket(group, 2.12, .94, .83)
    } else if (kind === 'crane') {
      box(group, [0, 1.04, 0], [3.7, .4, 1.64], darkPaint, true)
      for (const x of [-1.3, 0, 1.3]) for (const z of [-.87, .87]) wheel(group, x, z, .47)
      cab(group, 1.28, 1.25)
      box(group, [-.5, 1.54, 0], [1.45, .66, 1.55], paint, true)
      for (let i = 0; i < 3; i++) beam(group, [-.65 + i * .55, 1.9 + i * .53, 0], [1.25 + i * .55, 3.75 + i * .53, 0], .38 - i * .08, .42 - i * .07, i === 2 ? steel : paint)
      hydraulic(group, [-.9, 1.25, -.36], [.8, 3.25, -.36])
      rod(group, [2.35, 4.81, 0], [2.35, 2.15, 0], .018, frame)
      box(group, [2.35, 2.1, 0], [.23, .27, .3], amber, true)
      const hook = mesh(group, 'ring', [2.35, 1.85, 0], [.14, .14, .14], steel)
      hook.rotation.y = Math.PI / 2
      for (const x of [-1.1, 1.1]) for (const z of [-1.15, 1.15]) {
        box(group, [x, .9, z], [.19, .2, 1], steel)
        rod(group, [x, .3, z * 1.25], [x, .94, z * 1.25], .065, frame)
        box(group, [x, .26, z * 1.25], [.4, .08, .36], frame)
      }
    } else if (kind === 'telehandler' || kind === 'forklift') {
      box(group, [0, .93, 0], [2.65, .44, 1.43], darkPaint, true)
      for (const x of [-.91, .91]) for (const z of [-.83, .83]) wheel(group, x, z, kind === 'forklift' ? .4 : .54)
      engine(group, -.77, 1.26, .82)
      cab(group, -.18, 1.2, kind === 'telehandler' ? .24 : 0, .94)
      if (kind === 'telehandler') {
        beam(group, [-.72, 1.45, -.44], [1.5, 2.45, -.44], .3, .32)
        beam(group, [.3, 1.91, -.44], [2.05, 2.7, -.44], .19, .22, steel)
        hydraulic(group, [-.35, .98, -.48], [1.14, 2.22, -.48])
        beam(group, [2.05, 2.7, -.44], [2.1, 2.28, 0], .13, .2, frame)
        forks(group, 2.1, 1.4)
      } else {
        for (const z of [-.48, .48]) {
          box(group, [1.4, 1.65, z], [.15, 2.6, .13], frame)
          box(group, [1.45, 1.64, z], [.045, 2.35, .05], steel)
        }
        for (const y of [.49, 2.83]) box(group, [1.4, y, 0], [.18, .16, 1.1], frame)
        hydraulic(group, [1.38, .52, 0], [1.38, 2.5, 0])
        forks(group, 1.57, .45)
      }
    } else if (kind === 'loader') {
      tracks(group)
      box(group, [-.2, 1.13, 0], [2.4, .36, 1.6], darkPaint, true)
      cab(group, -.3, 1.3)
      engine(group, -.97, 1.47, .65)
      for (const z of [-.7, .7]) {
        beam(group, [-.7, 1.35, z], [1.43, 1, z], .18, .2)
        hydraulic(group, [-.5, 1, z], [.95, 1.05, z])
      }
      bucket(group, 1.7, .43, 1.9)
    } else if (kind === 'roller') {
      box(group, [0, 1.03, 0], [2.6, .36, 1.4], darkPaint, true)
      for (const z of [-.8, .8]) wheel(group, -.8, z, .52)
      mesh(group, 'cylinder', [1.05, .83, 0], [.6, 1.65, .6], steel, [Math.PI / 2, 0, 0])
      for (const z of [-.91, .91]) beam(group, [.15, 1.12, z], [1.05, .83, z], .16, .14, frame)
      cab(group, -.18, 1.2)
      engine(group, -.85, 1.35, .8)
    } else if (kind === 'scissor') {
      box(group, [0, .76, 0], [2.65, .5, 1.38], darkPaint, true)
      for (const x of [-.92, .92]) for (const z of [-.7, .7]) wheel(group, x, z, .32, .25)
      for (const z of [-.48, .48]) for (let i = 0; i < 2; i++) {
        beam(group, [-.9, 1 + i * .62, z], [.9, 1.62 + i * .62, z], .08, .1, steel)
        beam(group, [.9, 1 + i * .62, z], [-.9, 1.62 + i * .62, z], .08, .1, steel)
      }
      box(group, [0, 2.32, 0], [2.8, .16, 1.56], paint)
      for (const x of [-1.3, 1.3]) for (const z of [-.7, .7]) rod(group, [x, 2.4, z], [x, 3.2, z], .035, paint)
      for (const z of [-.7, .7]) for (const y of [2.78, 3.2]) rod(group, [-1.3, y, z], [1.3, y, z], .035, paint)
      for (const x of [-1.3, 1.3]) rod(group, [x, 3.2, -.7], [x, 3.2, .7], .035, paint)
    } else {
      box(group, [0, .42, 0], [2.6, .2, 1.55], frame)
      box(group, [0, 1.08, 0], [2.4, 1.15, 1.36], paint, true)
      for (const z of [-.69, .69]) for (let i = 0; i < 9; i++) box(group, [-.9 + i * .14, 1.1, z], [.04, .61, .02], frame)
      box(group, [.76, 1.2, .7], [.38, .42, .04], frame)
      box(group, [.76, 1.28, .73], [.23, .1, .02], glass)
      mesh(group, 'cylinder', [.84, 1.08, .74], [.045, .03, .045], red, [Math.PI / 2, 0, 0])
      for (const x of [-.8, .8]) box(group, [x, .28, 0], [.24, .15, 1.5], rubber)
      if (kind === 'generator') rod(group, [-.5, 1.65, -.3], [-.5, 1.95, -.3], .06, frame)
    }
    group.updateMatrixWorld(true)
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>()
    group.traverse(part => {
      if (!(part instanceof THREE.Mesh) || Array.isArray(part.material)) return
      const pieces = byMaterial.get(part.material) ?? []
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()
      pieces.push(geometry.applyMatrix4(part.matrixWorld))
      byMaterial.set(part.material, pieces)
    })
    const model = new THREE.Group()
    for (const [material, pieces] of byMaterial) {
      const geometry = mergeGeometries(pieces)
      pieces.forEach(piece => piece.dispose())
      if (!geometry) throw new Error(`Unable to build ${kind} equipment geometry`)
      geometries.add(geometry)
      const part = new THREE.Mesh(geometry, material)
      part.castShadow = material !== glass
      part.receiveShadow = true
      model.add(part)
    }
    // Keep detailed attachments inside the existing parking-space footprint.
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const scale = Math.min(1, 4.3 / size.x, 3.4 / size.z)
    model.scale.setScalar(scale)
    model.position.y = .23 - bounds.min.y * scale
    model.userData.equipmentKind = kind
    return model
  }
  return {
    create(asset: EquipmentIdentity) {
      const kind = equipmentKind(asset)
      let prototype = prototypes.get(kind)
      if (!prototype) {
        prototype = build(kind)
        prototypes.set(kind, prototype)
      }
      return prototype.clone(true)
    },
    dispose() {
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      geometries.clear()
      materials.clear()
      prototypes.clear()
    },
  }
}
