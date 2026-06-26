# CPU Racecraft 1.3

Date: 2026-06-26

## Context

The 1.2 race fix made laps real, but CPU racers still drove with a fixed speed target and sinusoidal lateral drift. That made traffic look artificial and left no measurable concept of braking, racing line, or overtaking.

## Decision

Add a `CpuRacecraft` contract to each racer state. CPU updates now derive intent from existing track data:

- Kerb-zone proximity creates corner pressure and braking intent.
- Track difficulty and racer skill shape target speed.
- Corner pressure drives outside/inside lateral line choice.
- Nearby traffic within a short forward gap can trigger an attack lane and a small speed push.
- Tire wear responds to corner load and lateral load.

Remove the old minimum lap-distance tick so stopped cars cannot advance through frame count. Distance is now strictly speed-driven.

## Consequences

- CPU cars visibly spread into braking and passing lanes without adding assets.
- Debug metrics expose CPU braking count, overtake count, max corner load, nearest traffic gap, and maximum target speed.
- Unit tests cover stationary distance, corner braking, overtake intent, and live racecraft during a race stint.
- Future AI work can refine per-track braking metadata, car separation, and side-by-side warnings using the same state contract.
