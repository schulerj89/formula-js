# Mobile Leaderboard Toggle 1.16

Date: 2026-06-26

## Context

The game had a leaderboard setting and desktop race-order panel, but mobile CSS hid the panel even when the setting was enabled. That kept the driving view clean, but it meant the requested toggleable race-order panel was not available on mobile.

## Decision

Add a compact `POS` button to the in-race readout on mobile. Mobile starts with the leaderboard collapsed; tapping the button opens the same race-order list and highlights the player row. Desktop keeps the existing behavior where the leaderboard is visible when the setting is enabled.

## Consequences

- Mobile drivers can inspect the full order without permanently covering the view.
- The button toggles only the open/collapsed state and does not rewrite the saved settings preference.
- Browser metrics expose `leaderboard.enabled`, `open`, `mobileCollapsed`, `rowCount`, and `playerPosition` for smoke tests.
