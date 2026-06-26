import * as THREE from 'three';
import type { RacerDefinition, TrackDefinition } from '../types';
import { createFormulaCar } from './models';
import { TrackPath } from './trackPath';

export interface SceneBuild {
  path: TrackPath;
  cars: Map<string, THREE.Group>;
  detailStats: TracksideDetailStats;
  resourceStats: SceneResourceStats;
}

export interface EnvironmentValidationReport {
  trackId: string;
  curbCount: number;
  guardrailCount: number;
  tireWallCount: number;
  brakingMarkerCount: number;
  sponsorSignCount: number;
  startFinishGantryCount: number;
  pitBuildingCount: number;
  marinaDockCount: number;
  boatCount: number;
  waterFeatureCount: number;
  vegetationCount: number;
  tracksidePropCount: number;
  landmarkCount: number;
  floatingObjectCount: number;
  floatingObjects: EnvironmentFloatingObject[];
  roadObstructionCount: number;
  roadObstructions: EnvironmentRoadOverlap[];
  curbIntrusionCount: number;
  curbIntrusions: EnvironmentRoadOverlap[];
  guardrailIntrusionCount: number;
  tireWallIntrusionCount: number;
  sponsorSignIntrusionCount: number;
  tracksidePropIntrusionCount: number;
  estimatedDetailScore: number;
  passed: boolean;
  failureReasons: string[];
}

export interface EnvironmentRoadOverlap {
  category: EnvironmentCategory;
  name: string;
  x: number;
  z: number;
  lateralDistance: number;
  allowedHalfWidth: number;
  radius: number;
}

export interface EnvironmentFloatingObject {
  category: EnvironmentCategory;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface TrackRoadSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  progress: number;
  lateralDistance: number;
  absoluteLateralDistance: number;
}

export interface SceneResourceStats {
  disposePasses: number;
  disposedGeometries: number;
  disposedMaterials: number;
  retainedSharedGeometries: number;
}

export interface TracksideDetailStats {
  visualKerbSegments: number;
  kerbInstances: number;
  barrierPanels: number;
  sponsorBoards: number;
  tireStacks: number;
  brakeBoardZones: number;
  brakeBoardPanels: number;
  brakeBoards: number;
  brakeBoardPosts: number;
  apexPosts: number;
  readabilityMarkerInstances: number;
  readabilityInstancedBatches: number;
  pitWallSegments: number;
  startGridMarks: number;
  gantryLights: number;
  instancedBatches: number;
  totalInstances: number;
  validation: EnvironmentValidationReport;
}

export interface PodiumCeremony {
  group: THREE.Group;
  slots: Array<{ rank: 1 | 2 | 3; position: THREE.Vector3; yaw: number }>;
  stats: PodiumCeremonyStats;
}

export interface PodiumCeremonyStats {
  platforms: number;
  lightRigs: number;
  confettiPieces: number;
  finaleMode: boolean;
}

export const ROAD_WIDTH = 11;
export const DRIVABLE_HALF_WIDTH = ROAD_WIDTH / 2;
export const PROTECTED_ROAD_HALF_WIDTH = DRIVABLE_HALF_WIDTH + 0.35;
const MAX_CURB_ROAD_INTRUSION = 0.25;
const VALIDATION_SEGMENTS = 512;
const marinaTrackId = 'marina';
type CarFactory = (racer: RacerDefinition) => THREE.Group;
export type SceneDetailLevel = 'full' | 'balanced' | 'battery';

export type EnvironmentCategory =
  | 'track_curb'
  | 'guardrail'
  | 'tire_wall'
  | 'braking_marker'
  | 'sponsor_sign'
  | 'start_finish_gantry'
  | 'pit_building'
  | 'marina_dock'
  | 'boat'
  | 'water_feature'
  | 'vegetation'
  | 'trackside_prop'
  | 'landmark'
  | 'road_marking';

export function buildRaceScene(
  scene: THREE.Scene,
  track: TrackDefinition,
  racers: RacerDefinition[],
  carFactory: CarFactory = defaultCarFactory,
  detailLevel: SceneDetailLevel = 'full',
): SceneBuild {
  const resourceStats = disposeScene(scene);
  scene.clear();
  scene.background = new THREE.Color(track.palette.sky);
  scene.fog = new THREE.Fog(track.palette.sky, 160, 520);

  const ambient = new THREE.HemisphereLight(0xffffff, track.palette.ground, 1.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(70, 120, 40);
  scene.add(sun);

  const path = new TrackPath(track);
  scene.add(createGround(track));
  scene.add(createTrackRoad(path, track, detailLevel));
  const kerbs = createTrackCurbs(path, track, detailLevel);
  scene.add(kerbs.group);
  const environment = createTrackEnvironment(path, track, detailLevel);
  scene.add(environment.group);
  const tracksideDetails = createTracksideDetails(path, track, detailLevel);
  scene.add(tracksideDetails.group);
  const validation = validateTrackEnvironment(scene, path, track);
  if (track.id === marinaTrackId) logEnvironmentValidationReport(validation);

  const cars = new Map<string, THREE.Group>();
  racers.forEach((racer, index) => {
    const car = carFactory(racer);
    car.position.y = 0.2;
    const pose = path.poseAt(0.985 - index * 0.006, (index % 2 === 0 ? -1 : 1) * (1.4 + Math.floor(index / 2) * 1.6));
    car.position.copy(pose.position);
    car.rotation.y = pose.yaw;
    scene.add(car);
    cars.set(racer.id, car);
  });

  return { path, cars, detailStats: { ...tracksideDetails.stats, ...kerbs.stats, validation }, resourceStats };
}

function defaultCarFactory(racer: RacerDefinition): THREE.Group {
  return createFormulaCar(racer.color, racer.helmet);
}

function disposeScene(scene: THREE.Scene): SceneResourceStats {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const retainedSharedGeometries = new Set<THREE.BufferGeometry>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if ('geometry' in mesh && mesh.geometry) {
      if (mesh.geometry.userData.sharedResource) {
        retainedSharedGeometries.add(mesh.geometry);
      } else if (!disposedGeometries.has(mesh.geometry)) {
        disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((item) => {
        if (disposedMaterials.has(item)) return;
        disposedMaterials.add(item);
        item.dispose();
      });
    } else if (material && !disposedMaterials.has(material)) {
      disposedMaterials.add(material);
      material.dispose();
    } else {
      return;
    }
  });
  return {
    disposePasses: 1,
    disposedGeometries: disposedGeometries.size,
    disposedMaterials: disposedMaterials.size,
    retainedSharedGeometries: retainedSharedGeometries.size,
  };
}

function createGround(track: TrackDefinition): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(680, 680, 24, 24);
  const material = new THREE.MeshLambertMaterial({ color: track.palette.ground });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  return ground;
}

function createTrackRoad(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Mesh {
  const segments = detailLevel === 'full' ? 420 : detailLevel === 'balanced' ? 300 : 220;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const p = i / segments;
    const center = path.pointAt(p);
    const normal = path.normalAt(p);
    const left = center.clone().addScaledVector(normal, -DRIVABLE_HALF_WIDTH);
    const right = center.clone().addScaledVector(normal, DRIVABLE_HALF_WIDTH);
    positions.push(left.x, 0.02, left.z, right.x, 0.02, right.z);
    uvs.push(0, i / 18, 1, i / 18);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: track.palette.road,
    roughness: 0.82,
    metalness: 0.02,
  });
  const road = new THREE.Mesh(geometry, material);
  tagForValidation(road, 'road_marking', ['track_surface'], 1, { allowRoadOverlap: true, validationRadius: 0 });
  return road;
}

