# Shared Procedural Geometry Lifecycle 1.28

Procedural formula cars reuse module-level geometry objects for body, wings, wheels, helmet, driver, and cockpit pieces. Scene rebuilds previously traversed every mesh and called `dispose()` on every geometry, including those shared module resources.

## Decision

Shared procedural geometries are now marked with `userData.sharedResource`, and scene disposal retains those geometries while still disposing scene-owned resources.

- Disposal de-duplicates geometry and material releases within each scene cleanup pass.
- Debug metrics expose scene resource disposal counts.
- Unit coverage spies on a shared procedural geometry across a rebuild and verifies it is not disposed.
- Browser performance smoke verifies rebuilds retain shared geometries while disposing scene-owned resources.

## Consequences

- Repeated menu/race/podium scene rebuilds avoid unnecessary GPU buffer churn for procedural car fallback geometry.
- Scene-generated track, scenery, and podium resources continue to be disposed when replaced.
- Generated GLB car instances remain scene-owned clones and are still eligible for disposal.
