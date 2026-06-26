# Race Guidance 1.4

Date: 2026-06-26

## Context

The 1.2 map and 1.3 CPU racecraft made active races more readable, but the mobile HUD still needed actionable guidance. The full leaderboard also covered the forward road on narrow screens.

## Decision

Extend the race-readability summary with:

- Closing-rate flags for the nearest car ahead and behind.
- Side-by-side warning when a rival is close longitudinally and offset laterally.
- Next braking-zone distance and urgency from existing track kerb zones.

The HUD now shows a third compact guidance line for side threats or braking distance. On narrow mobile screens, the full leaderboard collapses so the map, gap labels, and road center remain visible. Desktop keeps the full leaderboard.

## Consequences

- Mobile players get a compact race panel without losing forward visibility.
- The readout is generated from existing race state and track data, so it adds no assets.
- Unit tests cover closing traffic, side warnings, and braking urgency.
- Browser smoke asserts mobile leaderboard collapse plus the new guidance metrics.