function createTrackCurbs(
  path: TrackPath,
  track: TrackDefinition,
  detailLevel: SceneDetailLevel,
): { group: THREE.Group; stats: { visualKerbSegments: number; kerbInstances: number } } {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xd62828 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
  const curbLateralHalfWidth = 0.36;
  const curbEdgeOverlap = 0.18;
  const curbOffset = DRIVABLE_HALF_WIDTH + curbLateralHalfWidth - curbEdgeOverlap;
  const geometry = new THREE.BoxGeometry(curbLateralHalfWidth * 2, 0.12, 1.8, 1, 1, 1);
  const redMatrices: THREE.Matrix4[] = [];
  const whiteMatrices: THREE.Matrix4[] = [];
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  const step = track.id === marinaTrackId ? 0.0035 : detailLevel === 'full' ? 0.006 : detailLevel === 'balanced' ? 0.008 : 0.011;
  const visualKerbs = track.readability?.apexes.length
    ? track.readability.apexes.map((apex) => ({ start: apex.kerb[0], end: apex.kerb[1], sides: [apex.side] }))
    : track.kerbZones.map(([start, end]) => ({ start, end, sides: [-1, 1] }));
  for (const { start, end, sides } of visualKerbs) {
    for (let p = start; p < end; p += step) {
      const pose = path.poseAt(p);
      for (const side of sides) {
        const matrix = new THREE.Matrix4();
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
        const position = pose.position.clone().addScaledVector(pose.normal, side * curbOffset);
        position.y = 0.1;
        matrix.compose(position, rotation, scale);
        if (Math.floor((p - start) / 0.012) % 2 === 0) redMatrices.push(matrix);
        else whiteMatrices.push(matrix);
      }
    }
  }

  const redKerbs = new THREE.InstancedMesh(geometry, red, Math.max(1, redMatrices.length));
  const whiteKerbs = new THREE.InstancedMesh(geometry, white, Math.max(1, whiteMatrices.length));
  redMatrices.forEach((matrix, index) => redKerbs.setMatrixAt(index, matrix));
  whiteMatrices.forEach((matrix, index) => whiteKerbs.setMatrixAt(index, matrix));
  redKerbs.count = redMatrices.length;
  whiteKerbs.count = whiteMatrices.length;
  redKerbs.instanceMatrix.needsUpdate = true;
  whiteKerbs.instanceMatrix.needsUpdate = true;
  tagForValidation(redKerbs, 'track_curb', ['racing_detail', 'track_edge'], redMatrices.length, { validationRadius: curbLateralHalfWidth, roadOverlapMode: 'curb_edge' });
  tagForValidation(whiteKerbs, 'track_curb', ['racing_detail', 'track_edge'], whiteMatrices.length, { validationRadius: curbLateralHalfWidth, roadOverlapMode: 'curb_edge' });
  group.add(redKerbs, whiteKerbs);
  return { group, stats: { visualKerbSegments: visualKerbs.length, kerbInstances: redMatrices.length + whiteMatrices.length } };
}

function createTrackEnvironment(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): { group: THREE.Group } {
  const group = new THREE.Group();
  group.name = `${track.id}-environment`;
  group.add(createVegetationClusters(path, track, detailLevel), createLandmarks(path, track));
  if (track.id === marinaTrackId) {
    group.add(createMarinaVistaLandmarks(path, track, detailLevel));
  }
  return { group };
}

function createVegetationClusters(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vegetation-and-background-buildings';
  const treeCount = detailLevel === 'full' ? 260 : detailLevel === 'balanced' ? 150 : 88;
  const buildingCount = detailLevel === 'full' ? 90 : detailLevel === 'balanced' ? 46 : 24;
  const treeTrunk = new THREE.CylinderGeometry(0.45, 0.58, 4, 10);
  const treeCrown = new THREE.ConeGeometry(2.1, 7.5, 18, 4);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3825 });
  const crownMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'alpine' ? 0xd8edf5 : 0x174f34 });
  const trunks = new THREE.InstancedMesh(treeTrunk, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(treeCrown, crownMat, treeCount);
  const buildingGeo = new THREE.BoxGeometry(7, 18, 7, 1, 3, 1);
  const buildingMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'city' ? 0x6e7f91 : 0xb8c3c7 });
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, buildingCount);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const buildingRadius = 4;
  const trackSegments = createTrackSegments(path);

  for (let i = 0; i < treeCount; i += 1) {
    const p = (i * 0.037 + 0.13) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const offset = 34 + (i % 13) * 3.1;
    const pose = path.poseAt(p, side * offset);
    scale.setScalar(0.75 + (i % 5) * 0.08);
    matrix.compose(new THREE.Vector3(pose.position.x, 2, pose.position.z), quat, scale);
    trunks.setMatrixAt(i, matrix);
    matrix.compose(new THREE.Vector3(pose.position.x, 7, pose.position.z), quat, scale);
    crowns.setMatrixAt(i, matrix);
  }

  for (let i = 0; i < buildingCount; i += 1) {
    const p = (i * 0.071 + 0.04) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const pose = path.poseAt(p, side * (58 + (i % 7) * 8));
    scale.set(0.7 + (i % 4) * 0.18, 0.7 + (i % 6) * 0.22, 0.7 + (i % 3) * 0.2);
    const position = keepOutsideProtectedRoadZone(new THREE.Vector3(pose.position.x, 8 * scale.y, pose.position.z), trackSegments, side, buildingRadius, 1.5);
    matrix.compose(position, quat, scale);
    buildings.setMatrixAt(i, matrix);
  }

  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  buildings.instanceMatrix.needsUpdate = true;
  tagForValidation(crowns, 'vegetation', ['environment_density', 'trackside_identity'], treeCount, { validationRadius: 2.1 });
  tagForValidation(buildings, 'trackside_prop', ['background_structure', 'environment_density'], buildingCount, { validationRadius: buildingRadius });
  group.add(trunks, crowns, buildings);
  return group;
}

function createLandmarks(path: TrackPath, track: TrackDefinition): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  for (const landmark of track.landmarks) {
    const pose = path.poseAt(landmark.at, 22);
    let mesh: THREE.Mesh;
    if (landmark.kind === 'tower') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.2, 34, 16), mat);
      mesh.position.y = 17;
    } else if (landmark.kind === 'bridge') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 6), mat);
      mesh.position.y = 8;
    } else if (landmark.kind === 'tunnel') {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(9, 1.8, 12, 24, Math.PI), mat);
      mesh.position.y = 4;
      mesh.rotation.z = Math.PI;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 12), mat);
      mesh.position.y = 3.5;
    }
    mesh.position.x = pose.position.x;
    mesh.position.z = pose.position.z;
    mesh.rotation.y = pose.yaw;
    mesh.name = `${track.id}-${landmark.label.toLowerCase().replaceAll(' ', '-')}`;
    tagForValidation(mesh, 'landmark', ['orientation', 'track_identity'], 1);
    group.add(mesh);
  }
  return group;
}

