# Gridline Apex

Mobile-first Three.js formula racing game.

## Commands

- `npm run dev` starts the local game.
- `npm run build` typechecks and builds.
- `npm test` runs data/runtime tests.
- `npm run screenshot` captures menu, gameplay, and asset-inspector artifacts.
- `npm run audio:plan` refreshes the dry-run ElevenLabs audio manifest.
- `npm run audio:check` verifies the ElevenLabs manifest and generated MP3 status.
- `npm run audio:generate` generates ElevenLabs MP3s when all voice IDs and an API key are configured locally.
- `npm run audio:generate:partial` explicitly allows generation with missing voice IDs for a music-only or partial pass.
- `npm run assets:meshy:preview` starts the Meshy preview workflow from the formula-kit manifest when a Meshy key is configured locally.

## Local Audio Credentials

Keep ElevenLabs credentials outside git. The generator reads `ELEVENLABS_API_KEY`, `ELEVENLABS_ARTHUR_VOICE_ID`, `ELEVENLABS_MAGS_VOICE_ID`, and `ELEVENLABS_RADIO_VOICE_ID` from the environment, `.env.local`, `C:/Users/joshs/Projects/elevenlabs-voice-ids.env`, or `C:/Users/joshs/Projects/.env`. The radio team intentionally uses `ELEVENLABS_RADIO_VOICE_ID`, separate from the announcers.

## Current Slice

- Decluttered title menu with track flyover camera, primary race actions, and secondary utility links.
- Campaign, time attack, settings, replay, and podium flow.
- Browser smoke coverage clicks through the Campaign podium and Finale path using deterministic race finishes.
- Tutorial panel with launch, braking, tyre, and damage guidance.
- Five-red-light pre-race start sequence with announcer setup.
- Queued Arthur/Mags caption exchanges for tutorial, pre-race, replay, podium, and finale beats.
- Trackside atmosphere with Armco barriers, tire stacks, sponsor boards, pit wall, start grid marks, and a start gantry.
- World-space podium ceremony with staged top-three cars, winner celebration camera, and higher-confetti campaign finale.
- Queued podium/finale announcer summaries that call out the winner, player finish, top three, and campaign standings.
- Bounded end-of-race replay playback from compact race-state samples with timed announcer/radio highlight calls.
- Procedural menu, pre-race, podium, and finale music with no music during active racing.
- Gear/rev-shaped formula engine audio with tire scrub, kerb/off-track thumps, and radio ducking metrics.
- Announcer/radio speech hooks plus optional ElevenLabs MP3 playback when generated assets exist.
- Radio team lines use their own planned ElevenLabs voice ID and a compressed pit-wall fallback profile.
- Procedural music and browser speech fallbacks when ElevenLabs assets are missing or blocked.
- ElevenLabs manifest verification that keeps generated/planned audio files aligned with runtime asset IDs.
- Dynamic active-race commentary for position gains/losses with cooldown and radio-priority metrics.
- Player garage paint swatches for body and helmet customization.
- GPT-image reference art, Meshy preview GLBs, and a runtime loader for modular chassis, wheel, and driver assets.
- Isolated asset inspector page for checking generated GLBs and the procedural fallback away from the main game.
- Shared driver rig with separate customizable helmet, visor, generated suit support, idle motion, and podium celebration arms.
- Generated asset metadata tracks actual GLB triangles to keep high-detail mode under the browser render budget.
- Four procedural race circuits with red/white kerbs, trees, buildings, and landmarks.
- Player plus seven CPU drivers with static names.
- Press-to-go or split brake/go mobile controls.
- Damage, tire wear, race radio, leaderboard toggle, standings, and performance overlay.
- Lightweight car-contact damage with speed loss, separation, and radio feedback.
- Live track map with player/rival dots plus nearest ahead/behind race gaps.
- Compact race guidance for closing traffic, side threats, and upcoming braking zones.
- Active-race spotter radio for side-by-side threats and fast-closing traffic, with priority metrics.
- Real driven-lap progression for time attack and campaign races.
- CPU racers with corner braking, racing-line targets, traffic gaps, and overtaking lanes.
- Procedural car fallback in battery/balanced modes, with generated GLB cars enabled in high-detail mode when all kit pieces load.
