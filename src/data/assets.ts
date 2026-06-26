export const formulaAssetManifest = {
  kit: 'formula-kit',
  version: '0.6.0',
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
    chassisTriangles: 120_000,
    wheelTriangles: 12_000,
    driverTriangles: 45_000,
    refinedAssetMaxBytes: 6_000_000,
  },
  generatedTriangles: {
    chassis: 117_892,
    wheel: 8_364,
    driver: 44_994,
  },
  generatedBytes: {
    chassis: 4_162_428,
    wheel: 547_468,
    driver: 1_891_104,
  },
};
