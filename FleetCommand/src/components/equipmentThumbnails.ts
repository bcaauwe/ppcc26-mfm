import * as THREE from 'three'
import { createEquipmentPresentation } from './equipmentPresentation'
import type { EquipmentKind } from '../domain/equipment'

const cache = new Map<EquipmentKind, Promise<string>>()
const queue: { kind: EquipmentKind; resolve: (src: string) => void; reject: (reason: unknown) => void }[] = []
let scheduled = false

export function equipmentThumbnail(kind: EquipmentKind): Promise<string> {
  const cached = cache.get(kind)
  if (cached) return cached
  const result = new Promise<string>((resolve, reject) => {
    queue.push({ kind, resolve, reject })
    if (!scheduled) {
      scheduled = true
      window.setTimeout(renderBatch, 0)
    }
  })
  cache.set(kind, result)
  return result
}

function renderBatch() {
  scheduled = false
  const requests = queue.splice(0)
  let renderer: THREE.WebGLRenderer | undefined
  let presentation: ReturnType<typeof createEquipmentPresentation> | undefined
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setSize(512, 320, false)
    for (const request of requests) {
      const identity = { name: request.kind, number: '', className: request.kind }
      if (presentation) presentation.setAsset(identity)
      else presentation = createEquipmentPresentation(renderer, identity)
      presentation.fit(512, 320)
      renderer.render(presentation.scene, presentation.camera)
      if (renderer.getContext().isContextLost()) throw new Error('Equipment thumbnail graphics context was lost')
      request.resolve(renderer.domElement.toDataURL('image/png'))
    }
  } catch (reason) {
    console.error('Equipment model images could not be rendered', reason)
    for (const request of requests) request.reject(reason)
  } finally {
    presentation?.dispose()
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
}
