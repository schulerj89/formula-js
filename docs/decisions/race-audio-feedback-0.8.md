# Race Audio Feedback 0.8

Date: 2026-06-26

## Context

The game had procedural menu/pre-race/podium/finale music, speech hooks, start beeps, and a basic persistent engine oscillator. Active racing needed more readable formula-car feedback while preserving the rule that no music plays after lights-out.

## Decision

Add a pure `analyzeRaceAudio()` helper that maps the current player state and controls into audio telemetry:

- Gear number.
- Normalized revs.
- Engine frequency and gain.
- Tire scrub load.
- Kerb load.
- Off-track load.

`RaceAudio.updateRaceFeedback()` uses that telemetry during active races to shape persistent engine and harmonic oscillators, gate tire scrub noise bursts, play sparse kerb/off-track thumps, and count gear-shift events. Radio calls still flow through the centralized speech path, where radio clicks and ducking counters live.

## Consequences

- Browser smoke can assert audio state through metrics without depending on actual speaker output.
- Race music remains silent because the race branch only updates feedback and never calls `playMusic()`.
- Tire and impact cues are event/cooldown based, avoiding per-frame oscillator churn.
- Future work can swap procedural cues for authored or ElevenLabs/SFX assets while keeping the same telemetry contract.
