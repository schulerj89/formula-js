# Deferred GLTF Loader 1.25

The app needs generated chassis, wheel, and driver GLBs, but the race must stay mobile-first and playable with procedural fallbacks. The build was pulling the GLTF loader into the initial shared model chunk even though generated assets are optional until warmup completes.

## Decision

`FormulaAssetManager` now dynamically imports `GLTFLoader` during asset warmup instead of constructing it at module load.

- Procedural cars remain available synchronously for menu, race, replay, and podium scenes.
- Generated GLBs still warm in the background and become available for high-detail player cars.
- Asset metrics expose `loaderDeferred` and `loaderLoaded` so browser tests can verify the loader path.

## Consequences

- Initial game code does not need to parse the GLTF loader before the fallback scene can start.
- GLB loading failure marks all planned generated assets as failed and keeps the procedural fallback path intact.
- Bundle checks should continue tracking whether optional asset tooling leaks back into the startup path.
