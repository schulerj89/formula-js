# Car Contact Damage 1.5

Date: 2026-06-26

## Context

The race model had off-track damage and tire wear, but cars could overlap without consequence. That weakened the requested damage/radio loop and made close racing less legible.

## Decision

Add a scalar contact model in `race.ts`:

- Pairwise checks across the eight race cars.
- Visual `progress` is used for longitudinal overlap so starting-grid spacing does not create false hits.
- A tighter formula-car hitbox gates real contact.
- Either-car cooldown suppresses repeated contact spam.
- Contact separates lateral positions, reduces speed, and applies tire/damage loss when realistic settings are enabled.

Expose contact metrics through the debug API and add a deterministic smoke hook for browser tests. Player contact can trigger a radio warning through the existing caption/audio path.

## Consequences

- Contact affects race state without mesh raycasts or asset-level collision.
- False launch-grid damage is covered by tests.
- Browser smoke verifies a player contact event, max severity, and radio-visible feedback.
- Future work can split near-miss warnings from true contact without changing the state shape.
