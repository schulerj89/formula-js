# Mode Aware Controls 1.19

Date: 2026-06-26

## Context

The game supported `holdToGo` and `splitPedals` internally, but the race HUD always showed both Brake and Go. That made the hold-to-go mode less clear because releasing Go already applies braking.

## Decision

Make the on-screen controls reflect the active mode. Hold-to-go hides the Brake pedal, labels the primary pedal `Hold Go`, and gives it more thumb space. Split-pedals mode keeps separate Brake and Go buttons visible.

## Consequences

- Mobile players get a clearer control surface that matches the selected input model.
- Browser smoke now verifies both mobile layouts and exposes `metrics.controlLayout` for debugging.
