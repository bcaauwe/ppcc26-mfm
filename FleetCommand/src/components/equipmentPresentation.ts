import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createEquipmentLibrary } from './equipmentModels.ts'
import type { EquipmentIdentity } from '../domain/equipment.ts'

export function createEquipmentPresentation(renderer: THREE.WebGLRenderer, asset: EquipmentIdentity) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const environment = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environmentMap = pmrem.fromScene(environment, .04)
  scene.environment = environmentMap.texture
  scene.environmentIntensity = .55
  environment.dispose()
  pmrem.dispose()
  const library = createEquipmentLibrary()
  let model = library.create(asset)
  scene.add(model)
  const center = new THREE.Vector3()
  let radius = 1
  scene.add(new THREE.HemisphereLight(0xd8eaff, 0x4c5953, 1.3))
  const sun = new THREE.DirectionalLight(0xffefdb, 3.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  sun.shadow.normalBias = .025
  scene.add(sun)
  const floorGeometry = new THREE.CircleGeometry(1, 48)
  const floorMaterial = new THREE.ShadowMaterial({ opacity: .3 })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const camera = new THREE.PerspectiveCamera(36, 1, .05, 100)
  function measure() {
    const bounds = new THREE.Box3().setFromObject(model)
    bounds.getCenter(center)
    radius = bounds.getBoundingSphere(new THREE.Sphere()).radius
    sun.position.set(-radius * 2, radius * 4, radius * 3)
    sun.shadow.camera.left = sun.shadow.camera.bottom = -radius * 2
    sun.shadow.camera.right = sun.shadow.camera.top = radius * 2
    sun.shadow.camera.far = radius * 12
    sun.shadow.camera.updateProjectionMatrix()
    floor.scale.setScalar(radius * 1.4)
    floor.position.y = bounds.min.y - .01
    camera.far = radius * 40
  }
  measure()
  return {
    scene, camera, center,
    get model() { return model },
    setAsset(next: EquipmentIdentity) {
      model.removeFromParent()
      model = library.create(next)
      scene.add(model)
      measure()
    },
    fit(width: number, height: number) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
      const distance = radius * 1.12 / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect)))
      camera.position.copy(center).add(new THREE.Vector3(.85, .5, 1).normalize().multiplyScalar(distance))
      camera.lookAt(center)
    },
    dispose() {
      floorGeometry.dispose()
      floorMaterial.dispose()
      library.dispose()
      environmentMap.dispose()
      sun.shadow.dispose()
    },
  }
}
