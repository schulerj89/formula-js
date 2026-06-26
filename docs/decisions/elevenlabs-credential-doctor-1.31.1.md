# ElevenLabs Credential Doctor 1.31.1

Gridline Apex 1.31.1 adds a safe credential check after local generation could not proceed.

## Decisions

- Keep ElevenLabs credential discovery inside `scripts/generate-elevenlabs-assets.mjs` so plan, generate, and doctor commands use the same secret sources.
- Add `npm run audio:doctor` to validate API-key presence, provider authentication, and required Arthur/Mags/Radio voice-ID envs without printing any secret values.
- Sanitize provider generation failures to report HTTP status and remediation only. Do not echo ElevenLabs response bodies into terminal logs.
- Leave MP3 assets ungenerated until a valid API key and the three voice IDs are available locally.

## Current Blocker

- `audio:generate:partial` could not create music MP3s because the local API key was rejected by ElevenLabs.
- No local `ELEVENLABS_ARTHUR_VOICE_ID`, `ELEVENLABS_MAGS_VOICE_ID`, or `ELEVENLABS_RADIO_VOICE_ID` mappings were found.

## Verification

- `audio:doctor` now reports the current credential state without exposing keys.
- `audio:check` still verifies the checked-in manifest and planned/generated asset status.
