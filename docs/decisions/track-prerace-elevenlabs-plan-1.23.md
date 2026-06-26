# Track Pre-Race ElevenLabs Plan 1.23

Date: 2026-06-26

## Context

Track-specific pre-race commentary introduced eight new setup lines. Arthur's track setup lines are deterministic per circuit, but Mags' lines include the player-entered name.

## Decision

Add planned ElevenLabs assets for Arthur's four track-specific setup lines. Keep Mags' player-name lines on browser speech/procedural fallback until there is a runtime TTS path that can safely generate personalized lines.

## Consequences

- The manifest and generator now cover deterministic track-specific pre-race voice assets.
- Personalized Mags lines keep saying the actual entered player name instead of playing a canned MP3.
- Audio verification remains key-safe and does not require generated MP3s.
