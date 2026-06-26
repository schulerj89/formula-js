import * as THREE from 'three';
import type { RacerDefinition, TrackDefinition } from '../types';
import { createFormulaCar } from './models';
import { TrackPath } from './trackPath';

export interface SceneBuild {
  path: TrackPath;
  cars: Map<string, THREE.Group>;
  detailStats: TracksideDetailStats;
}

export interface TracksideDetailStats {
  barrierPanels: number;
  sponsorBoards: number;
  tireStacks: number;
  pitWallSegments: number;
  startGridMarks: number;
  gantryLights: number;
  instancedBatches: number;
  totalInstances: number;
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

const roadWidth = 11;
type CarFactory = (racer: RacerDefinition) => THREE.Group;

export function buildRaceScene(scene: THREE.Scene, track: TrackDefinition, racers: RacerDefinition[], carFactory: CarFactory = defaultCarFactory): SceneBuild {
  disposeScene(scene);
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
  scene.add(createTrackRibbon(path));
  scene.add(createKerbs(path, track));
  scene.add(createScenery(path, track));
  scene.add(createLandmarks(path, track));
  const tracksideDetails = createTracksideDetails(path, track);
  scene.add(tracksideDetails.group);

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

  return { path, cars, detailStats: tracksideDetails.stats };
}

function defaultCarFactory(racer: RacerDefinition): THREE.Group {
  return createFormulaCar(racer.color, racer.helmet);
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if ('geometry' in mesh && mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material?.dispose();
    }
  });
}

function createGround(track: TrackDefinition): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(680, 680, 24, 24);
  const material = new THREE.MeshLambertMaterial({ color: track.palette.ground });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  return ground;
}

function createTrackRibbon(path: TrackPath): THREE.Mesh {
  const segments = 420;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const p = i / segments;
    const center = path.pointAt(p);
    const normal = path.normalAt(p);
    const left = center.clone().addScaledVector(normal, -roadWidth / 2);
    const right = center.clone().addScaledVector(normal, roadWidth / 2);
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
    color: 0x20252b,
    roughness: 0.82,
    metalness: 0.02,
  });
  return new THREE.Mesh(geometry, material);
}

function createKerbs(path: TrackPath, track: TrackDefinition): THREE.Group {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xd62828 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
  const geometry = new THREE.BoxGeometry(1.8, 0.12, 0.72, 1, 1, 1);
  const redMatrices: THREE.Matrix4[] = [];
  const whiteMatrices: THREE.Matrix4[] = [];
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (const [start, end] of track.kerbZones) {
    for (let p = start; p < end; p += 0.006) {
      const pose = path.poseAt(p);
      for (const side of [-1, 1]) {
        const matrix = new THREE.Matrix4();
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
        const position = pose.position.clone().addScaledVector(pose.normal, side * (roadWidth / 2 + 0.34));
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
  group.add(redKerbs, whiteKerbs);
  return group;
}

function createScenery(path: TrackPath, track: TrackDefinition): THREE.Group {
  const group = new THREE.Group();
  const treeTrunk = new THREE.CylinderGeometry(0.45, 0.58, 4, 10);
  const treeCrown = new THREE.ConeGeometry(2.1, 7.5, 18, 4);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3825 });
  const crownMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'alpine' ? 0xd8edf5 : 0x174f34 });
  const trunks = new THREE.InstancedMesh(treeTrunk, trunkMat, 260);
  const crowns = new THREE.InstancedMesh(treeCrown, crownMat, 260);
  const buildingGeo = new THREE.BoxGeometry(7, 18, 7, 1, 3, 1);
  const buildingMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'city' ? 0x6e7f91 : 0xb8c3c7 });
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, 90);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  for (let i = 0; i < 260; i += 1) {
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

  for (let i = 0; i < 90; i += 1) {
    const p = (i * 0.071 + 0.04) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const pose = path.poseAt(p, side * (58 + (i % 7) * 8));
    scale.set(0.7 + (i % 4) * 0.18, 0.7 + (i % 6) * 0.22, 0.7 + (i % 3) * 0.2);
    matrix.compose(new THREE.Vector3(pose.position.x, 8 * scale.y, pose.position.z), quat, scale);
    buildings.setMatrixAt(i, matrix);
  }

  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  buildings.instanceMatrix.needsUpdate = true;
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
    group.add(mesh);
  }
  return group;
}

