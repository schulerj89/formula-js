import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { formulaAssetManifest } from '../data/assets';
import { createDriverRig, createFormulaCar } from './models';

type AssetId = keyof typeof formulaAssetManifest.plannedGlb;

interface LoadedFormulaKit {
  chassis: THREE.Object3D;
  wheel: THREE.Object3D;
  driver: THREE.Object3D;
}

export interface FormulaAssetMetrics {
  state: 'idle' | 'loading' | 'ready' | 'partial' | 'fallback';
  runtimeMode: 'procedural' | 'generated' | 'mixed';
  plannedAssetIds: AssetId[];
  loadedAssetIds: AssetId[];
  failedAssetIds: AssetId[];
  fallbackReady: boolean;
  generatedReady: boolean;
  generatedCarsCreated: number;
  proceduralCarsCreated: number;
}

export class FormulaAssetManager {
  private readonly loader = new GLTFLoader();
  private state: FormulaAssetMetrics['state'] = 'idle';
  private readonly loaded = new Map<AssetId, THREE.Object3D>();
  private readonly failed = new Set<AssetId>();
  private warmupPromise: Promise<void> | null = null;
  private generatedCarsCreated = 0;
  private proceduralCarsCreated = 0;

  warmup(): Promise<void> {
    if (this.warmupPromise) return this.warmupPromise;
    this.state = 'loading';
    const entries = Object.entries(formulaAssetManifest.plannedGlb) as Array<[AssetId, string]>;
    this.warmupPromise = Promise.all(
      entries.map(async ([id, url]) => {
        try {
          const gltf = await this.loader.loadAsync(resolvePublicAssetUrl(url));
          this.loaded.set(id, prepareAsset(gltf.scene));
        } catch {
          this.failed.add(id);
        }
      }),
    ).then(() => {
      this.state = this.loaded.size === entries.length ? 'ready' : this.loaded.size > 0 ? 'partial' : 'fallback';
    });
    return this.warmupPromise;
  }

  createCar(color: number, helmet: number, preferGenerated: boolean): THREE.Group {
    const kit = this.currentKit();
    if (!preferGenerated || !kit) {
      this.proceduralCarsCreated += 1;
      return createFormulaCar(color, helmet);
    }
    this.generatedCarsCreated += 1;
    return createGeneratedFormulaCar(kit, color, helmet);
  }

  metrics(): FormulaAssetMetrics {
    return {
      state: this.state,
      runtimeMode: this.runtimeMode(),
      plannedAssetIds: Object.keys(formulaAssetManifest.plannedGlb) as AssetId[],
      loadedAssetIds: [...this.loaded.keys()],
      failedAssetIds: [...this.failed],
      fallbackReady: true,
      generatedReady: Boolean(this.currentKit()),
      generatedCarsCreated: this.generatedCarsCreated,
      proceduralCarsCreated: this.proceduralCarsCreated,
    };
  }

  private runtimeMode(): FormulaAssetMetrics['runtimeMode'] {
    if (this.generatedCarsCreated > 0 && this.proceduralCarsCreated > 0) return 'mixed';
    if (this.generatedCarsCreated > 0) return 'generated';
    return 'procedural';
  }

  private currentKit(): LoadedFormulaKit | null {
    const chassis = this.loaded.get('chassis');
    const wheel = this.loaded.get('wheel');
    const driver = this.loaded.get('driver');
    if (!chassis || !wheel || !driver) return null;
    return { chassis, wheel, driver };
  }
}

function resolvePublicAssetUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  return new URL(url.slice(1), document.baseURI).toString();
}

export function createFormulaAssetManager(): FormulaAssetManager {
  return new FormulaAssetManager();
}

function createGeneratedFormulaCar(kit: LoadedFormulaKit, color: number, helmet: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'generated-formula-car';

  const chassis = cloneRenderable(kit.chassis);
  normalizeAsset(chassis, new THREE.Vector3(2.65, 0.95, 5.1));
  tintMeshes(chassis, color, 0.68);
  chassis.position.y = 0.2;
  group.add(chassis);

  const wheelPositions = [
    [-1.25, 0.35, 1.42],
    [1.25, 0.35, 1.42],
    [-1.25, 0.35, -1.55],
    [1.25, 0.35, -1.55],
  ] as const;
  for (const [x, y, z] of wheelPositions) {
    const wheel = cloneRenderable(kit.wheel);
    wheel.name = 'separate-wheel';
    normalizeAsset(wheel, new THREE.Vector3(0.82, 0.82, 0.38));
    tintMeshes(wheel, 0x101010, 0.42);
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  const driver = cloneRenderable(kit.driver);
  driver.name = 'generated-driver-suit';
  normalizeAsset(driver, new THREE.Vector3(0.64, 0.72, 0.68));
  tintMeshes(driver, 0x101820, 0.58);
  driver.position.y = -0.05;
  const driverRig = createDriverRig(helmet, { includeTorso: false, suitObject: driver });
  driverRig.position.set(0, 0.73, -0.34);
  driverRig.userData.baseY = driverRig.position.y;
  group.add(driverRig);

  group.scale.setScalar(0.86);
  return group;
}

function prepareAsset(source: THREE.Object3D): THREE.Object3D {
  const clone = cloneRenderable(source);
  clone.updateMatrixWorld(true);
  return clone;
}

function cloneRenderable(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else {
      mesh.material = mesh.material.clone();
    }
    mesh.castShadow = true;
  });
  return clone;
}

function normalizeAsset(object: THREE.Object3D, targetSize: THREE.Vector3): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxScale = Math.min(
    targetSize.x / Math.max(0.001, size.x),
    targetSize.y / Math.max(0.001, size.y),
    targetSize.z / Math.max(0.001, size.z),
  );
  object.scale.multiplyScalar(maxScale);
  object.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());
  const minY = scaledBox.min.y;
  object.position.sub(new THREE.Vector3(center.x, minY, center.z));
}

function tintMeshes(object: THREE.Object3D, color: number, opacity: number): void {
  object.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if ('color' in standard) standard.color.lerp(new THREE.Color(color), opacity);
      standard.roughness = Math.max(0.38, standard.roughness ?? 0.6);
    });
  });
}
