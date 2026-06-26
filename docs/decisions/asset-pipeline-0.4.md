# Formula Asset Pipeline 0.4

## Decision

0.4.0 keeps procedural vehicles as the guaranteed runtime fallback while establishing the GPT-image-first and Meshy-ready pipeline for the modular formula kit.

## Generated References

Reference images were generated first and copied into:

- `public/assets/reference/formula-kit/formula-chassis-reference.png`
- `public/assets/reference/formula-kit/formula-wheel-reference.png`
- `public/assets/reference/formula-kit/formula-driver-reference.png`

These are concept references for later Meshy GLB generation. They are not loaded by the race scene yet, so gameplay remains fast and deterministic.

## Planned Meshy Assets

Manifest:

```text
tools/meshy/formula-kit.manifest.json
```

Planned runtime GLBs:

- `public/assets/formula-kit/formula-chassis.glb`
- `public/assets/formula-kit/formula-wheel.glb`
- `public/assets/formula-kit/formula-driver.glb`

The kit is intentionally modular:

- Chassis excludes wheels and driver so body paint can be customized.
- Wheel is a standalone prop so rotation and future wheel physics can attach cleanly.
- Driver includes a separable helmet mesh for helmet customization and later rigging/animation.

## Runtime Fallback

The game continues to use procedural `createFormulaCar()` until GLB assets are generated, remeshed, reviewed, and budgeted.

Current runtime customization:

- Body paint swatches change the player chassis color.
- Helmet swatches change the player helmet color.
- CPU cars keep static paint schemes.

## Budgets

- Chassis target: 180k triangles, max 6 MB refined GLB.
- Wheel target: 28k triangles, max 6 MB refined GLB, reused four times.
- Driver target: 90k triangles, max 6 MB refined GLB.
- Collision remains primitive/code-authored, not mesh-derived.

## Generation Rule

Use the local Meshy key from `MESHY_API_KEY` or `C:/Users/joshs/Projects/meshy-api-key.txt`. Do not print or commit keys. Store generation metadata under `tools/meshy/generated/formula-kit/`.
