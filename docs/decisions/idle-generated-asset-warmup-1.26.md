# Idle Generated Asset Warmup 1.26

Generated formula-kit GLBs are optional at startup because procedural cars already cover menu, race, replay, and podium scenes. Starting GLB warmup before the first rendered frame spends parsing and network work before the player can see the title scene.

## Decision

Generated asset warmup now starts after the first rendered frame:

- The procedural title/menu scene is built synchronously.
- The first animation-frame render schedules generated asset warmup.
- Browsers with `requestIdleCallback` start warmup from idle time with a timeout.
- Browsers without `requestIdleCallback` use a short timeout fallback.

Debug metrics expose whether warmup was scheduled, started, completed, which method started it, and the observed delay.

## Consequences

- First paint prioritizes the playable fallback scene and title UI.
- High-detail generated cars still become available once the background warmup completes.
- If a player starts a race immediately before warmup finishes, the procedural fallback remains correct.
