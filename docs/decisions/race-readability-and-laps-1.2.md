# Race Readability And Laps 1.2

Date: 2026-06-26

## Context

The game had a position HUD and optional leaderboard, but active racing still lacked a compact spatial readout for mobile players. A separate race-flow issue also made Time Attack too short: cars visually started near the finish line, and the first wrap could count as a completed lap.

## Decision

Add a lightweight DOM/SVG race readout:

- Track outline projected from the existing `TrackDefinition.points`.
- One dot per racer, with the player dot highlighted.
- Nearest rival ahead and behind labels in meters.
- Debug metrics for map active state, racer-dot count, and gap values.

Race simulation now separates visual grid placement from completed race distance. Each racer starts with `distance = 0`, while visual `progress` still begins on the grid. Lap count, finish state, standings, replay recording, and result creation are based on cumulative driven distance rather than the first start-line wrap.

## Consequences

- Time Attack now requires a real driven lap after lights-out.
- The HUD lap label is bounded to the event's total laps, so `2/1` cannot appear.
- Browser smoke holds throttle for an eight-second active-race window and verifies the game is still racing.
- The map adds no GLB, texture, or audio payload and only creates eight SVG dots during active race scenes.
- Future AI and overtaking tuning can use the same cumulative distance and nearest-rival summary.
