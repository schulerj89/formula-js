# Marina Vista Environment 1.34

Marina Vista Circuit needed to read as a real waterfront racing venue from the gameplay camera, not a generic sparse blockout.

## Decision

- Keep the pass procedural and mobile-friendly: no required Meshy assets, no new runtime dependencies, and repeated detail stays batched or instanced.
- Add a Marina-only environment layer with water, docks, boats, coastal buildings, pit/paddock building, viewing platform, marina control tower, lights, fencing, cones, crates, bollards, flags, and service props.
- Tag environment objects with `userData.category`, `userData.validationTags`, and `userData.validationCount`.
- Validate Marina Vista after scene creation with required detail counts, approximate road-obstruction checks, floating-object checks, and a detail score.
- Expose the validation report through `sceneDetails.validation`, log a dev-console table on localhost, and show the pass/fail status in the existing debug overlay.

## Rationale

The existing scene already had road ribbon, kerbs, barriers, tire stacks, sponsor boards, braking boards, and landmarks, but most of that was generic across tracks. Marina Vista needed identity-specific density: water edge, docks, boats, pit infrastructure, and trackside service clutter that tells the player they are racing at a coastal street circuit.

The validator is count-based plus approximate because gameplay collision remains authored in the race model rather than mesh-derived. It still catches the old sparse style by failing missing categories and score thresholds.

## Verification

- Unit tests prove an empty Marina scene fails validation and the balanced Marina build passes all thresholds.
- Browser screenshot smoke now runs the gameplay artifact on Marina Vista and asserts the scene validation report passes.
- Optional future Meshy briefs live in `assets/meshy/meshy_asset_briefs.json`; they are not required for runtime.
