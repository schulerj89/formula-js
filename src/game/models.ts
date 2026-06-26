import * as THREE from 'three';

const bodyGeometry = new THREE.BoxGeometry(2.15, 0.42, 4.4, 4, 1, 8);
const noseGeometry = new THREE.ConeGeometry(0.64, 2.2, 5, 1);
const wingGeometry = new THREE.BoxGeometry(3.2, 0.12, 0.5, 4, 1, 1);
const wheelGeometry = new THREE.CylinderGeometry(0.44, 0.44, 0.36, 28, 3);
const helmetGeometry = new THREE.SphereGeometry(0.34, 24, 16);
const torsoGeometry = new THREE.CapsuleGeometry(0.24, 0.36, 6, 12);

export function createFormulaCar(color: number, helmet: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'procedural-formula-car';

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.72, metalness: 0.08 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.92 });
  const helmetPaint = new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.38, metalness: 0.1 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x111b2a, roughness: 0.2, metalness: 0.6 });

  const body = new THREE.Mesh(bodyGeometry, paint);
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(noseGeometry, paint);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.45, 2.75);
  nose.scale.set(0.8, 1, 0.56);
  group.add(nose);

  const frontWing = new THREE.Mesh(wingGeometry, paint);
  frontWing.position.set(0, 0.28, 3.36);
  group.add(frontWing);

  const rearWing = new THREE.Mesh(wingGeometry, paint);
  rearWing.position.set(0, 0.9, -2.36);
  rearWing.scale.set(1.08, 1.1, 1.15);
  group.add(rearWing);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.9, 2, 1, 2), dark);
  cockpit.position.set(0, 0.82, -0.35);
  group.add(cockpit);

  const driver = new THREE.Group();
  driver.name = 'customizable-driver';
  const torso = new THREE.Mesh(torsoGeometry, dark);
  torso.position.y = 0.98;
  const helmetMesh = new THREE.Mesh(helmetGeometry, helmetPaint);
  helmetMesh.name = 'customizable-helmet';
  helmetMesh.position.y = 1.36;
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.08), visor);
  visorMesh.position.set(0, 1.37, 0.28);
  driver.add(torso, helmetMesh, visorMesh);
  group.add(driver);

  const wheelPositions = [
    [-1.22, 0.34, 1.38],
    [1.22, 0.34, 1.38],
    [-1.22, 0.34, -1.58],
    [1.22, 0.34, -1.58],
  ] as const;

  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeometry, rubber);
    wheel.name = 'separate-wheel';
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  }

  group.scale.setScalar(0.86);
  return group;
}

export function animateDriverIdle(car: THREE.Group, elapsed: number, celebration = false): void {
  const driver = car.getObjectByName('customizable-driver');
  if (!driver) return;
  if (celebration) {
    driver.rotation.z = Math.sin(elapsed * 8) * 0.22;
    driver.rotation.x = Math.sin(elapsed * 4) * 0.08;
    driver.position.y = Math.abs(Math.sin(elapsed * 5)) * 0.12;
    return;
  }
  driver.rotation.z = Math.sin(elapsed * 1.5) * 0.025;
}
