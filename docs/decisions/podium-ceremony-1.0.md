# Podium Ceremony 1.0

Date: 2026-06-26

## Context

The game already had race results, campaign standings, winner celebration animation, and an orbiting podium/finale camera. The scene itself still looked like a paused race because the top three cars were not staged on a visible podium.

## Decision

Add a procedural world-space podium ceremony:

- Three podium platforms with first, second, and third slots.
- Back wall, banner, two light rigs, and instanced confetti.
- Higher confetti count for the campaign finale.
- Top-three cars are positioned on ceremony slots.
- Non-podium cars are parked off the ceremony shot and hidden from the camera.

The presenter state exposes `podium` metrics: active state, focus racer id, top-three ids, staged/parked car counts, and ceremony stats. A debug hook drives deterministic browser screenshots for race podium and campaign finale coverage.

## Consequences

- The post-race payoff now has a visible race object, not only a DOM results panel.
- Finale staging no longer depends on last-race result data for the camera target.
- The ceremony remains procedural and low payload; no new asset files are added.
- Future work can replace podium props with authored/generated assets while preserving the same presenter contract.
