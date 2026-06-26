# Generated Asset Loader 0.6

Date: 2026-06-26

## Context

The 0.4 asset pipeline established GPT-image reference art and a Meshy manifest for a modular formula car kit. Meshy's current Text-to-3D API requires `model_type` values from `standard` or `lowpoly`, and `topology` values from `quad` or `triangle`; the manifest was updated to those enums before generation.

Meshy preview generation was run from `tools/meshy/formula-kit.manifest.json` with `--preview-only`, matching Meshy's documented preview/retrieve workflow. The first chassis attempt produced an 11,385,816 byte GLB and was rejected by the local 6 MB asset cap. After lowering target polycounts, the generated preview kit landed at:

- `formula-chassis.glb`: 4,162,428 bytes.
- `formula-wheel.glb`: 547,468 bytes.
- `formula-driver.glb`: 1,891,104 bytes.

## Decision

Add a runtime `FormulaAssetManager` that warms GLBs in the background and exposes load state through debug metrics. Scene construction stays synchronous and asks for a car group through a factory. If all generated kit pieces are loaded and the player selects high-detail mode, the factory returns a generated car assembled from cloned GLB resources. Otherwise, it returns the existing procedural car.

Generated assets are cloned per scene car, including geometry and material instances, so `disposeScene()` can continue reclaiming scene resources without destroying cached loader sources.

## Consequences

- Battery and balanced modes keep the lower-cost procedural car path for mobile safety.
- High-detail mode now exercises the generated Meshy kit in runtime smoke tests.
- `assetStatus` metrics report planned ids, loaded ids, failed ids, fallback readiness, generated readiness, and active runtime mode.
- The current generated kit is preview quality, not refined quality; future Meshy refinement should keep the same byte cap and verify decoded geometry counts before making generated cars default.

References:

- Meshy Text-to-3D API: https://docs.meshy.ai/en/api/text-to-3d
- Meshy Image-to-3D API: https://docs.meshy.ai/en/api/image-to-3d
