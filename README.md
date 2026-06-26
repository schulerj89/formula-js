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
- Campaign standings with a finale podium and winner celebration camera.
- Bounded end-of-race replay playback from compact race-state samples.
- Procedural menu, pre-race, podium, and finale music with no music during active racing.
- Announcer/radio speech hooks plus an ElevenLabs asset pipeline manifest.
- Player garage paint swatches for body and helmet customization.
- GPT-image reference art and a Meshy-ready manifest for modular chassis, wheel, and driver GLBs.
- Four procedural race circuits with red/white kerbs, trees, buildings, and landmarks.
- Player plus seven CPU drivers with static names.
- Press-to-go or split brake/go mobile controls.
- Damage, tire wear, race radio, leaderboard toggle, standings, and performance overlay.
- Procedural car, wheel, driver, and helmet models prepared for later Meshy asset swaps.
