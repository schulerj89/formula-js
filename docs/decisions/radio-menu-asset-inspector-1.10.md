# Radio, Menu, and Asset Inspector 1.10

Gridline Apex 1.10.0 separates radio-team audio identity from the broadcast announcers, reduces title-page clutter, and adds an isolated asset QA path.

## Decisions

- Radio-team generated voice lines use `ELEVENLABS_RADIO_VOICE_ID`, not the Arthur or Mags announcer IDs.
- Browser speech fallback keeps the same `Radio` speaker label, but uses a lower-pitched compressed pit-wall profile.
- The title page keeps only Campaign and Time Attack as primary actions. Tutorial, Settings, Replay, and Asset Inspector move to smaller utility controls.
- `asset-inspector.html` is a standalone Vite page that loads generated GLBs and a procedural car without initializing the main race loop.
- When a domain decision is uncertain, the agent should consult the relevant expert/subagent and record the final decision here under `docs/decisions/`.

## Verification

- Unit tests assert the radio-team asset IDs and generated voice matching.
- Playwright verifies the title menu exposes the asset-inspector link.
- Playwright verifies the asset inspector is isolated from `Gridline Apex`, loads the chassis, wheel, and driver GLBs, reports render metrics, and supports model visibility toggles.
