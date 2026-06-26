# Dynamic Race Commentary 1.6

## Context

The active race already had rotating ambient announcer lines and urgent radio warnings, but it did not react to clean position changes. That made overtakes and lost places feel quieter than contact, tire, or damage events.

## Decision

Add a pure `raceCommentary` selector for player position gains and losses. The selector returns stable event metadata (`kind`, `lineId`, `priority`, `speaker`, and `focusRacerId`) so tests can verify behavior without depending on rendered caption copy.

Runtime emission stays in `main.ts` because captions and speech are UI/audio concerns. The race loop calls dynamic commentary after HUD updates and before radio warnings, so radio still has the final word when contact, damage, or tire calls happen in the same frame.

## Constraints

- Suppress position calls during the first 3.5 seconds of green-flag running so the lights-out caption remains readable.
- Use a 4.4 second dynamic commentary cooldown to prevent chatter.
- Keep physics unchanged; the commentary layer only reads snapshots.
- Expose debug metrics and a deterministic `forcePositionGain` hook for smoke tests.

## Follow-ups

- Fold near-hazard side-by-side calls into the same priority path.
- Move damage/tire/contact radio into the same selector once priority arbitration grows beyond position calls.
