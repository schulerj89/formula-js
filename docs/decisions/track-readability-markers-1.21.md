# Track Readability Markers 1.21

Date: 2026-06-26

## Context

The four circuits already had red/white kerbs and trackside atmosphere, but corner entry points were hard to read from the gameplay camera. Proper formula circuits need clear braking references and apex cues without adding heavy unique meshes.

## Decision

Add side-specific readability metadata to each circuit, then render instanced braking boards before each brake zone and red apex posts at declared apex/exit points. Visual red/white kerbs prefer that metadata while the broader existing kerb zones stay available for physics and braking guidance.

## Consequences

- Players get clearer turn-in and braking references on every circuit.
- Trackside detail metrics now include brake boards, board posts, apex posts, and the expanded instanced batch count.
- Tests verify the marker counts across all four circuits and performance detail levels.
