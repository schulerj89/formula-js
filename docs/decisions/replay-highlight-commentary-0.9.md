# Replay Highlight Commentary 0.9

Date: 2026-06-26

## Context

The replay system already stored compact race-state samples and could play back the latest completed race. It did not yet satisfy the presentation goal of end-of-race replays with announcers, because playback always used one generic caption.

## Decision

Store a compact `ReplayHighlightEvent` timeline with each finalized replay. Events contain only time, kind, speaker, optional focus racer, and short caption text. The event list is generated from replay duration, player name, track name, and final results:

- Opening call.
- Middle-sector move call.
- Optional damage call.
- Optional tire-wear call.
- Finish headline.

Playback tracks the wrapped replay time and emits events once as their timestamps pass, resetting the event index when the replay loops. Captions use text nodes rather than HTML injection because replay copy includes player-entered names. A short minimum caption gap prevents clustered replay calls from replacing each other immediately.

When replay frames have been dropped from the front of the ring buffer, finalization normalizes retained frame times to a retained replay window and generates events inside that retained duration.

## Consequences

- Replays now have timed Arthur, Mags, and Radio captions without storing heavy camera or DOM state.
- Replay camera focus can follow the highlighted racer, including rival winners in finish calls.
- Byte estimates include event payloads, keeping replay memory visible in debug metrics.
- Event generation is deterministic and unit-testable.
- Future highlight logic can add overtake/lap-specific events from recorded frames without changing playback code.
