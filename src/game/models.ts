import * as THREE from 'three';

const bodyGeometry = new THREE.BoxGeometry(2.15, 0.42, 4.4, 4, 1, 8);
const noseGeometry = new THREE.ConeGeometry(0.64, 2.2, 5, 1);
const wingGeometry = new THREE.BoxGeometry(3.2, 0.12, 0.5, 4, 1, 1);
const wheelGeometry = new THREE.CylinderGeometry(0.44, 0.44, 0.36, 28, 3);
const helmetGeometry = new THREE.SphereGeometry(0.34, 24, 16);
const torsoGeometry = new THREE.CapsuleGeometry(0.24, 0.36, 6, 12);
const armGeometry = new THREE.CapsuleGeometry(0.055, 0.46, 4, 8);
const visorGeometry = new THREE.BoxGeometry(0.46, 0.12, 0.08);

export interface DriverRigOptions {
  includeTorso?: boolean;
  suitObject?: THREE.Object3D | null;
}

export interface DriverRigSummary {
  hasDriver: boolean;
  hasTorso: boolean;
  hasHelmet: boolean;
  hasVisor: boolean;
  armCount: number;
  hasGeneratedSuit: boolean;
}

export function createFormulaCar(color: number, helmet: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'procedural-formula-car';

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.72, metalness: 0.08 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.92 });

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

  const driver = createDriverRig(helmet);
  driver.position.set(0, 0.73, -0.35);
  driver.userData.baseY = driver.position.y;
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

export function createDriverRig(helmet: number, options: DriverRigOptions = {}): THREE.Group {
  const includeTorso = options.includeTorso ?? true;
  const group = new THREE.Group();
  group.name = 'customizable-driver';
  group.userData.baseY = 0;

  const suitMaterial = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.72, metalness: 0.08 });
  const helmetPaint = new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.38, metalness: 0.1 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x111b2a, roughness: 0.2, metalness: 0.6 });

  if (options.suitObject) {
    options.suitObject.name = 'generated-driver-suit';
    group.add(options.suitObject);
  }

  if (includeTorso) {
    const torso = new THREE.Mesh(torsoGeometry, suitMaterial);
    torso.name = 'driver-torso';
    torso.position.y = 0.25;
    group.add(torso);
  }

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Mesh(armGeometry, suitMaterial);
    arm.name = side < 0 ? 'celebration-arm-left' : 'celebration-arm-right';
    arm.position.set(side * 0.23, 0.37, 0.05);
    arm.rotation.z = side * 0.34;
    group.add(arm);
  }

  const helmetMesh = new THREE.Mesh(helmetGeometry, helmetPaint);
  helmetMesh.name = 'customizable-helmet';
  helmetMesh.position.y = 0.63;
  const visorMesh = new THREE.Mesh(visorGeometry, visor);
  visorMesh.name = 'driver-visor';
  visorMesh.position.set(0, 0.64, 0.28);
  group.add(helmetMesh, visorMesh);
  return group;
}

export function animateDriverIdle(car: THREE.Group, elapsed: number, celebration = false, finale = false): void {
  const driver = car.getObjectByName('customizable-driver');
  if (!driver) return;
  const baseY = typeof driver.userData.baseY === 'number' ? driver.userData.baseY : driver.position.y;
  driver.userData.baseY = baseY;
  const leftArm = driver.getObjectByName('celebration-arm-left');
  const rightArm = driver.getObjectByName('celebration-arm-right');
  const helmet = driver.getObjectByName('customizable-helmet');
  if (celebration) {
    const energy = finale ? 1.55 : 1;
    driver.rotation.z = Math.sin(elapsed * 8) * 0.22 * energy;
    driver.rotation.x = Math.sin(elapsed * 4) * 0.08 * energy;
    driver.position.y = baseY + Math.abs(Math.sin(elapsed * (finale ? 7 : 5))) * 0.12 * energy;
    if (leftArm) leftArm.rotation.z = -0.95 - Math.sin(elapsed * 7) * 0.36 * energy;
    if (rightArm) rightArm.rotation.z = 0.95 + Math.cos(elapsed * 7) * 0.36 * energy;
    if (helmet) helmet.rotation.y = Math.sin(elapsed * 5) * 0.16 * energy;
    return;
  }
  driver.position.y = baseY;
  driver.rotation.z = Math.sin(elapsed * 1.5) * 0.025;
  driver.rotation.x = 0;
  if (leftArm) leftArm.rotation.z = -0.34 + Math.sin(elapsed * 1.4) * 0.035;
  if (rightArm) rightArm.rotation.z = 0.34 - Math.sin(elapsed * 1.4) * 0.035;
  if (helmet) helmet.rotation.y = Math.sin(elapsed * 1.2) * 0.025;
}

export function summarizeDriverRig(car: THREE.Group): DriverRigSummary {
  const driver = car.getObjectByName('customizable-driver');
  if (!driver) {
    return { hasDriver: false, hasTorso: false, hasHelmet: false, hasVisor: false, armCount: 0, hasGeneratedSuit: false };
  }
  return {
    hasDriver: true,
    hasTorso: Boolean(driver.getObjectByName('driver-torso')),
    hasHelmet: Boolean(driver.getObjectByName('customizable-helmet')),
    hasVisor: Boolean(driver.getObjectByName('driver-visor')),
    armCount: [driver.getObjectByName('celebration-arm-left'), driver.getObjectByName('celebration-arm-right')].filter(Boolean).length,
    hasGeneratedSuit: Boolean(driver.getObjectByName('generated-driver-suit')),
  };
}