function createTracksideDetails(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): { group: THREE.Group; stats: TracksideDetailStats } {
  const group = new THREE.Group();
  group.name = 'trackside-atmosphere';

  const barrierPanels = detailLevel === 'full' ? 320 : detailLevel === 'balanced' ? 208 : 128;
  const barrierGeo = new THREE.BoxGeometry(4.4, 0.62, 0.18, 1, 1, 1);
  const barrierMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'city' ? 0x9ea8b4 : 0xd4d8dc });
  const barriers = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierPanels);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < barrierPanels; i += 1) {
    const p = (i % (barrierPanels / 2)) / (barrierPanels / 2);
    const side = i < barrierPanels / 2 ? -1 : 1;
    const pose = path.poseAt(p, side * (DRIVABLE_HALF_WIDTH + 2.35));
    const position = pose.position.clone();
    position.y = 0.48;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, scale);
    barriers.setMatrixAt(i, matrix);
  }
  barriers.instanceMatrix.needsUpdate = true;
  tagForValidation(barriers, 'guardrail', ['racing_detail', 'track_edge'], barrierPanels, { validationRadius: 0.45 });

  const sponsorBoards = detailLevel === 'full' ? 72 : detailLevel === 'balanced' ? 42 : 24;
  const boardGeo = new THREE.BoxGeometry(6.4, 2.1, 0.22, 1, 1, 1);
  const boardMat = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const boards = new THREE.InstancedMesh(boardGeo, boardMat, sponsorBoards);
  for (let i = 0; i < sponsorBoards; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const p = (0.035 + i * 0.029) % 1;
    const pose = path.poseAt(p, side * (DRIVABLE_HALF_WIDTH + 9 + (i % 3) * 1.1));
    const position = pose.position.clone();
    position.y = 1.2;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, scale);
    boards.setMatrixAt(i, matrix);
  }
  boards.instanceMatrix.needsUpdate = true;
  tagForValidation(boards, 'sponsor_sign', ['racing_detail', 'track_identity'], sponsorBoards, { validationRadius: 0.42 });

  const tireStackMatrices: THREE.Matrix4[] = [];
  const tireStackGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.75, 18, 1);
  const tireStackMat = new THREE.MeshLambertMaterial({ color: 0x0b0c0e });
  const tireStep = detailLevel === 'full' ? 0.016 : detailLevel === 'balanced' ? 0.024 : 0.034;
  for (const [start, end] of track.kerbZones) {
    for (let p = start; p < end; p += tireStep) {
      for (const side of [-1, 1]) {
        const pose = path.poseAt(p, side * (DRIVABLE_HALF_WIDTH + 6));
        const position = pose.position.clone();
        position.y = 0.38;
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
        scale.set(1, 0.9 + ((tireStackMatrices.length + track.difficulty) % 3) * 0.28, 1);
        const tireMatrix = new THREE.Matrix4();
        tireMatrix.compose(position, rotation, scale);
        tireStackMatrices.push(tireMatrix);
      }
    }
  }
  const tireStacks = new THREE.InstancedMesh(tireStackGeo, tireStackMat, Math.max(1, tireStackMatrices.length));
  tireStackMatrices.forEach((item, index) => tireStacks.setMatrixAt(index, item));
  tireStacks.count = tireStackMatrices.length;
  tireStacks.instanceMatrix.needsUpdate = true;
  tagForValidation(tireStacks, 'tire_wall', ['racing_detail', 'track_edge', 'runoff'], tireStackMatrices.length, { validationRadius: 0.78 });

  const brakingMarkers = createBrakingMarkers(path, track);

  const pitWallSegments = detailLevel === 'full' ? 26 : detailLevel === 'balanced' ? 18 : 12;
  const pitWallGeo = new THREE.BoxGeometry(2.4, 0.7, 0.34, 1, 1, 1);
  const pitWallMat = new THREE.MeshLambertMaterial({ color: 0xf3f5f8 });
  const pitWall = new THREE.InstancedMesh(pitWallGeo, pitWallMat, pitWallSegments);
  for (let i = 0; i < pitWallSegments; i += 1) {
    const pose = path.poseAt(0.895 + i * 0.0045, DRIVABLE_HALF_WIDTH + 1.6);
    const position = pose.position.clone();
    position.y = 0.36;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
    pitWall.setMatrixAt(i, matrix);
  }
  pitWall.instanceMatrix.needsUpdate = true;
  tagForValidation(pitWall, 'trackside_prop', ['racing_detail', 'pit_lane'], pitWallSegments, { validationRadius: 0.3 });

  const startGridMarks = 16;
  const gridGeo = new THREE.BoxGeometry(2.15, 0.035, 0.18, 1, 1, 1);
  const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gridMarks = new THREE.InstancedMesh(gridGeo, gridMat, startGridMarks);
  for (let i = 0; i < startGridMarks; i += 1) {
    const lane = i % 2 === 0 ? -1.45 : 1.45;
    const row = Math.floor(i / 2);
    const pose = path.poseAt(0.983 - row * 0.0058, lane);
    const position = pose.position.clone();
    position.y = 0.055;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
    gridMarks.setMatrixAt(i, matrix);
  }
  gridMarks.instanceMatrix.needsUpdate = true;
  tagForValidation(gridMarks, 'road_marking', ['start_line', 'racing_detail'], startGridMarks, { allowRoadOverlap: true, validationRadius: 0 });

  const marinaPit = track.id === marinaTrackId ? createPitLaneAndPaddock(path, track, detailLevel) : new THREE.Group();
  const tracksideProps = track.id === marinaTrackId ? createTracksideProps(path, track, detailLevel) : new THREE.Group();
  group.add(
    barriers,
    boards,
    tireStacks,
    brakingMarkers.group,
    pitWall,
    gridMarks,
    createStartFinishGantry(path, track),
    marinaPit,
    tracksideProps,
  );
  return {
    group,
    stats: {
      visualKerbSegments: 0,
      kerbInstances: 0,
      barrierPanels,
      sponsorBoards,
      tireStacks: tireStackMatrices.length,
      brakeBoardZones: brakingMarkers.brakeBoardZones,
      brakeBoardPanels: brakingMarkers.brakeBoards,
      brakeBoards: brakingMarkers.brakeBoards,
      brakeBoardPosts: brakingMarkers.brakeBoardPosts,
      apexPosts: brakingMarkers.apexPosts,
      readabilityMarkerInstances: brakingMarkers.brakeBoards + brakingMarkers.brakeBoardPosts + brakingMarkers.apexPosts,
      readabilityInstancedBatches: 3,
      pitWallSegments,
      startGridMarks,
      gantryLights: 5,
      instancedBatches: 8 + (track.id === marinaTrackId ? 9 : 0),
      totalInstances:
        barrierPanels +
        sponsorBoards +
        tireStackMatrices.length +
        brakingMarkers.brakeBoards +
        brakingMarkers.brakeBoardPosts +
        brakingMarkers.apexPosts +
        pitWallSegments +
        startGridMarks +
        (track.id === marinaTrackId ? marinaPit.userData.validationCount + tracksideProps.userData.validationCount : 0),
      validation: emptyEnvironmentValidationReport(track.id),
    },
  };
}

function createBrakingMarkers(
  path: TrackPath,
  track: TrackDefinition,
): { group: THREE.Group; brakeBoardZones: number; brakeBoards: number; brakeBoardPosts: number; apexPosts: number } {
  const group = new THREE.Group();
  group.name = 'braking-markers';
  const boardGeo = new THREE.BoxGeometry(1.35, 1.15, 0.18, 1, 1, 1);
  const postGeo = new THREE.BoxGeometry(0.18, 1.45, 0.18, 1, 1, 1);
  const apexGeo = new THREE.CylinderGeometry(0.28, 0.42, 1.35, 12, 1);
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd62828 });
  const boardMatrices: THREE.Matrix4[] = [];
  const postMatrices: THREE.Matrix4[] = [];
  const apexMatrices: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const boardScale = new THREE.Vector3(1, 1, 1);
  const boardDistances = [150, 100, 50];
  const brakeZones = track.readability?.brakeZones ?? track.kerbZones.map(([at]) => ({ at, side: 1 as const }));
  const apexMarkers = track.readability?.apexes ?? track.kerbZones.map(([start, end]) => ({ at: start + (end - start) * 0.5, side: 1 as const }));

  for (const brakeZone of brakeZones) {
    const markerSide = brakeZone.side;
    for (const meters of boardDistances) {
      const progress = wrapProgress(brakeZone.at - meters / (track.lengthKm * 1000));
      const pose = path.poseAt(progress, markerSide * (DRIVABLE_HALF_WIDTH + 5.5));
      const position = pose.position.clone();
      position.y = 1.28;
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw - Math.PI / 2);
      matrix.compose(position, rotation, boardScale);
      boardMatrices.push(matrix.clone());
      const postPosition = pose.position.clone();
      postPosition.y = 0.72;
      postPosition.addScaledVector(pose.normal, markerSide * 0.55);
      matrix.compose(postPosition, rotation, boardScale);
      postMatrices.push(matrix.clone());
    }
  }

  for (const apex of apexMarkers) {
    const apexPose = path.poseAt(apex.at);
    const apexPosition = apexPose.position.clone().addScaledVector(apexPose.normal, apex.side * (DRIVABLE_HALF_WIDTH + 1.55));
    apexPosition.y = 0.7;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), apexPose.yaw);
    matrix.compose(apexPosition, rotation, boardScale);
    apexMatrices.push(matrix.clone());
  }

  const brakeBoards = new THREE.InstancedMesh(boardGeo, whiteMat, Math.max(1, boardMatrices.length));
  const brakePosts = new THREE.InstancedMesh(postGeo, redMat, Math.max(1, postMatrices.length));
  const apexPosts = new THREE.InstancedMesh(apexGeo, redMat, Math.max(1, apexMatrices.length));
  boardMatrices.forEach((item, index) => brakeBoards.setMatrixAt(index, item));
  postMatrices.forEach((item, index) => brakePosts.setMatrixAt(index, item));
  apexMatrices.forEach((item, index) => apexPosts.setMatrixAt(index, item));
  brakeBoards.count = boardMatrices.length;
  brakePosts.count = postMatrices.length;
  apexPosts.count = apexMatrices.length;
  brakeBoards.instanceMatrix.needsUpdate = true;
  brakePosts.instanceMatrix.needsUpdate = true;
  apexPosts.instanceMatrix.needsUpdate = true;
  tagForValidation(brakeBoards, 'braking_marker', ['racing_detail', 'braking_reference'], boardMatrices.length, { validationRadius: 0.42 });
  tagForValidation(brakePosts, 'trackside_prop', ['racing_detail', 'braking_reference'], postMatrices.length, { validationRadius: 0.18 });
  tagForValidation(apexPosts, 'trackside_prop', ['racing_detail', 'apex_reference'], apexMatrices.length, { validationRadius: 0.42 });
  group.add(brakeBoards, brakePosts, apexPosts);
  return {
    group,
    brakeBoardZones: brakeZones.length,
    brakeBoards: boardMatrices.length,
    brakeBoardPosts: postMatrices.length,
    apexPosts: apexMatrices.length,
  };
}

