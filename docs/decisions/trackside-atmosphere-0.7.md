# Trackside Atmosphere 0.7

Date: 2026-06-26

## Context

The game already had four circuits, red/white kerbs, procedural scenery, landmarks, and generated player-car assets. The tracks still needed more race-day infrastructure to read as formula circuits from the gameplay camera: safety barriers, tire stacks, sponsor boards, a pit wall, grid marks, and a start gantry.

Repeated trackside furniture is a bad fit for unique GLBs at this stage. It appears many times around every circuit and would increase payload, decoded geometry, and disposal complexity without improving gameplay enough to justify streaming work yet.

## Decision

Add a `trackside-atmosphere` scene group built from low-cost geometry:

- Armco-style barrier panels as one `InstancedMesh`.
- Sponsor boards as one `InstancedMesh`.
- Tire stacks around kerb zones as one `InstancedMesh`.
- Pit wall segments as one `InstancedMesh`.
- Start grid marks as one `InstancedMesh`.
- A small start gantry made from a handful of simple meshes and five red lights.

Expose detail counts, instanced-batch count, and total instance count through `sceneDetails` in the debug API so browser smoke tests verify that the visual layer exists and remains batched.

## Consequences

- The scene gains hundreds of trackside objects with only a small draw-call increase.
- The start sequence now has matching world-space infrastructure instead of only DOM lights.
- Collision remains gameplay-proxy based; trackside objects are visual and do not add per-frame raycasts or mesh collision.
- Future high-detail passes can replace selected boards or gantry pieces with generated props, but repeated barrier/tire placement should remain instanced unless streaming is added.
