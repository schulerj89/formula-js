# Replay Playback Smoke 1.18

Date: 2026-06-26

## Context

Replay recording and replay highlight generation had unit coverage, and podium UI exposed a Replay button. Browser smoke did not prove the completed-race replay path actually entered playback, advanced highlight commentary, and kept a replay scene alive.

## Decision

Expose grouped replay playback metrics, including the last delivered replay event, and add a desktop browser smoke that starts a time attack, records live replay samples, forces a race finish through the debug hook, opens replay from the podium, and waits for replay highlight commentary to advance.

## Consequences

- The browser suite now proves replay recording, replay launch, replay camera state, retained frame counts, and announcer/radio highlight events work together.
- Replay metrics remain available for future camera or replay UI tuning without parsing several top-level counters.
