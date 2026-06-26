export const formulaAssetManifest = {
  kit: 'formula-kit',
  version: '0.4.0',
  runtimeFallback: 'procedural-formula-car',
  referenceImages: {
    chassis: '/assets/reference/formula-kit/formula-chassis-reference.png',
    wheel: '/assets/reference/formula-kit/formula-wheel-reference.png',
    driver: '/assets/reference/formula-kit/formula-driver-reference.png',
  },
  plannedGlb: {
    chassis: '/assets/formula-kit/formula-chassis.glb',
    wheel: '/assets/formula-kit/formula-wheel.glb',
    driver: '/assets/formula-kit/formula-driver.glb',
  },
  budgets: {
    chassisTriangles: 180_000,
    wheelTriangles: 28_000,
    driverTriangles: 90_000,
    refinedAssetMaxBytes: 6_000_000,
  },
};
