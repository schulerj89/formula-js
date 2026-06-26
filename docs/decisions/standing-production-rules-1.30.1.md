# Standing Production Rules 1.30.1

Gridline Apex 1.30.1 turns the current production steer into durable repo rules and asset checks.

## Decisions

- Keep radio-team voice identity separate from the announcers: Radio lines use `ELEVENLABS_RADIO_VOICE_ID` and radio processing, never Arthur Bell or Mags Whitlow voice IDs.
- Keep the title page sparse. New title work should clarify the playable entry path or track preview without stacking explanatory copy.
- Review generated GLB/model assets in the isolated asset inspector before wiring them into the main game scene.
- When a domain decision is uncertain, create or use the relevant expert/subagent first, then record the accepted decision in `docs/decisions/`.

## Verification

- `audio:plan` now fails if a voice line's speaker and ElevenLabs voice-env assignment disagree.
- `audio:check` now validates the checked-in manifest uses the dedicated voice env for each speaker, including the Radio team.
