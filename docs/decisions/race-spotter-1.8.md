# Race Spotter 1.8

## Context

The mobile race HUD already showed side threats and closing gaps, and the announcers reacted to position changes. The missing piece was an audio/caption spotter layer that warns the player when a rival is alongside or closing quickly.

## Decision

Extend the pure race commentary selector into an active-race event arbiter:

- `spotter-side` fires when `RaceReadabilitySummary.sideBySide` reports a nearby rival on the left or right.
- `spotter-closing` fires when the nearest car behind or ahead is closing quickly inside a short distance window.
- Spotter events use `Radio`, priority `3`, and stable line IDs so tests assert behavior rather than caption copy.
- Position-change announcer calls remain priority `2`.
- Critical contact, damage, and tire radio calls use priority `4`.

Runtime emission still happens in `main.ts`, but the race loop now calls one `updateRaceAnnouncements` path. The arbiter picks a single event before `showCaption` and `audio.speak`, so lower-priority spotter or announcer calls do not briefly start before critical radio in the same frame.

## Constraints

- Keep the existing 3.5 second green-flag suppression and 4.4 second commentary cooldown.
- Keep event selection pure and deterministic for unit tests.
- Expose `spotterCallouts`, dedupe suppression, `forceSideThreat`, and `forceAnnouncementConflict` debug hooks for browser smoke tests.
- Add no new assets or render cost.

## Follow-ups

- Merge critical contact/damage/tire radio into the same priority selector if the priority table grows again.
- Add race replay spotter highlight events once replay cameras support side-by-side framing.