function wrapProgress(progress: number): number {
  return ((progress % 1) + 1) % 1;
}

type RoadOverlapMode = 'blocked' | 'allowed' | 'curb_edge' | 'overhead' | 'exempt';

interface ValidationTagOptions {
  validationRadius?: number;
  allowRoadOverlap?: boolean;
  roadOverlapMode?: RoadOverlapMode;
}

interface ValidationCandidate {
  position: THREE.Vector3;
  name: string;
}

interface TrackSegment {
  start: THREE.Vector3;
  delta: THREE.Vector3;
  lengthSq: number;
  index: number;
}

function tagForValidation(
  object: THREE.Object3D,
  category: EnvironmentCategory,
  validationTags: string[],
  validationCount = 1,
  options: ValidationTagOptions = {},
): void {
  const roadOverlapMode = options.roadOverlapMode ?? defaultRoadOverlapMode(category);
  object.userData.category = category;
  object.userData.validationTags = validationTags;
  object.userData.validationCount = validationCount;
  object.userData.validationRadius = options.validationRadius ?? defaultValidationRadius(category);
  object.userData.allowRoadOverlap = options.allowRoadOverlap ?? (roadOverlapMode === 'allowed' || roadOverlapMode === 'overhead' || roadOverlapMode === 'exempt');
  object.userData.roadOverlapMode = roadOverlapMode;
}

export function validateTrackEnvironment(scene: THREE.Object3D, path: TrackPath, track: TrackDefinition): EnvironmentValidationReport {
  const counts = new Map<EnvironmentCategory, number>();
  const floatingObjects: EnvironmentFloatingObject[] = [];
  const roadObstructions: EnvironmentRoadOverlap[] = [];
  const curbIntrusions: EnvironmentRoadOverlap[] = [];
  let guardrailIntrusionCount = 0;
  let tireWallIntrusionCount = 0;
  let sponsorSignIntrusionCount = 0;
  let tracksidePropIntrusionCount = 0;
  const trackSegments = createTrackSegments(path);

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const category = object.userData.category as EnvironmentCategory | undefined;
    if (!category) return;
    const validationCount = Number(object.userData.validationCount ?? ((object as THREE.InstancedMesh).isInstancedMesh ? (object as THREE.InstancedMesh).count : 1));
    counts.set(category, (counts.get(category) ?? 0) + validationCount);
    const candidates = validationCandidates(object);
    const radius = validationRadiusForObject(object, category);
    for (const candidate of candidates) {
      if (category !== 'water_feature' && candidate.position.y < -0.12) floatingObjects.push(createFloatingObject(category, candidate));
      if (category === 'track_curb') {
        const curbIntrusion = createCurbIntrusion(category, candidate, trackSegments, radius);
        if (curbIntrusion) curbIntrusions.push(curbIntrusion);
        continue;
      }
      const roadOverlap = createRoadOverlap(category, candidate, trackSegments, radius, object);
      if (!roadOverlap) continue;
      roadObstructions.push(roadOverlap);
      if (category === 'guardrail') guardrailIntrusionCount += 1;
      if (category === 'tire_wall') tireWallIntrusionCount += 1;
      if (category === 'sponsor_sign') sponsorSignIntrusionCount += 1;
      if (category === 'trackside_prop') tracksidePropIntrusionCount += 1;
    }
  });

  const report: EnvironmentValidationReport = {
    trackId: track.id,
    curbCount: counts.get('track_curb') ?? 0,
    guardrailCount: counts.get('guardrail') ?? 0,
    tireWallCount: counts.get('tire_wall') ?? 0,
    brakingMarkerCount: counts.get('braking_marker') ?? 0,
    sponsorSignCount: counts.get('sponsor_sign') ?? 0,
    startFinishGantryCount: counts.get('start_finish_gantry') ?? 0,
    pitBuildingCount: counts.get('pit_building') ?? 0,
    marinaDockCount: counts.get('marina_dock') ?? 0,
    boatCount: counts.get('boat') ?? 0,
    waterFeatureCount: counts.get('water_feature') ?? 0,
    vegetationCount: counts.get('vegetation') ?? 0,
    tracksidePropCount: counts.get('trackside_prop') ?? 0,
    landmarkCount: counts.get('landmark') ?? 0,
    floatingObjectCount: floatingObjects.length,
    floatingObjects,
    roadObstructionCount: roadObstructions.length,
    roadObstructions,
    curbIntrusionCount: curbIntrusions.length,
    curbIntrusions,
    guardrailIntrusionCount,
    tireWallIntrusionCount,
    sponsorSignIntrusionCount,
    tracksidePropIntrusionCount,
    estimatedDetailScore: 0,
    passed: false,
    failureReasons: [],
  };
  report.estimatedDetailScore = estimateEnvironmentDetailScore(report);
  report.failureReasons = environmentFailureReasons(report);
  report.passed = report.failureReasons.length === 0;
  return report;
}

function emptyEnvironmentValidationReport(trackId: string): EnvironmentValidationReport {
  const report: EnvironmentValidationReport = {
    trackId,
    curbCount: 0,
    guardrailCount: 0,
    tireWallCount: 0,
    brakingMarkerCount: 0,
    sponsorSignCount: 0,
    startFinishGantryCount: 0,
    pitBuildingCount: 0,
    marinaDockCount: 0,
    boatCount: 0,
    waterFeatureCount: 0,
    vegetationCount: 0,
    tracksidePropCount: 0,
    landmarkCount: 0,
    floatingObjectCount: 0,
    floatingObjects: [],
    roadObstructionCount: 0,
    roadObstructions: [],
    curbIntrusionCount: 0,
    curbIntrusions: [],
    guardrailIntrusionCount: 0,
    tireWallIntrusionCount: 0,
    sponsorSignIntrusionCount: 0,
    tracksidePropIntrusionCount: 0,
    estimatedDetailScore: 0,
    passed: false,
    failureReasons: [],
  };
  report.failureReasons = environmentFailureReasons(report);
  return report;
}

export function getNearestTrackSample(position: THREE.Vector3, path: TrackPath): TrackRoadSample {
  return getNearestTrackSampleFromSegments(position, createTrackSegments(path));
}

export function estimateTrackLateralDistance(position: THREE.Vector3, path: TrackPath): number {
  return getNearestTrackSample(position, path).lateralDistance;
}

