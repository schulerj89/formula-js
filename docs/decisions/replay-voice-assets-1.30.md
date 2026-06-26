# Replay Voice Assets 1.30

Date: 2026-06-26

## Decision

Plan generated ElevenLabs voice assets for fixed replay highlight lines only:

- `mags.replay.middle-sector-commitment`
- `radio.replay.damage-kerb-bite`
- `radio.replay.tires-fading-inputs`

## Reasoning

- These replay lines are stable text and can safely use generated MP3 assets.
- Replay opening and finish lines include track, player, and winner names, so pre-recording them now would either lose personalization or require many variants.
- Radio replay condition lines use the dedicated Radio voice ID and existing radio processing path.
- This advances generated replay commentary without increasing runtime requirements when MP3 files are absent.

## Follow-up

- Consider a generated replay opener only if a templated variant strategy preserves player and track specificity.
