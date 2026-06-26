# Gridline Apex

Mobile-first Three.js formula racing game.

## Commands

- `npm run dev` starts the local game.
- `npm run build` typechecks and builds.
- `npm test` runs data/runtime tests.
- `npm run screenshot` captures menu and gameplay artifacts.
- `npm run audio:plan` refreshes the dry-run ElevenLabs audio manifest.
- `npm run audio:generate` generates ElevenLabs MP3s when voice IDs and an API key are configured locally.
- `npm run assets:meshy:preview` starts the Meshy preview workflow from the formula-kit manifest when a Meshy key is configured locally.

## Current Slice

- Title menu with track flyover camera.
- Campaign, time attack, settings, replay, and podium flow.
- Tutorial panel with launch, braking, tyre, and damage guidance.
- Five-red-light pre-race start sequence with announcer setup.
- Trackside atmosphere with Armco barriers, tire stacks, sponsor boards, pit wall, start grid marks, and a start gantry.
- World-space podium ceremony with staged top-three cars, winner celebration camera, and higher-confetti campaign finale.
- Bounded end-of-race replay playback from compact race-state samples with timed announcer/radio highlight calls.
- Procedural menu, pre-race, podium, and finale music with no music during active racing.
- Gear/rev-shaped formula engine audio with tire scrub, kerb/off-track thumps, and radio ducking metrics.
- Announcer/radio speech hooks plus optional ElevenLabs MP3 playback when generated assets exist.
- Procedural music and browser speech fallbacks when ElevenLabs assets are missing or blocked.
- Player garage paint swatches for body and helmet customization.
- GPT-image reference art, Meshy preview GLBs, and a runtime loader for modular chassis, wheel, and driver assets.
- Four procedural race circuits with red/white kerbs, trees, buildings, and landmarks.
- Player plus seven CPU drivers with static names.
- Press-to-go or split brake/go mobile controls.
- Damage, tire wear, race radio, leaderboard toggle, standings, and performance overlay.
- Procedural car fallback in battery/balanced modes, with generated GLB cars enabled in high-detail mode when all kit pieces load.
