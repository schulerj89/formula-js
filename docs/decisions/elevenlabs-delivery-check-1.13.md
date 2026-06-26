# ElevenLabs Delivery Check 1.13

Date: 2026-06-26

## Context

The runtime can already fall back to procedural music and browser speech when generated ElevenLabs MP3s are absent. That makes the game resilient, but it also means a stale manifest or missing radio voice ID could go unnoticed.

## Decision

Add a manifest verification command before generating real assets. The generator now reads ignored local env files only during real generation, keeps `ELEVENLABS_RADIO_VOICE_ID` separate from Arthur and Mags, and blocks full generation when voice IDs are missing unless `--allow-partial` is passed explicitly.

## Consequences

- `npm run audio:check` can be run without credentials and fails on stale generated statuses.
- `npm run audio:generate` is safer for a full production pass because it will not silently skip voice lines.
- `npm run audio:generate:partial` remains available for an intentional music-only or incomplete pass.