export function isInsideDrivableRoad(position: THREE.Vector3, path: TrackPath, radius = 0): boolean {
  return getNearestTrackSample(position, path).absoluteLateralDistance - radius < DRIVABLE_HALF_WIDTH;
}

export function isInsideProtectedRoadZone(position: THREE.Vector3, path: TrackPath, radius = 0): boolean {
  return getNearestTrackSample(position, path).absoluteLateralDistance - radius < PROTECTED_ROAD_HALF_WIDTH;
}

function createTrackSegments(path: TrackPath, segmentCount = VALIDATION_SEGMENTS): TrackSegment[] {
  return Array.from({ length: segmentCount }, (_, index) => {
    const start = path.pointAt(index / segmentCount);
    const end = path.pointAt((index + 1) / segmentCount);
    const delta = end.clone().sub(start);
    delta.y = 0;
    return {
      start,
      delta,
      lengthSq: Math.max(0.0001, delta.lengthSq()),
      index,
    };
  });
}

function validationCandidates(object: THREE.Object3D): ValidationCandidate[] {
  if ((object as THREE.InstancedMesh).isInstancedMesh) {
    const instanced = object as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const candidates: ValidationCandidate[] = [];
    for (let i = 0; i < instanced.count; i += 1) {
      instanced.getMatrixAt(i, matrix);
      worldMatrix.multiplyMatrices(instanced.matrixWorld, matrix);
      worldMatrix.decompose(position, rotation, scale);
      candidates.push({ position: position.clone(), name: `${object.name || object.userData.category || 'instanced-object'}#${i}` });
    }
    return candidates;
  }
  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  return [{ position, name: object.name || object.userData.category || 'object' }];
}

function getNearestTrackSampleFromSegments(position: THREE.Vector3, trackSegments: TrackSegment[]): TrackRoadSample {
  const target = new THREE.Vector3(position.x, 0, position.z);
  let bestPosition = trackSegments[0].start;
  let bestDelta = trackSegments[0].delta;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  let bestProgress = 0;

  for (const segment of trackSegments) {
    const toTarget = target.clone().sub(segment.start);
    const segmentProgress = Math.min(1, Math.max(0, toTarget.dot(segment.delta) / segment.lengthSq));
    const candidate = segment.start.clone().addScaledVector(segment.delta, segmentProgress);
    const distanceSq = target.distanceToSquared(candidate);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestPosition = candidate;
      bestDelta = segment.delta;
      bestProgress = (segment.index + segmentProgress) / trackSegments.length;
    }
  }

  const tangent = bestDelta.clone().normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const lateralDistance = target.clone().sub(bestPosition).dot(normal);
  return {
    position: bestPosition,
    tangent,
    normal,
    progress: bestProgress,
    lateralDistance,
    absoluteLateralDistance: Math.abs(lateralDistance),
  };
}

function keepOutsideProtectedRoadZone(
  position: THREE.Vector3,
  trackSegments: TrackSegment[],
  preferredSide: number,
  radius: number,
  clearance = 0,
): THREE.Vector3 {
  const adjusted = position.clone();
  const minimumLateralDistance = PROTECTED_ROAD_HALF_WIDTH + radius + clearance;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sample = getNearestTrackSampleFromSegments(adjusted, trackSegments);
    if (sample.absoluteLateralDistance - radius >= PROTECTED_ROAD_HALF_WIDTH + clearance) return adjusted;
    const side = sample.absoluteLateralDistance > 0.01 ? Math.sign(sample.lateralDistance) : Math.sign(preferredSide) || 1;
    adjusted.copy(sample.position).addScaledVector(sample.normal, side * minimumLateralDistance);
    adjusted.y = position.y;
  }
  return adjusted;
}

function createFloatingObject(category: EnvironmentCategory, candidate: ValidationCandidate): EnvironmentFloatingObject {
  return {
    category,
    name: candidate.name,
    x: roundCoordinate(candidate.position.x),
    y: roundCoordinate(candidate.position.y),
    z: roundCoordinate(candidate.position.z),
  };
}

function createCurbIntrusion(
  category: EnvironmentCategory,
  candidate: ValidationCandidate,
  trackSegments: TrackSegment[],
  radius: number,
): EnvironmentRoadOverlap | null {
  const sample = getNearestTrackSampleFromSegments(candidate.position, trackSegments);
  const roadIntrusion = DRIVABLE_HALF_WIDTH - (sample.absoluteLateralDistance - radius);
  if (roadIntrusion <= MAX_CURB_ROAD_INTRUSION) return null;
  return createRoadOverlapEntry(category, candidate, sample, DRIVABLE_HALF_WIDTH, radius);
}

function createRoadOverlap(
  category: EnvironmentCategory,
  candidate: ValidationCandidate,
  trackSegments: TrackSegment[],
  radius: number,
  object: THREE.Object3D,
): EnvironmentRoadOverlap | null {
  if (object.userData.allowRoadOverlap === true) return null;
  const sample = getNearestTrackSampleFromSegments(candidate.position, trackSegments);
  if (sample.absoluteLateralDistance - radius >= PROTECTED_ROAD_HALF_WIDTH) return null;
  return createRoadOverlapEntry(category, candidate, sample, PROTECTED_ROAD_HALF_WIDTH, radius);
}

function createRoadOverlapEntry(
  category: EnvironmentCategory,
  candidate: ValidationCandidate,
  sample: TrackRoadSample,
  allowedHalfWidth: number,
  radius: number,
): EnvironmentRoadOverlap {
  return {
    category,
    name: candidate.name,
    x: roundCoordinate(candidate.position.x),
    z: roundCoordinate(candidate.position.z),
    lateralDistance: roundCoordinate(sample.lateralDistance),
    allowedHalfWidth,
    radius,
  };
}

function validationRadiusForObject(object: THREE.Object3D, category: EnvironmentCategory): number {
  const radius = Number(object.userData.validationRadius);
  return Number.isFinite(radius) ? radius : defaultValidationRadius(category);
}

function defaultRoadOverlapMode(category: EnvironmentCategory): RoadOverlapMode {
  if (category === 'track_curb') return 'curb_edge';
  if (category === 'road_marking') return 'allowed';
  if (category === 'start_finish_gantry') return 'overhead';
  return 'blocked';
}

