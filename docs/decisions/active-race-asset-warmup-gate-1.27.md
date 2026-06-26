# Active Race Asset Warmup Gate 1.27

Generated formula-kit GLBs improve high-detail presentation, but they are optional. If the player starts a race before the idle warmup callback fires, beginning GLB parsing and downloads during pre-race or active driving can compete with the frame budget.

## Decision

Generated asset warmup now starts only while the app is in `menu` or `setup`.

- If the idle/timeout callback fires during pre-race, race, replay, podium, or finale, warmup becomes pending.
- The pending warmup retries when the app returns to a menu/setup scene.
- Debug metrics report pending state, blocked state, and deferral count.

## Consequences

- Fast-start players get procedural cars immediately without optional GLB work during launch or active racing.
- High-detail generated cars still become available once the player returns to menu/setup or waits there.
- Browser coverage now forces the idle callback during pre-race and verifies warmup remains pending until the menu returns.
