# Browser Verification Split 1.34

The full Playwright suite is useful for broad regression confidence, but it takes several minutes because it includes campaign flow, replay playback, control layout, asset inspector, and repeat-race performance tests.

## Decision

- Keep `npm run screenshot` focused on `tests/screenshot.spec.ts`, which captures the menu and gameplay artifacts across mobile and desktop.
- Add `npm run screenshot:full` for the complete browser regression suite.
- Use the focused command for routine visual/menu/gameplay slices unless the code change touches campaign progression, replay, controls, asset loading, or performance lifecycle behavior.

## Verification

- Static checks and unit tests still run independently.
- The full regression suite remains one command away when broad browser coverage is warranted.
