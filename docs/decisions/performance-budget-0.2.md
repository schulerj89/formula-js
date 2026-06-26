# Performance Budget Decision 0.2

This document sets the 0.2.0 performance budget for Formula JS / Gridline Apex. The target is a mobile-first Three.js racing slice that holds a visible 60 fps race experience on a mid-range mobile viewport before desktop polish or high-detail mode is allowed to grow.

## Decision

- Treat `balanced` as the shipping baseline. `battery` may reduce pixel ratio, scenery density, and replay sampling. `highDetail` may exceed soft targets but must stay below hard crash gates.
- Keep WebGLRenderer as the baseline renderer for 0.2.0.
- Budget against the active race scene, not the title menu, because race view combines full HUD, eight cars, camera motion, radio captions, and track scenery.
- Prefer instanced or shared geometry for repeated scenery, barriers, kerbs, tire stacks, signs, and crowd props. Do not add per-prop meshes at track scale unless a smoke test proves the budget still holds.
- Replay capture must be a fixed-size ring buffer, not an unbounded array of snapshots.

## Render Budget

| Metric | 0.2 target | Hard gate | Notes |
| --- | ---: | ---: | --- |
| Render calls | 70-110 | 150 | Existing smoke gate is `<180`; 0.2 should tighten this as scenery expands. |
| Triangles | 70k-130k | 180k | Enough for procedural cars, ribbon track, instanced trees/buildings, kerbs, and landmarks. |
| Lines/points | 0-2k | 5k | Debug overlays must be hidden outside debug mode. |
| Geometries | 20-45 | 60 | Shared car parts, shared kerb geometry, and instanced scenery are expected. |
| Textures | 0-12 | 20 | Current slice is mostly material-color driven; added textures need explicit ownership and disposal. |
| Materials | 20-60 | 90 | Track themes may add variants, but cars and repeated props should reuse material pools. |
| Pixel ratio | 1.0-1.45 | 1.6 | `highDetail` can use 2.0 only outside mobile smoke gates. |

## Geometry And Texture Counts

- Track ribbon: one generated `BufferGeometry` per loaded track.
- Ground: one low-subdivision plane per loaded track.
- Kerbs: one shared box geometry and two shared materials for red/white segments. 0.2 should move dense kerb zones to instancing if calls rise above target.
- Cars: eight visible cars maximum for 0.2 race scenes. Car part geometries must stay module-level shared except intentionally customized driver pieces.
- Scenery: target three to six instanced scenery batches per track theme. Avoid unique mesh objects for repeated trees, buildings, barriers, crowd boards, and tire stacks.
- Landmarks: three to eight unique meshes per track, with simple primitive geometry unless a landmark replaces a larger scenery batch.
- Textures: no more than four small theme textures per loaded track in `balanced`; use atlases where practical. Keep decoded texture memory under 24 MB in `balanced`.

## Replay Memory Budget

- Replay ring buffer target: 90 seconds of race state at 10 Hz.
- Per sample: compact numeric state only. Store racer id index, progress, lateral offset, speed, lap, damage, tires, and event flags. Do not store cloned Three.js objects, vectors, matrices, DOM state, screenshots, or full `RaceSnapshot` objects.
- Target replay heap: under 1 MB for one race.
- Hard replay heap gate: 4 MB including highlight events and captions.
- Keep only the latest completed race replay in memory for 0.2. Persisted replay, if added, must serialize compact arrays and cap storage to one replay unless a later decision changes this.

## Debug Metrics Required

Expose these under `window.__GRIDLINE_APEX__.metrics` and show them in the debug overlay when enabled:

- `renderer.info.render.calls`
- `renderer.info.render.triangles`
- `renderer.info.render.points`
- `renderer.info.render.lines`
- `renderer.info.memory.geometries`
- `renderer.info.memory.textures`
- Frame time rolling `p50`, `p95`, and worst frame over the last 5 seconds.
- Estimated fps from the same rolling window.
- Current pixel ratio, viewport size, performance mode, state, and track id.
- Scene-owned counts: active cars, kerb meshes or instances, scenery batches, landmark meshes, and active materials.
- Replay counters: sample count, sample rate, estimated bytes, dropped samples, and stored event count.
- Asset counters once textures or models exist: loaded asset ids, decoded texture byte estimate, and load errors.

## Smoke-Test Gates

0.2.0 should add a mobile budget smoke test that enters Time Attack, waits through prerace, samples at least 8 seconds of active racing after warmup, and fails on these conditions:

- App not ready, wrong state, asset load errors, or missing race metrics.
- Mobile `balanced`: render calls `>= 150`.
- Mobile `balanced`: triangles `>= 180_000` or `< 30_000` after scene load. The lower bound catches blank or failed scene construction.
- Mobile `balanced`: geometries `>= 60`.
- Mobile `balanced`: textures `>= 20`.
- Mobile `balanced`: rolling p95 frame time `> 20 ms` in a visible/manual run. Playwright should record estimated headless fps, but this local environment is too noisy to fail CI on it until calibrated.
- Replay enabled: estimated replay bytes `>= 4 MB`, sample count grows beyond the configured ring capacity, or replay samples contain object-shaped snapshots.
- Debug overlay disabled by default in `battery` and `balanced`, with metrics still available through the test hook.
- No sustained heap growth after returning menu -> race -> menu -> race. If Chromium exposes `performance.memory`, used heap after the second warmup should not exceed first warmup by more than 15 MB.

## 0.2 Implementation Guidance

- If calls exceed budget, batch kerbs first, then barriers and signs, before removing visible track identity.
- If triangles exceed budget, reduce tree crown radial segments, building subdivisions, tire-stack detail, and landmark segments before reducing car readability.
- If frame time spikes but counts are within budget, inspect per-frame allocations, DOM HUD churn, audio scheduling, and replay writes.
- Keep transparent effects rare. Prefer opaque or alpha-tested materials for smoke, track paint, foliage, signs, and water-like surfaces.
- Any added postprocessing must be behind `highDetail` until mobile `balanced` remains inside the gates.
