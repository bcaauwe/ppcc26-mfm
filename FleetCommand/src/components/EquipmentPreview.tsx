import { useEffect, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createEquipmentPresentation } from './equipmentPresentation'
import type { FleetAsset } from '../domain/fleet'

export default function EquipmentPreview({ asset }: { asset: FleetAsset }) {
  const host = useRef<HTMLDivElement>(null)
  const rotate = useRef<((angle: number) => void) | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch (reason) {
      console.error('Asset 3D preview could not initialize WebGL', reason)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('3D preview unavailable. Asset information remains available below.')
      return
    }
    // Graphics status follows the external renderer lifecycle.
    setError('')
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.append(renderer.domElement)
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute('aria-label', `3D ${asset.className} model for ${asset.number}`)
    const presentation = createEquipmentPresentation(renderer, asset)
    const { scene, camera, center } = presentation
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableZoom = false
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI / 2.05
    controls.target.copy(center)
    let lost = false
    const render = () => {
      if (!lost) renderer.render(scene, camera)
    }
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      presentation.fit(width, height)
      controls.update()
      render()
    }
    rotate.current = angle => { presentation.model.rotation.y += angle; render() }
    controls.addEventListener('change', render)
    const contextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      rotate.current = null
      console.error('Asset 3D preview WebGL context was lost')
      setError('3D preview graphics connection lost. Asset information remains available below.')
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    return () => {
      observer.disconnect()
      rotate.current = null
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      controls.removeEventListener('change', render)
      controls.dispose()
      presentation.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [asset])
  return <figure className="equipment-preview">
    <div className="equipment-preview-stage" ref={host} />
    {error && <div className="equipment-preview-error" role="status">{error}</div>}
    <figcaption><span>CLASS MODEL / DRAG TO ROTATE</span><div>
      <button type="button" disabled={!!error} onClick={() => rotate.current?.(-Math.PI / 6)} aria-label="Rotate asset preview left"><FaChevronLeft /></button>
      <button type="button" disabled={!!error} onClick={() => rotate.current?.(Math.PI / 6)} aria-label="Rotate asset preview right"><FaChevronRight /></button>
    </div></figcaption>
  </figure>
}
