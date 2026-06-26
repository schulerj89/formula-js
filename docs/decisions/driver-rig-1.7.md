# Driver Rig 1.7

## Context

The game already supported body and helmet paint swatches, plus a generated driver GLB in high-detail mode. The procedural fallback exposed a separate helmet, but the generated car path treated the driver as one tinted object. Podium celebration also read mostly as body bounce instead of a driver celebration.

## Decision

Create a shared driver-rig contract in `models.ts`:

- `customizable-driver` is the animated parent.
- `customizable-helmet` remains a separately tinted helmet piece.
- `driver-visor` keeps the helmet readable from the chase and podium cameras.
- `celebration-arm-left` and `celebration-arm-right` provide visible idle and podium motion.
- `generated-driver-suit` is attached under the same rig when the Meshy driver asset is available.

Generated high-detail cars now use the generated driver as a suit layer while keeping the customizable helmet, visor, and arm pieces procedural. That preserves the customization contract without requiring a remeshed or reauthored GLB for every helmet color.

## Constraints

- Do not add new GLB or texture payload for this slice.
- Keep the rig procedural and lightweight for all eight cars.
- Expose aggregate rig metrics through the debug API so browser smoke tests can verify the generated-player path.
- Track the actual generated GLB triangle counts: chassis 117,892, wheel 8,364, driver 44,994.
- Keep podium and finale animation deterministic and driven by the existing `animateDriverIdle` hook.

## Follow-ups

- Replace the procedural arms with a refined generated/rigged driver asset if a future Meshy pass can preserve the same named part contract.
- Add a distinct finale-only winner gesture once the podium camera has a closer driver framing.