function createTracksideDetails(path: TrackPath, track: TrackDefinition): { group: THREE.Group; stats: TracksideDetailStats } {
  const group = new THREE.Group();
  group.name = 'trackside-atmosphere';

  const barrierPanels = 320;
  const barrierGeo = new THREE.BoxGeometry(4.4, 0.62, 0.18, 1, 1, 1);
  const barrierMat = new THREE.MeshLambertMaterial({ color: track.scenery === 'city' ? 0x9ea8b4 : 0xd4d8dc });
  const barriers = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierPanels);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < barrierPanels; i += 1) {
    const p = (i % (barrierPanels / 2)) / (barrierPanels / 2);
    const side = i < barrierPanels / 2 ? -1 : 1;
    const pose = path.poseAt(p, side * (roadWidth / 2 + 2.15));
    const position = pose.position.clone();
    position.y = 0.48;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, scale);
    barriers.setMatrixAt(i, matrix);
  }
  barriers.instanceMatrix.needsUpdate = true;

  const sponsorBoards = 72;
  const boardGeo = new THREE.BoxGeometry(6.4, 2.1, 0.22, 1, 1, 1);
  const boardMat = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const boards = new THREE.InstancedMesh(boardGeo, boardMat, sponsorBoards);
  for (let i = 0; i < sponsorBoards; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const p = (0.035 + i * 0.029) % 1;
    const pose = path.poseAt(p, side * (roadWidth / 2 + 8.8 + (i % 3) * 1.1));
    const position = pose.position.clone();
    position.y = 1.2;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, scale);
    boards.setMatrixAt(i, matrix);
  }
  boards.instanceMatrix.needsUpdate = true;

  const tireStackMatrices: THREE.Matrix4[] = [];
  const tireStackGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.75, 18, 1);
  const tireStackMat = new THREE.MeshLambertMaterial({ color: 0x0b0c0e });
  for (const [start, end] of track.kerbZones) {
    for (let p = start; p < end; p += 0.016) {
      for (const side of [-1, 1]) {
        const pose = path.poseAt(p, side * (roadWidth / 2 + 5.6));
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

  const pitWallSegments = 26;
  const pitWallGeo = new THREE.BoxGeometry(2.4, 0.7, 0.34, 1, 1, 1);
  const pitWallMat = new THREE.MeshLambertMaterial({ color: 0xf3f5f8 });
  const pitWall = new THREE.InstancedMesh(pitWallGeo, pitWallMat, pitWallSegments);
  for (let i = 0; i < pitWallSegments; i += 1) {
    const pose = path.poseAt(0.895 + i * 0.0045, roadWidth / 2 + 1.25);
    const position = pose.position.clone();
    position.y = 0.36;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw + Math.PI / 2);
    matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
    pitWall.setMatrixAt(i, matrix);
  }
  pitWall.instanceMatrix.needsUpdate = true;

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

  group.add(barriers, boards, tireStacks, pitWall, gridMarks, createStartGantry(path, track));
  return {
    group,
    stats: {
      barrierPanels,
      sponsorBoards,
      tireStacks: tireStackMatrices.length,
      pitWallSegments,
      startGridMarks,
      gantryLights: 5,
      instancedBatches: 5,
      totalInstances: barrierPanels + sponsorBoards + tireStackMatrices.length + pitWallSegments + startGridMarks,
    },
  };
}

function createStartGantry(path: TrackPath, track: TrackDefinition): THREE.Group {
  const pose = path.poseAt(0.992, 0);
  const gantry = new THREE.Group();
  gantry.name = 'start-gantry';
  gantry.position.copy(pose.position);
  gantry.rotation.y = pose.yaw;

  const steel = new THREE.MeshLambertMaterial({ color: 0x23282e });
  const accent = new THREE.MeshLambertMaterial({ color: track.palette.accent });
  const red = new THREE.MeshBasicMaterial({ color: 0xe8141f });

  const leftColumn = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.2, 0.55), steel);
  leftColumn.position.set(-7.25, 3.1, 0);
  const rightColumn = leftColumn.clone();
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
  return gantry;
}

export function createPodiumCeremony(path: TrackPath, track: TrackDefinition, finaleMode: boolean): PodiumCeremony {
  const pose = path.poseAt(0.03, roadWidth / 2 + 20);
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