function defaultValidationRadius(category: EnvironmentCategory): number {
  switch (category) {
    case 'track_curb':
      return 0.36;
    case 'guardrail':
      return 0.45;
    case 'tire_wall':
      return 0.78;
    case 'sponsor_sign':
      return 0.42;
    case 'braking_marker':
      return 0.42;
    case 'pit_building':
      return 5.8;
    case 'road_marking':
    case 'start_finish_gantry':
    case 'water_feature':
    case 'marina_dock':
    case 'boat':
      return 0;
    case 'vegetation':
    case 'landmark':
    case 'trackside_prop':
    default:
      return 0.75;
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function estimateEnvironmentDetailScore(report: EnvironmentValidationReport): number {
  const thresholdEntries: Array<[number, number]> = [
    [report.curbCount, 60],
    [report.guardrailCount, 80],
    [report.tireWallCount, 30],
    [report.brakingMarkerCount, 9],
    [report.sponsorSignCount, 12],
    [report.startFinishGantryCount, 1],
    [report.pitBuildingCount, 1],
    [report.marinaDockCount, 2],
    [report.boatCount, 3],
    [report.waterFeatureCount, 1],
    [report.vegetationCount, 50],
    [report.tracksidePropCount, 80],
    [report.landmarkCount, 1],
  ];
  const detailRatio = thresholdEntries.reduce((total, [actual, threshold]) => total + Math.min(1, actual / threshold), 0);
  const qualityChecks = [
    report.floatingObjectCount,
    report.roadObstructionCount,
    report.curbIntrusionCount,
    report.guardrailIntrusionCount,
    report.tireWallIntrusionCount,
    report.sponsorSignIntrusionCount,
    report.tracksidePropIntrusionCount,
  ];
  const qualityRatio = qualityChecks.reduce((total, count) => total + (count === 0 ? 1 : 0), 0);
  return Math.round(((detailRatio + qualityRatio) / (thresholdEntries.length + qualityChecks.length)) * 100);
}

function environmentFailureReasons(report: EnvironmentValidationReport): string[] {
  const failures: string[] = [];
  const minimums: Array<[keyof EnvironmentValidationReport, number]> = [
    ['curbCount', 60],
    ['guardrailCount', 80],
    ['tireWallCount', 30],
    ['brakingMarkerCount', 9],
    ['sponsorSignCount', 12],
    ['startFinishGantryCount', 1],
    ['pitBuildingCount', 1],
    ['marinaDockCount', 2],
    ['boatCount', 3],
    ['waterFeatureCount', 1],
    ['vegetationCount', 50],
    ['tracksidePropCount', 80],
    ['landmarkCount', 1],
  ];
  for (const [key, minimum] of minimums) {
    const actual = report[key];
    if (typeof actual === 'number' && actual < minimum) failures.push(`${key} ${actual} < ${minimum}`);
  }
  if (report.floatingObjectCount !== 0) failures.push(`floatingObjectCount ${report.floatingObjectCount} !== 0`);
  if (report.roadObstructionCount !== 0) failures.push(`roadObstructionCount ${report.roadObstructionCount} !== 0`);
  if (report.curbIntrusionCount !== 0) failures.push(`curbIntrusionCount ${report.curbIntrusionCount} !== 0`);
  if (report.guardrailIntrusionCount !== 0) failures.push(`guardrailIntrusionCount ${report.guardrailIntrusionCount} !== 0`);
  if (report.tireWallIntrusionCount !== 0) failures.push(`tireWallIntrusionCount ${report.tireWallIntrusionCount} !== 0`);
  if (report.sponsorSignIntrusionCount !== 0) failures.push(`sponsorSignIntrusionCount ${report.sponsorSignIntrusionCount} !== 0`);
  if (report.tracksidePropIntrusionCount !== 0) failures.push(`tracksidePropIntrusionCount ${report.tracksidePropIntrusionCount} !== 0`);
  if (report.estimatedDetailScore < 80) failures.push(`estimatedDetailScore ${report.estimatedDetailScore} < 80`);
  return failures;
}

function logEnvironmentValidationReport(report: EnvironmentValidationReport): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const isDevelopmentHost = host === 'localhost' || host === '127.0.0.1' || host === '';
  if (!isDevelopmentHost) return;
  console.info('Marina Vista Environment Validation Report');
  console.table(report);
}

function createStartFinishGantry(path: TrackPath, track: TrackDefinition): THREE.Group {
  const pose = path.poseAt(0.992, 0);
  const gantry = new THREE.Group();
  gantry.name = 'start-finish-gantry';
  gantry.position.copy(pose.position);
  gantry.rotation.y = pose.yaw;

  const steel = new THREE.MeshLambertMaterial({ color: 0x23282e });
  const accent = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const red = new THREE.MeshBasicMaterial({ color: 0xe8141f });

  const leftColumn = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.2, 0.55), steel);
  leftColumn.name = 'start-finish-left-column';
  leftColumn.position.set(-7.25, 3.1, 0);
  const rightColumn = leftColumn.clone();
  rightColumn.name = 'start-finish-right-column';
  rightColumn.position.x = 7.25;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.55, 0.62), steel);
  beam.position.set(0, 6.25, 0);
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.8, 0.45), accent);
  lightBar.position.set(0, 5.6, -0.18);

  gantry.add(leftColumn, rightColumn, beam, lightBar);
  for (let i = 0; i < 5; i += 1) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8), red);
    light.position.set(-2.4 + i * 1.2, 5.6, -0.52);
    gantry.add(light);
  }
  tagForValidation(leftColumn, 'trackside_prop', ['racing_detail', 'start_finish_support'], 1, { validationRadius: 0.45 });
  tagForValidation(rightColumn, 'trackside_prop', ['racing_detail', 'start_finish_support'], 1, { validationRadius: 0.45 });
  tagForValidation(gantry, 'start_finish_gantry', ['racing_detail', 'start_finish'], 1, { roadOverlapMode: 'overhead', validationRadius: 0 });
  return gantry;
}

function createMarinaVistaLandmarks(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'marina-vista-landmarks';
  const water = createWaterFeature(path, track);
  const docks = createMarinaDocks(path, track, detailLevel);
  const boats = createBoatSet(path, track);
  const coastal = createCoastalBuildings(path, track, detailLevel);
  const tower = createMarinaTower(path, track);
  group.add(water, docks, boats, coastal, tower);
  group.userData.validationCount = 1 + (docks.userData.validationCount ?? 0) + (boats.userData.validationCount ?? 0) + (coastal.userData.validationCount ?? 0) + 1;
  return group;
}

function createWaterFeature(path: TrackPath, track: TrackDefinition): THREE.Group {
  const pose = path.poseAt(0.2, -78);
  const group = new THREE.Group();
  group.name = 'marina-water-edge';
  group.position.copy(pose.position);
  group.rotation.y = pose.yaw - Math.PI / 2;

  const water = new THREE.Mesh(new THREE.BoxGeometry(168, 0.08, 76, 1, 1, 1), new THREE.MeshPhongMaterial({ color: 0x237f93, specular: 0x78dce8, shininess: 34 }));
  water.position.set(0, -0.02, 0);
  const seaWall = new THREE.Mesh(new THREE.BoxGeometry(174, 1.25, 1.2, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xd9e2e8 }));
  seaWall.position.set(0, 0.58, 36.5);
  const edgeStripe = new THREE.Mesh(new THREE.BoxGeometry(174, 0.08, 0.18, 1, 1, 1), new THREE.MeshBasicMaterial({ color: track.palette.accent }));
  edgeStripe.position.set(0, 1.24, 35.82);
  tagForValidation(water, 'water_feature', ['marina_identity', 'environment_density'], 1, { roadOverlapMode: 'exempt', validationRadius: 0 });
  tagForValidation(seaWall, 'trackside_prop', ['marina_identity', 'track_edge'], 1, { validationRadius: 0.8 });
  tagForValidation(edgeStripe, 'trackside_prop', ['marina_identity', 'track_edge'], 1, { validationRadius: 0.2 });
  group.add(water, seaWall, edgeStripe);
  group.userData.validationCount = 3;
  return group;
}

function createMarinaDocks(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'marina-docks';
  const dockCount = detailLevel === 'battery' ? 2 : 4;
  const dockGeo = new THREE.BoxGeometry(4.6, 0.32, 23, 1, 1, 1);
  const railGeo = new THREE.BoxGeometry(0.24, 0.34, 21, 1, 1, 1);
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x9c7a50 });
  const railMat = new THREE.MeshLambertMaterial({ color: 0xf4f0df });
  const docks = new THREE.InstancedMesh(dockGeo, dockMat, dockCount);
  const rails = new THREE.InstancedMesh(railGeo, railMat, dockCount * 2);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < dockCount; i += 1) {
    const pose = path.poseAt(0.15 + i * 0.035, -75 - (i % 2) * 8);
    const position = pose.position.clone();
    position.y = 0.16;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, scale);
    docks.setMatrixAt(i, matrix);
    const left = position.clone().addScaledVector(pose.normal, -2.1);
    const right = position.clone().addScaledVector(pose.normal, 2.1);
    left.y = 0.56;
    right.y = 0.56;
    matrix.compose(left, rotation, scale);
    rails.setMatrixAt(i * 2, matrix);
    matrix.compose(right, rotation, scale);
    rails.setMatrixAt(i * 2 + 1, matrix);
  }
  docks.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  tagForValidation(docks, 'marina_dock', ['marina_identity', 'environment_density'], dockCount, { roadOverlapMode: 'exempt', validationRadius: 0 });
  tagForValidation(rails, 'trackside_prop', ['marina_identity', 'environment_density'], dockCount * 2, { validationRadius: 0.18 });
  group.add(docks, rails);
  group.userData.validationCount = dockCount * 3;
  return group;
}

