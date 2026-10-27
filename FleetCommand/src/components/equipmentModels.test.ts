import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createEquipmentLibrary, equipmentKind } from './equipmentModels.ts'
import type { EquipmentKind } from './equipmentModels.ts'

const examples: { name: string; number: string; className: string; kind: EquipmentKind }[] = [
  { name: 'Hydraulic Excavator', number: 'EX-1', className: 'Earthmoving', kind: 'excavator' },
  { name: 'Mobile Crane', number: 'CR-1', className: 'Cranes', kind: 'crane' },
  { name: 'Telescopic Handler', number: 'TH-1', className: 'Telehandlers', kind: 'telehandler' },
  { name: 'Forklift', number: 'FL-1', className: 'Material handling', kind: 'forklift' },
  { name: 'Skid-steer', number: 'SS-1', className: 'Loaders', kind: 'loader' },
  { name: 'Vibratory Roller', number: 'RL-1', className: 'Compaction', kind: 'roller' },
  { name: 'Scissor lift', number: 'SL-1', className: 'Access', kind: 'scissor' },
  { name: 'Diesel generator', number: 'GEN-1', className: 'Power', kind: 'generator' },
  { name: 'Unclassified equipment', number: 'A-1', className: 'Unverified', kind: 'generic' },
]
test('equipment class mapping uses asset evidence, with a neutral model for unrecognized equipment', () => {
  for (const example of examples) assert.equal(equipmentKind(example), example.kind)
  assert.equal(equipmentKind({ name: 'Equipment', number: 'A-1', className: 'Excavators' }), 'excavator')
  assert.equal(equipmentKind({ name: 'Equipment', number: 'TH-2021', className: '' }), 'telehandler')
})
test('every detailed model fits existing parking spaces, sits on the lot, and has finite geometry', () => {
  const library = createEquipmentLibrary()
  try {
    for (const example of examples) {
      const model = library.create(example)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      assert.ok(size.x <= 4.301, `${example.kind} length ${size.x}`)
      assert.ok(size.z <= 3.401, `${example.kind} width ${size.z}`)
      assert.ok(bounds.min.y >= .229 && bounds.min.y <= .231)
      assert.ok(size.y > 1)
      assert.ok(model.children.length <= 10, 'geometry must be batched by material, not one draw per detail')
      for (const child of model.children) {
        assert.ok(child instanceof THREE.Mesh)
        const positions = child.geometry.getAttribute('position')
        assert.ok(positions.count > 0)
        assert.ok(Array.from(positions.array).every(Number.isFinite))
      }
    }
  } finally { library.dispose() }
})
test('model instances have independent transforms and selection parents but share immutable geometry', () => {
  const library = createEquipmentLibrary()
  try {
    const a = library.create(examples[0])
    const b = library.create(examples[0])
    assert.notEqual(a, b)
    assert.notEqual(a.children[0], b.children[0])
    assert.ok(a.children[0] instanceof THREE.Mesh && b.children[0] instanceof THREE.Mesh)
    assert.equal(a.children[0].geometry, b.children[0].geometry)
    a.position.x = 100
    assert.notEqual(a.position.x, b.position.x)
    const parent = new THREE.Group()
    parent.userData.assetId = 'asset-1'
    parent.add(a)
    assert.equal(a.children[0].parent?.parent?.userData.assetId, 'asset-1')
    const disposed = new Set<THREE.BufferGeometry>()
    let disposalEvents = 0
    const watched = new Set<THREE.BufferGeometry>()
    for (const model of [a, b]) for (const child of model.children) {
      assert.ok(child instanceof THREE.Mesh)
      const geometry = child.geometry
      if (!watched.has(geometry)) {
        watched.add(geometry)
        geometry.addEventListener('dispose', () => { disposed.add(geometry); disposalEvents++ })
      }
    }
    library.dispose()
    library.dispose()
    assert.equal(disposed.size, a.children.length, 'shared geometry is disposed once per material batch')
    assert.equal(disposalEvents, a.children.length, 'disposal is idempotent')
  } finally { library.dispose() }
})
