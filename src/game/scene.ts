import * as THREE from 'three';
import type { RacerDefinition, TrackDefinition } from '../types';
import { createFormulaCar } from './models';
import { TrackPath } from './trackPath';

export interface SceneBuild {
  path: TrackPath;
  cars: Map<string, THREE.Group>;
}

const roadWidth = 11;

export function buildRaceScene(scene: THREE.Scene, track: TrackDefinition, racers: RacerDefinition[]): SceneBuild {
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

  const cars = new Map<string, THREE.Group>();
  racers.forEach((racer, index) => {
    const car = createFormulaCar(racer.color, racer.helmet);
    car.position.y = 0.2;
    const pose = path.poseAt(0.985 - index * 0.006, (index % 2 === 0 ? -1 : 1) * (1.4 + Math.floor(index / 2) * 1.6));
    car.position.copy(pose.position);
    car.rotation.y = pose.yaw;
    scene.add(car);
    cars.set(racer.id, car);
  });

  return { path, cars };
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

  for (const [start, end] of track.kerbZones) {
    for (let p = start; p < end; p += 0.006) {
      const pose = path.poseAt(p);
      const material = Math.floor((p - start) / 0.012) % 2 === 0 ? red : white;
      for (const side of [-1, 1]) {
        const kerb = new THREE.Mesh(geometry, material);
        kerb.position.copy(pose.position).addScaledVector(pose.normal, side * (roadWidth / 2 + 0.34));
        kerb.position.y = 0.1;
        kerb.rotation.y = pose.yaw;
        group.add(kerb);
      }
    }
  }

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