function createBoatSet(path: TrackPath, track: TrackDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stylized-boat-set';
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const accentMat = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1d5566 });
  for (let i = 0; i < 3; i += 1) {
    const pose = path.poseAt(0.165 + i * 0.042, -92 - i * 4);
    const boat = new THREE.Group();
    boat.name = `marina-boat-${i + 1}`;
    boat.position.copy(pose.position);
    boat.position.y = 0.18;
    boat.rotation.y = pose.yaw + Math.PI / 2 + (i - 1) * 0.16;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.76, 2.2, 1, 1, 1), hullMat);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.2, 4), accentMat);
    bow.position.x = 4.05;
    bow.rotation.z = Math.PI / 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.35, 1, 1, 1), cabinMat);
    cabin.position.set(-0.7, 0.72, 0);
    boat.add(hull, bow, cabin);
    tagForValidation(boat, 'boat', ['marina_identity', 'landmark_detail'], 1, { roadOverlapMode: 'exempt', validationRadius: 0 });
    group.add(boat);
  }
  group.userData.validationCount = 3;
  return group;
}

function createCoastalBuildings(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'coastal-building-row';
  const buildingCount = detailLevel === 'full' ? 28 : detailLevel === 'balanced' ? 18 : 12;
  const buildingGeo = new THREE.BoxGeometry(8, 9, 8, 1, 2, 1);
  const roofGeo = new THREE.ConeGeometry(6.2, 1.6, 4);
  const buildingMat = new THREE.MeshLambertMaterial({ color: 0xf3ead5 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a8aa3 });
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, buildingCount);
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, buildingCount);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < buildingCount; i += 1) {
    const pose = path.poseAt(0.33 + i * 0.019, -48 - (i % 4) * 6);
    scale.set(0.8 + (i % 3) * 0.18, 0.75 + (i % 5) * 0.22, 0.72 + (i % 4) * 0.18);
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + ((i % 2) * 0.22 - 0.11));
    matrix.compose(new THREE.Vector3(pose.position.x, 4.5 * scale.y, pose.position.z), rotation, scale);
    buildings.setMatrixAt(i, matrix);
    matrix.compose(new THREE.Vector3(pose.position.x, 9.2 * scale.y, pose.position.z), rotation, scale);
    roofs.setMatrixAt(i, matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  tagForValidation(buildings, 'trackside_prop', ['marina_identity', 'background_structure'], buildingCount, { validationRadius: 4.4 });
  tagForValidation(roofs, 'trackside_prop', ['marina_identity', 'background_structure'], buildingCount, { validationRadius: 3.4 });
  group.add(buildings, roofs);
  group.userData.validationCount = buildingCount * 2;
  return group;
}

function createMarinaTower(path: TrackPath, track: TrackDefinition): THREE.Group {
  const pose = path.poseAt(0.56, -37);
  const group = new THREE.Group();
  group.name = 'marina-vista-control-tower';
  group.position.copy(pose.position);
  group.rotation.y = pose.yaw - Math.PI / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 18, 5.4, 1, 3, 1), new THREE.MeshLambertMaterial({ color: 0xf4f7f6 }));
  base.position.y = 9;
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.4, 3.2, 7.2, 1, 1, 1), new THREE.MeshLambertMaterial({ color: track.palette.accent }));
  top.position.y = 19.3;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8), new THREE.MeshBasicMaterial({ color: 0xff4555 }));
  beacon.position.y = 21.4;
  tagForValidation(group, 'landmark', ['marina_identity', 'orientation'], 1);
  group.add(base, top, beacon);
  group.userData.validationCount = 1;
  return group;
}

function createPitLaneAndPaddock(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const pose = path.poseAt(0.9, DRIVABLE_HALF_WIDTH + 16);
  const group = new THREE.Group();
  group.name = 'marina-pit-lane-and-paddock';
  group.position.copy(pose.position);
  group.rotation.y = pose.yaw - Math.PI / 2;
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf8f4e8 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x315f72 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x23262d });
  const accentMat = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const building = new THREE.Mesh(new THREE.BoxGeometry(42, 7.5, 11, 1, 2, 1), wallMat);
  building.position.set(0, 3.75, 0);
  tagForValidation(building, 'pit_building', ['pit_lane', 'racing_detail', 'marina_identity'], 1, { validationRadius: 5.7 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(44, 1.1, 12.2, 1, 1, 1), roofMat);
  roof.position.set(0, 8.1, 0);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(24, 1.25, 0.4, 1, 1, 1), accentMat);
  sign.position.set(0, 6.2, -5.75);
  tagForValidation(sign, 'sponsor_sign', ['marina_identity', 'racing_detail'], 1, { validationRadius: 0.42 });
  const garageCount = detailLevel === 'battery' ? 6 : 8;
  const doors = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 3.5, 0.24, 1, 1, 1), darkMat, garageCount);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < garageCount; i += 1) {
    matrix.compose(new THREE.Vector3(-17.5 + i * 5, 2.35, -5.72), rotation, scale);
    doors.setMatrixAt(i, matrix);
  }
  doors.instanceMatrix.needsUpdate = true;
  tagForValidation(doors, 'trackside_prop', ['pit_lane', 'garage_door'], garageCount, { validationRadius: 0.2 });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(40, 0.35, 4.8, 1, 1, 1), accentMat);
  awning.position.set(0, 4.2, -7.85);
  tagForValidation(awning, 'trackside_prop', ['pit_lane', 'racing_detail'], 1, { validationRadius: 2.5 });
  group.add(building, roof, sign, doors, awning);
  group.userData.validationCount = 1 + 1 + garageCount + 1;
  return group;
}

function createTracksideProps(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'marina-trackside-props';
  const lights = createTrackLights(path, detailLevel);
  const cones = createCones(path, detailLevel);
  const crates = createCrates(path, detailLevel);
  const bollards = createBollards(path, detailLevel);
  const flags = createFlags(path, track, detailLevel);
  const fencing = createFencing(path, detailLevel);
  const platform = createViewingPlatform(path, track);
  group.add(lights, cones, crates, bollards, flags, fencing, platform);
  group.userData.validationCount =
    (lights.userData.validationCount ?? 0) +
    (cones.userData.validationCount ?? 0) +
    (crates.userData.validationCount ?? 0) +
    (bollards.userData.validationCount ?? 0) +
    (flags.userData.validationCount ?? 0) +
    (fencing.userData.validationCount ?? 0) +
    (platform.userData.validationCount ?? 0);
  return group;
}

function createTrackLights(path: TrackPath, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'track-light-posts';
  const count = detailLevel === 'battery' ? 18 : 28;
  const postGeo = new THREE.BoxGeometry(0.22, 4.6, 0.22, 1, 1, 1);
  const lampGeo = new THREE.BoxGeometry(0.9, 0.28, 0.42, 1, 1, 1);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x24303a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
  const posts = new THREE.InstancedMesh(postGeo, postMat, count);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, count);
  placeRepeatedTrackside(path, count, 0.02, 0.036, DRIVABLE_HALF_WIDTH + 9.8, 2.3, posts, Math.PI / 2);
  placeRepeatedTrackside(path, count, 0.02, 0.036, DRIVABLE_HALF_WIDTH + 9.8, 4.75, lamps, Math.PI / 2);
  tagForValidation(posts, 'trackside_prop', ['lighting', 'racing_detail'], count, { validationRadius: 0.18 });
  tagForValidation(lamps, 'trackside_prop', ['lighting', 'racing_detail'], count, { validationRadius: 0.45 });
  group.add(posts, lamps);
  group.userData.validationCount = count * 2;
  return group;
}

function createCones(path: TrackPath, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  const count = detailLevel === 'battery' ? 22 : 34;
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.72, 10), new THREE.MeshLambertMaterial({ color: 0xff6b1a }), count);
  placeRepeatedTrackside(path, count, 0.05, 0.021, DRIVABLE_HALF_WIDTH + 3.8, 0.36, cones, 0);
  tagForValidation(cones, 'trackside_prop', ['cone', 'track_edge'], count, { validationRadius: 0.28 });
  group.add(cones);
  group.userData.validationCount = count;
  return group;
}

