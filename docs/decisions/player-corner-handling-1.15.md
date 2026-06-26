# Player Corner Handling 1.15

Date: 2026-06-26

## Context

CPU racers already used track corner pressure for braking, racing-line targets, and overtaking, but player handling only reacted to throttle, brake, steering, off-track lateral position, tire caps, and damage caps. That made corner entries less readable than the CPU racecraft model.

## Decision

Add a lightweight player handling analyzer that uses the existing track kerb/corner zones. The player now has exposed handling metrics for corner load, grip, steering response, braking demand, and understeer. High-speed steering through loaded corners reduces grip and steering response, while tire and damage state further reduce available grip.

## Consequences

- The player car still completes a time attack lap inside the existing plausible timing bounds.
- Browser smoke can inspect player handling metrics through `window.__GRIDLINE_APEX__.metrics.playerHandling`.
- Future tuning can adjust the analyzer without coupling it to rendering or UI code.
