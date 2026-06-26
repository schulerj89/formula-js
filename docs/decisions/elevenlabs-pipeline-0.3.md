# ElevenLabs Asset Pipeline 0.3

## Decision

Gridline Apex will keep procedural WebAudio music and browser speech synthesis as the always-available fallback, then layer generated ElevenLabs MP3 assets on top when voice IDs and plan limits are confirmed.

## Official API Surface

- Text to speech uses `POST https://api.elevenlabs.io/v1/text-to-speech/:voice_id`.
- Music composition uses `POST https://api.elevenlabs.io/v1/music`.
- The generator script stores only file paths, prompts, statuses, and source endpoint URLs in `public/audio/elevenlabs/manifest.json`.
- API keys stay outside git. The script reads `ELEVENLABS_API_KEY` or `C:/Users/joshs/Projects/eleven-labs-api-key.txt` and never prints the key.

## Current 0.3 Scope

- Runtime has four procedural instrumental cues: menu, pre-race, podium, and campaign finale.
- Active race state explicitly stops music so engine/radio/controls stay readable.
- Announcer subtitles call an audio speech hook. Browser speech synthesis is used until generated MP3 assets exist.
- `npm run audio:plan` creates or refreshes a dry-run manifest.
- `npm run audio:generate` can generate MP3s later, after `ELEVENLABS_ARTHUR_VOICE_ID` and `ELEVENLABS_MAGS_VOICE_ID` are set.

## Asset Organization

Generated files belong under:

```text
public/audio/elevenlabs/
```

Expected files:

- `arthur-prerace.mp3`
- `mags-lights.mp3`
- `radio-damage.mp3`
- `menu-gridline-spark.mp3`
- `prerace-five-lights-rising.mp3`
- `podium-carbon-champagne.mp3`
- `finale-apex-parade.mp3`
- `manifest.json`

## Safety Rules

- Do not commit API keys, `.env`, request logs, raw account responses, or billing details.
- Prefer dry runs in CI and local verification.
- Generated audio should be reviewed before enabling it by default.
- Keep procedural fallback audio even after MP3s are added.