function createCrates(path: TrackPath, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  const count = detailLevel === 'battery' ? 14 : 22;
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.9, 1.1, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8f6b43 }), count);
  placeRepeatedTrackside(path, count, 0.18, 0.031, DRIVABLE_HALF_WIDTH + 14, 0.45, crates, 0.4);
  tagForValidation(crates, 'trackside_prop', ['service_prop', 'environment_density'], count, { validationRadius: 0.78 });
  group.add(crates);
  group.userData.validationCount = count;
  return group;
}

function createBollards(path: TrackPath, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  const count = detailLevel === 'battery' ? 24 : 36;
  const bollards = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 0.86, 10), new THREE.MeshLambertMaterial({ color: 0xf5f0df }), count);
  placeRepeatedTrackside(path, count, 0.08, 0.019, DRIVABLE_HALF_WIDTH + 5.2, 0.43, bollards, 0);
  tagForValidation(bollards, 'trackside_prop', ['bollard', 'track_edge'], count, { validationRadius: 0.22 });
  group.add(bollards);
  group.userData.validationCount = count;
  return group;
}

function createFlags(path: TrackPath, track: TrackDefinition, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  const count = detailLevel === 'battery' ? 10 : 16;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 2.2, 0.13, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xf7fbff }), count);
  const flags = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.48, 0.08, 1, 1, 1), new THREE.MeshBasicMaterial({ color: track.palette.accent }), count);
  placeRepeatedTrackside(path, count, 0.12, 0.041, DRIVABLE_HALF_WIDTH + 12.4, 1.1, posts, Math.PI / 2);
  placeRepeatedTrackside(path, count, 0.12, 0.041, DRIVABLE_HALF_WIDTH + 12.4, 2.05, flags, Math.PI / 2);
  tagForValidation(posts, 'trackside_prop', ['flag', 'marina_identity'], count, { validationRadius: 0.14 });
  tagForValidation(flags, 'trackside_prop', ['flag', 'marina_identity'], count, { validationRadius: 0.45 });
  group.add(posts, flags);
  group.userData.validationCount = count * 2;
  return group;
}

function createFencing(path: TrackPath, detailLevel: SceneDetailLevel): THREE.Group {
  const group = new THREE.Group();
  const count = detailLevel === 'battery' ? 24 : 38;
  const fences = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.7, 0.12, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xb7c3cb }), count);
  placeRepeatedTrackside(path, count, 0.24, 0.018, -(DRIVABLE_HALF_WIDTH + 7.6), 0.86, fences, Math.PI / 2);
  tagForValidation(fences, 'trackside_prop', ['fencing', 'track_edge'], count, { validationRadius: 0.22 });
  group.add(fences);
  group.userData.validationCount = count;
  return group;
}

function createViewingPlatform(path: TrackPath, track: TrackDefinition): THREE.Group {
  const pose = path.poseAt(0.62, DRIVABLE_HALF_WIDTH + 24);
  const group = new THREE.Group();
  group.name = 'marina-viewing-platform';
  group.position.copy(pose.position);
  group.rotation.y = pose.yaw + Math.PI / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 1.1, 7, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xdee8ee }));
  deck.position.y = 1.8;
  const shade = new THREE.Mesh(new THREE.BoxGeometry(17, 0.45, 7.6, 1, 1, 1), new THREE.MeshLambertMaterial({ color: track.palette.accent }));
  shade.position.y = 5.4;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 0.22, 1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  rail.position.set(0, 2.75, -3.65);
  tagForValidation(deck, 'trackside_prop', ['spectator_area', 'marina_identity'], 1, { validationRadius: 3.6 });
  tagForValidation(shade, 'trackside_prop', ['spectator_area', 'marina_identity'], 1, { validationRadius: 3.9 });
  tagForValidation(rail, 'trackside_prop', ['spectator_area', 'track_edge'], 1, { validationRadius: 0.3 });
  tagForValidation(group, 'landmark', ['spectator_area', 'orientation'], 1);
  group.add(deck, shade, rail);
  group.userData.validationCount = 4;
  return group;
}

function placeRepeatedTrackside(
  path: TrackPath,
  count: number,
  start: number,
  step: number,
  lateralOffset: number,
  y: number,
  mesh: THREE.InstancedMesh,
  yawOffset: number,
): void {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const pose = path.poseAt((start + i * step) % 1, side * Math.abs(lateralOffset));
    const position = pose.position.clone();
    position.y = y;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + yawOffset);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function createPodiumCeremony(path: TrackPath, track: TrackDefinition, finaleMode: boolean): PodiumCeremony {
  const pose = path.poseAt(0.03, DRIVABLE_HALF_WIDTH + 20);
  const group = new THREE.Group();
  group.name = finaleMode ? 'campaign-finale-podium' : 'race-podium';
  group.position.copy(pose.position);
  group.rotation.y = pose.yaw - Math.PI / 2;

  const baseMat = new THREE.MeshLambertMaterial({ color: 0xf5f7fb });
  const winnerMat = new THREE.MeshLambertMaterial({ color: finaleMode ? 0xffd166 : track.palette.accent });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x20252b });
  const lightMat = new THREE.MeshBasicMaterial({ color: finaleMode ? 0xfff2a8 : 0xffffff });

  const platformData = [
    { rank: 2 as const, x: -4.1, height: 0.9, width: 3.6, mat: baseMat },
    { rank: 1 as const, x: 0, height: 1.45, width: 4.1, mat: winnerMat },
    { rank: 3 as const, x: 4.1, height: 0.65, width: 3.6, mat: baseMat },
  ];
  const slots: PodiumCeremony['slots'] = [];

  for (const item of platformData) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(item.width, item.height, 3.4, 1, 1, 1), item.mat);
    platform.position.set(item.x, item.height / 2, 0);
    group.add(platform);
    slots.push({ rank: item.rank, position: new THREE.Vector3(item.x, item.height + 0.34, -0.15), yaw: group.rotation.y + Math.PI });
  }

  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(12.5, 4.2, 0.36, 1, 1, 1), darkMat);
  rearWall.position.set(0, 2.35, 2.2);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.72, 0.42, 1, 1, 1), winnerMat);
  banner.position.set(0, 3.55, 1.96);
  group.add(rearWall, banner);

  const rigMat = new THREE.MeshLambertMaterial({ color: 0x101316 });
  for (const x of [-5.8, 5.8]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.4, 0.28), rigMat);
    mast.position.set(x, 2.2, 1.1);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8), lightMat);
    light.position.set(x * 0.92, 4.45, -0.7);
    group.add(mast, light);
  }

  const confettiPieces = finaleMode ? 150 : 90;
  const confettiGeo = new THREE.BoxGeometry(0.18, 0.035, 0.08, 1, 1, 1);
  const confettiMat = new THREE.MeshBasicMaterial({ color: finaleMode ? 0xffd166 : track.palette.accent });
  const confetti = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiPieces);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < confettiPieces; i += 1) {
    const x = -5.8 + (i % 23) * 0.52;
    const y = 2.1 + (i % 11) * 0.28;
    const z = -1.8 + ((i * 7) % 31) * 0.12;
    rotation.setFromEuler(new THREE.Euler((i % 5) * 0.7, (i % 9) * 0.4, (i % 13) * 0.3));
    matrix.compose(new THREE.Vector3(x, y, z), rotation, scale);
    confetti.setMatrixAt(i, matrix);
  }
  confetti.instanceMatrix.needsUpdate = true;
  group.add(confetti);

  group.updateMatrixWorld(true);
  slots.forEach((slot) => {
    slot.position = group.localToWorld(slot.position.clone());
  });

  return {
    group,
    slots,
    stats: {
      platforms: 3,
      lightRigs: 2,
      confettiPieces,
      finaleMode,
    },
  };
}
