# ElevenLabs Runtime Fallback 1.1

Date: 2026-06-26

## Context

The 0.3 audio slice established an ElevenLabs generation plan, but runtime playback still depended entirely on procedural WebAudio music and browser speech synthesis. The game needed a safe bridge so generated MP3 files can be dropped into `public/audio/elevenlabs/` without making local development or GitHub Pages fail when those files are absent.

## Decision

Add a small runtime asset registry for the planned ElevenLabs files:

- Four non-race music cues: menu, pre-race, podium, and finale.
- Three key voice lines: Arthur's pre-race setup, Mags' lights call, and the damage radio warning.

`RaceAudio.resume()` starts asset warmup after the player has interacted with the page. Warmup probes each expected MP3 with a `HEAD` request, creates `HTMLAudioElement` instances only for files that exist, and records missing or failed assets in debug metrics. When a generated cue is ready, it plays instead of the procedural cue. When a generated voice line is ready, it plays instead of browser speech synthesis. If an asset is missing, blocked, or not matched, the existing fallback path stays active.

## Consequences

- No generated MP3 payload is required for the game to run.
- Local dev, CI, and GitHub Pages can expose the same runtime code even while the dry-run manifest is the only committed audio artifact.
- Debug metrics report generated music readiness, generated voice readiness, missing asset count, generated playback events, fallback playback events, and playback/probe errors.
- Active race music remains silent; generated songs are only mapped to non-race cues.
- The generation script remains the only path that should call ElevenLabs APIs. Runtime only loads public static files and never reads secrets.
