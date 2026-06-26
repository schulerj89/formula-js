# Campaign Flow Smoke 1.12

Gridline Apex 1.12.0 verifies the real campaign progression path without making browser tests wait for four full race distances.

## Decisions

- Add a smoke-only `forceRaceFinish` debug hook that is available through the existing debug API.
- The hook only works once the app is in the `race` state, then calls the production `finishRace` path with deterministic standings.
- Browser smoke still clicks Campaign, Race, each Next Race button, and the Finale button, so podium rendering, campaign scoring, replay finalization, and finale staging are verified through the player-facing UI.
- Campaign flow coverage runs on desktop only to keep the normal artifact pass bounded. Mobile remains covered by the balanced race smoke.

## Verification

- Unit tests cover four-race campaign point accumulation.
- Playwright covers Campaign -> podium -> Next Race through all four tracks -> Finale.
- Campaign metrics expose mode, track index, track count, standings, and next action for smoke assertions.
