# Title Flyover Label 1.31

Gridline Apex 1.31.0 makes the title-menu track flyover readable without adding another title panel.

## Decisions

- Add a slim `Flyover` label under the wordmark that names the track currently used by the rotating menu camera.
- Keep the label separate from captions because menu captions are hidden and should not drive repeated preview chatter.
- Update the label whenever `menuPreviewTrack` changes and expose its visible state, text, and track ID in debug metrics.
- Keep the title layout sparse: the label is a small rule-backed identifier, not a full preview card or extra controls.

## Verification

- Playwright verifies the label is visible on the title page, starts on the selected track, and updates to match `previewTrack` after the menu cycle.
- Screenshot artifacts include the initial title menu and the cycled title flyover state.
