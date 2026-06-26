import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { formulaAssetManifest } from './data/assets';
import { createFormulaCar, summarizeDriverRig } from './game/models';

type AssetId = keyof typeof formulaAssetManifest.plannedGlb;

interface ModelMetric {
  id: string;
  status: 'loaded' | 'fallback' | 'failed';
  meshes: number;
  triangles: number;
  size: { x: number; y: number; z: number };
}

const root = document.querySelector<HTMLDivElement>('#assetInspector');
if (!root) throw new Error('Missing #assetInspector');
const appRoot = root;

appRoot.innerHTML = `
  <main class="asset-inspector">
    <canvas aria-label="Formula asset inspection scene"></canvas>
    <section class="asset-panel">
      <p class="kicker">Isolated model QA</p>
      <h1>Asset Inspector</h1>
      <div class="asset-toggles">
        <label><input type="checkbox" data-model="chassis" checked /> Chassis</label>
        <label><input type="checkbox" data-model="wheel" checked /> Wheel</label>
        <label><input type="checkbox" data-model="driver" checked /> Driver</label>
        <label><input type="checkbox" data-model="procedural-car" checked /> Assembled car</label>
      </div>
      <pre id="assetMetrics">Loading formula kit...</pre>
    </section>
  </main>
`;

const canvas = appRoot.querySelector<HTMLCanvasElement>('canvas')!;
const metricText = appRoot.querySelector<HTMLPreElement>('#assetMetrics')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 120);
frameCamera();
scene.add(new THREE.HemisphereLight(0xffffff, 0x203040, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(5, 8, 4);
scene.add(key);
const grid = new THREE.GridHelper(12, 12, 0x88a6b8, 0x263746);
scene.add(grid);

const loader = new GLTFLoader();
const modelGroups = new Map<string, THREE.Object3D>();
const modelMetrics: ModelMetric[] = [];
const failedAssetIds: string[] = [];

void boot();

async function boot(): Promise<void> {
  const entries = Object.entries(formulaAssetManifest.plannedGlb) as Array<[AssetId, string]>;
  const offsets: Record<string, THREE.Vector3> = {
    chassis: new THREE.Vector3(-3.3, 0, 0),
    wheel: new THREE.Vector3(0, 0, 0),
    driver: new THREE.Vector3(3.3, 0, 0),
  };
  await Promise.all(
    entries.map(async ([id, url]) => {
      try {
        const gltf = await loader.loadAsync(resolvePublicAssetUrl(url));
        const object = gltf.scene;
        object.name = `inspector-${id}`;
        normalizeForDisplay(object, id === 'chassis' ? 2.6 : id === 'wheel' ? 1.4 : 1.8);
        placeForDisplay(object, offsets[id]);
        scene.add(object);
        modelGroups.set(id, object);
        modelMetrics.push({ id, status: 'loaded', ...measureObject(object) });
      } catch {
        failedAssetIds.push(id);
        modelMetrics.push({ id, status: 'failed', meshes: 0, triangles: 0, size: { x: 0, y: 0, z: 0 } });
      }
    }),
  );
  const car = createFormulaCar(0xe53935, 0xfff3bf);
  car.name = 'inspector-procedural-car';
  car.position.set(0, 0.15, -2.8);
  scene.add(car);
  modelGroups.set('procedural-car', car);
  modelMetrics.push({ id: 'procedural-car', status: 'fallback', ...measureObject(car) });
  bindToggles();
  render();
}

function bindToggles(): void {
  appRoot.querySelectorAll<HTMLInputElement>('[data-model]').forEach((input) => {
    input.addEventListener('change', () => {
      const model = modelGroups.get(input.dataset.model ?? '');
      if (model) model.visible = input.checked;
      exposeMetrics();
    });
  });
}

function render(): void {
  requestAnimationFrame(render);
  const t = performance.now() * 0.001;
  for (const model of modelGroups.values()) {
    model.rotation.y = t * 0.38;
  }
  renderer.render(scene, camera);
  exposeMetrics();
}

function exposeMetrics(): void {
  const metrics = {
    ready: modelMetrics.length >= Object.keys(formulaAssetManifest.plannedGlb).length + 1,
    isolated: true,
    loadedAssetIds: modelMetrics.filter((metric) => metric.status === 'loaded').map((metric) => metric.id),
    failedAssetIds,
    visibleModelIds: [...modelGroups.entries()].filter(([, model]) => model.visible).map(([id]) => id),
    modelMetrics,
    driverRig: summarizeDriverRig(modelGroups.get('procedural-car') as THREE.Group),
    render: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    },
  };
  metricText.textContent = JSON.stringify(metrics, null, 2);
  (window as any).__GRIDLINE_ASSET_INSPECTOR__ = metrics;
}

function measureObject(object: THREE.Object3D): Omit<ModelMetric, 'id' | 'status'> {
  let meshes = 0;
  let triangles = 0;
  object.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    triangles += geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((geometry.attributes.position?.count ?? 0) / 3);
  });
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  return {
    meshes,
    triangles,
    size: {
      x: Math.round(size.x * 100) / 100,
      y: Math.round(size.y * 100) / 100,
      z: Math.round(size.z * 100) / 100,
    },
  };
}

function normalizeForDisplay(object: THREE.Object3D, targetMax: number): void {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetMax / Math.max(0.001, size.x, size.y, size.z);
  object.scale.multiplyScalar(scale);
}

function placeForDisplay(object: THREE.Object3D, target: THREE.Vector3): void {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.add(new THREE.Vector3(target.x - center.x, target.y - box.min.y, target.z - center.z));
}

function resolvePublicAssetUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  return new URL(url.slice(1), document.baseURI).toString();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  frameCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function frameCamera(): void {
  const portrait = window.innerHeight > window.innerWidth;
  camera.fov = portrait ? 58 : 48;
  camera.position.set(portrait ? 0 : 5.8, portrait ? 5.2 : 3.8, portrait ? 12.2 : 8.8);
  camera.lookAt(0, portrait ? 0.65 : 1, portrait ? -1.2 : -0.25);
  camera.updateProjectionMatrix();
}
