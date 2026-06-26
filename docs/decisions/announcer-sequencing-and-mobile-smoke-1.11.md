# Announcer Sequencing and Mobile Smoke 1.11

Gridline Apex 1.11.0 closes two verification gaps: paired announcer presentation and mobile performance confidence.

## Decisions

- Tutorial, pre-race, and replay presentation use a caption queue so Arthur Bell and Mags Whitlow can trade lines without a full cutscene system.
- Pre-race is slightly longer so the track setup, rival note, and lights warning all land before launch.
- Start-light beeps fire when visible lights advance, instead of playing as one burst at pre-race entry.
- Mobile browser smoke stays on balanced performance. Desktop smoke verifies high-detail generated car assembly.
- The debug overlay is opt-in through `?debug=1` or local storage so it does not cover mobile controls.

## Verification

- Unit tests assert key dialogue banks include both Arthur and Mags.
- Browser smoke asserts pre-race delivered both announcers before lights-out.
- Browser smoke asserts mobile balanced mode stays above a basic FPS floor and keeps the debug overlay hidden.
