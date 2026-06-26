# Track Specific Pre-Race Commentary 1.22

Date: 2026-06-26

## Context

The pre-race sequence introduced every circuit with one generic line. The game objective calls for Arthur and Mags to talk about the distinct track, competition, and lights before the race starts.

## Decision

Store two-line pre-race banks per track in `dialogue.preraceByTrack`, then build selected-track commentary at runtime with player-name substitution and stable debug line IDs. Keep the existing lights line after the track setup.

## Consequences

- Each circuit gets a distinct pre-race broadcast setup without changing the five-light timing.
- The new lines use browser speech or procedural fallback unless a later ElevenLabs pass generates dedicated MP3s.
- Tests verify every track has Arthur/Mags copy and browser metrics expose the selected line IDs.
