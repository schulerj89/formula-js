# Changelog

## 1.6.0 - 2026-06-26

- Added dynamic race commentary for player position gains and losses during active racing.
- Added priority and cooldown gating so position calls do not stomp start captions or radio warnings.
- Exposed race-commentary debug metrics and a deterministic smoke hook for browser tests.
- Added unit coverage for stable commentary event kinds, line IDs, priority, and focus racer targeting.

## 1.5.0 - 2026-06-26

- Added lightweight car-contact detection using visual track progress and lateral overlap.
- Added speed, tire, and damage penalties for realistic contact, with cooldowns to prevent repeated contact spam.
- Added player contact radio feedback and debug metrics for contact events and severity.
- Added unit and browser smoke coverage for contact, grid safety, and cooldown behavior.

## 1.4.0 - 2026-06-26

- Added active-race guidance for closing rivals, side-by-side threats, and upcoming braking zones.
- Added a compact third HUD guidance line under the live track map.
- Collapsed the full leaderboard on narrow mobile race screens to keep the forward road visible.
- Clamped leaderboard lap labels to the active event lap count.

## 1.3.0 - 2026-06-26

- Added CPU racecraft intent for corner braking, track-aware racing lines, traffic gaps, and overtaking lanes.
- Exposed CPU braking, overtake, corner-load, and target-speed metrics in the debug API.
- Fixed stopped racers gaining distance from a minimum lap tick.
- Added unit and browser smoke coverage for active CPU racecraft.

## 1.2.0 - 2026-06-26

- Added a live mobile race readout with an SVG track map, player/rival dots, and nearest ahead/behind gaps.
- Fixed Time Attack lap progression so visual grid placement no longer completes the first lap immediately.
- Changed tire and damage effects to cap top speed instead of compounding speed loss every frame.
- Added debug metrics and smoke coverage for the map, live replay recorder, and eight-second active-race window.

## 1.1.0 - 2026-06-26

- Added optional runtime playback for planned ElevenLabs MP3 music and voice assets.
- Preserved procedural WebAudio music and browser speech synthesis as fallbacks when generated files are absent.
- Added debug metrics for generated audio readiness, missing assets, playback events, and asset errors.
- Added unit and browser smoke coverage for the ElevenLabs runtime asset registry.

## 1.0.0 - 2026-06-26

- Added a world-space podium ceremony with three staged platforms, light rigs, and confetti.
- Staged the top three cars on the podium while parking non-podium cars out of the ceremony shot.
- Added campaign finale podium staging with denser confetti and winner-focused camera metrics.
- Added debug smoke hooks plus desktop/mobile podium and finale screenshots.

## 0.9.0 - 2026-06-26

- Added compact replay highlight events with timed Arthur, Mags, and Radio captions during replay playback.
- Extended replay byte accounting to include announcer event payloads.
- Updated the replay screen to show announcer-call count alongside frame count and estimated size.
- Added unit coverage for replay event ordering, damage calls, tire-wear calls, and finish commentary.

## 0.8.0 - 2026-06-26

- Added active-race audio feedback with gear/rev engine telemetry, harmonic engine shaping, tire scrub cues, and kerb/off-track thumps.
- Added radio ducking counters and engine-gain reduction for radio calls so critical warnings cut through the race mix.
- Exposed race-audio metrics for smoke tests while preserving the no-music-during-race rule.
- Added pure unit coverage for race-state-to-audio telemetry mapping.

## 0.7.0 - 2026-06-26

- Added instanced trackside atmosphere: Armco barriers, sponsor boards, tire stacks, pit wall segments, start grid marks, and a physical start gantry.
- Exposed trackside detail counts in debug metrics so browser smoke tests can verify the visual layer.
- Kept repeated trackside objects batched through `InstancedMesh` to protect draw-call and geometry budgets.
- Added 0.7.0 gameplay/menu screenshots covering the richer track environment.

## 0.6.0 - 2026-06-26

- Generated Meshy preview GLBs for the formula chassis, wheel, and driver kit under the per-asset byte cap.
- Added a non-blocking GLB asset manager with cloned resources, procedural fallback, and debug asset-status metrics.
- Enabled generated formula cars in high-detail mode while preserving procedural cars for battery/balanced modes.
- Updated browser smoke coverage to exercise the generated runtime path and revised performance budgets.

## 0.5.0 - 2026-06-26

- Added a mobile-readable five-red-light pre-race start sequence with countdown metrics.
- Added a tutorial panel with launch, braking, tyre, and damage guidance.
- Added Playwright coverage and artifacts for the pre-race lights state.
- Added a race-start decision doc for future timing/audio tuning.

## 0.4.0 - 2026-06-26

- Added player garage paint swatches for body and helmet customization.
- Added GPT-image-generated formula chassis, wheel, and driver reference images for the future Meshy pass.
- Added a Meshy-ready modular formula kit manifest with separate chassis, wheel, and driver targets.
- Added a runtime asset registry and asset-pipeline decision doc with GLB budgets and fallback rules.

## 0.3.0 - 2026-06-26

- Added four procedural WebAudio music themes for menu, pre-race, podium, and campaign finale states.
- Added announcer/radio speech hooks with British-voice browser synthesis fallback and explicit active-race music silence.
- Added ElevenLabs-safe asset planning/generation script plus a dry-run manifest for voice and music assets.
- Added audio direction and ElevenLabs pipeline decision docs, with tests and browser smoke coverage for audio state.

## 0.2.0 - 2026-06-25

- Added rotating title flyovers that preview multiple tracks before the player starts a race.
- Added compact replay recording and playback with bounded memory counters exposed in debug metrics.
- Added campaign scoring, standings, and a campaign finale podium with a stronger celebration camera.
- Added a performance budget decision doc, richer debug metrics, sequential browser budget smoke, and instanced kerbs to reduce draw overhead.

## 0.1.0 - 2026-06-25

- Scaffolded the Three.js racing game as `Gridline Apex`.
- Added a playable mobile-first race loop with title, campaign, time attack, settings, podium, and replay states.
- Added four procedural tracks with red/white kerbs, landmarks, trees, buildings, CPU racers, announcer captions, damage, tires, radio warnings, and performance metrics.
- Added build/test/screenshot tooling and GitHub Pages deployment workflow.
