import { useEffect, useState } from 'react'
import { equipmentKind } from '../domain/equipment'
import type { EquipmentIdentity, EquipmentKind } from '../domain/equipment'

let images: Promise<typeof import('./equipmentThumbnails')> | undefined
function loadImage(kind: EquipmentKind) {
  images ??= import('./equipmentThumbnails').catch(reason => {
    console.error('Equipment image renderer could not load', reason)
    throw reason
  })
  return images.then(module => module.equipmentThumbnail(kind))
}

export default function EquipmentImage({ asset, small = false }: { asset: EquipmentIdentity; small?: boolean }) {
  const kind = equipmentKind(asset)
  const [image, setImage] = useState<{ kind: EquipmentKind; src?: string; failed?: boolean }>()
  const current = image?.kind === kind ? image : undefined
  useEffect(() => {
    let active = true
    loadImage(kind).then(src => {
      if (active) setImage({ kind, src })
    }, () => {
      if (active) setImage({ kind, failed: true })
    })
    return () => { active = false }
  }, [kind])
  return <span className={`equipment equipment-image${small ? ' small' : ''}`}>
    {current?.src ? <img src={current.src} alt={`Representative ${asset.className || kind} 3D model`} onError={() => {
      console.error('Equipment model image could not be displayed', kind)
      setImage({ kind, failed: true })
    }} /> :
      <span className="equipment-image-status" role="status">{current?.failed ? '3D image unavailable' : 'Rendering 3D model...'}</span>}
  </span>
}
