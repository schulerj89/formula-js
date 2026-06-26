# Changelog

## 1.29.2 - 2026-06-26

- Added stable `lineId` and `radioKey` metadata to replay highlight events so replay commentary can be matched to planned/generated voice lines.
- Exposed replay event metadata in debug metrics and added unit/browser coverage for replay line identity.

## 1.29.1 - 2026-06-26

- Latched critical damage and tyre radio warnings per race so low-health calls do not alternate every frame once both systems are critical.
- Kept replay tyre-condition highlights on the radio voice to match active-race low-health warnings.
- Exposed delivered radio warning keys in debug metrics and added unit coverage for the damage-then-tyre warning sequence.

## 1.29.0 - 2026-06-26

- Reworked the title into a CSS-only motorsport wordmark with split-line styling, race-accent bars, and local fallback fonts.
- Added menu debug metrics and browser coverage for the wordmark treatment, zero letter spacing, and non-overlap with primary actions.

## 1.28.1 - 2026-06-26

- Tightened `AGENTS.md` so uncertain domain decisions explicitly require creating or using the relevant expert/subagent and recording the outcome in `docs/decisions/`.
- Reaffirmed the durable guidance for radio-team voice identity, decluttered title flow, isolated asset inspection, and version-slice progress lists.

## 1.28.0 - 2026-06-26

- Marked shared procedural car geometries as retained resources so scene rebuilds do not dispose reusable fallback geometry.
- De-duplicated scene geometry/material disposal and exposed resource lifecycle counters in debug metrics.
- Added unit and browser coverage for shared geometry retention across scene rebuilds.

## 1.27.0 - 2026-06-26

- Gated optional generated formula-kit warmup so it will not start during pre-race, active race, replay, podium, or finale phases.
- Added warmup pending, blocked-state, and deferral debug metrics.
- Added a browser smoke that forces a fast-start pre-race warmup callback and verifies generated assets wait until the menu returns.

## 1.26.0 - 2026-06-26

- Moved generated formula-kit warmup behind the first rendered frame using idle/timeout scheduling.
- Added debug metrics for generated asset warmup scheduling, start method, completion, and delay.
- Expanded unit and browser coverage for cold fallback startup and deferred warmup behavior.

## 1.25.0 - 2026-06-26

- Deferred `GLTFLoader` behind the generated formula-kit warmup path so procedural gameplay starts without parsing optional GLB tooling.
- Added loader metrics for deferred/loaded generated-asset state.
- Added unit/browser coverage and a build-bundle verifier for the deferred loader contract.

## 1.24.0 - 2026-06-26

- Routed generated radio-team voice MP3s through a narrow, compressed WebAudio radio filter chain.
- Added debug metrics and unit coverage proving generated radio lines keep radio processing and race-audio ducking.
- Captured the version-slice progress-list rule in `AGENTS.md`.

## 1.23.0 - 2026-06-26

- Added planned ElevenLabs assets for Arthur's track-specific pre-race setup lines.
- Kept Mags' player-name pre-race lines on browser speech fallback so entered names remain accurate.
- Updated the audio generator, manifest, and tests for the expanded pre-race voice plan.

## 1.22.0 - 2026-06-26

- Added track-specific pre-race commentary banks for all four circuits.
- Queued Arthur/Mags pre-race lines from the selected track before the five-light setup.
- Exposed pre-race commentary line IDs in debug metrics and added unit/browser coverage.

## 1.21.0 - 2026-06-26

- Added metadata-driven braking boards before every kerb zone to make corner entries easier to read.
- Added side-specific visual kerbs and red apex marker posts across all four circuits.
- Exposed trackside marker metrics and expanded unit/browser coverage for the circuit readability budget.

## 1.20.0 - 2026-06-26

- Decluttered the default title page by hiding full race setup controls until Garage or a race mode is selected.
- Added a Garage utility action that preserves mobile access to name, track, body paint, helmet paint, and Race.
- Added menu debug metrics and browser coverage for the collapsed and expanded setup states.

## 1.19.0 - 2026-06-26

- Made on-screen race controls visually match the selected control mode.
- Hid the Brake pedal and widened the Go pedal in hold-to-go mode.
- Kept separate Brake and Go pedals visible in split-pedals mode.
- Added browser coverage and debug metrics for the active control layout.

## 1.18.0 - 2026-06-26

- Added replay playback debug metrics for active state, duration, event progress, focus racer, last delivered replay event, and retained frame count.
- Added a browser smoke that completes a race, opens replay playback from the podium, and verifies highlight commentary advances.
- Added replay budget and replay scene assertions to the browser verification script.

## 1.17.0 - 2026-06-26

- Added scene lifecycle metrics for race scene rebuild counts and active car counts.
- Added a mobile repeat-race performance smoke that runs menu -> race -> podium -> menu -> race.
- Added regression gates for repeated mobile render calls, triangles, geometries, textures, materials, replay bytes, and heap growth when Chromium exposes heap counters.
- Included the repeat-race smoke in the browser verification script.

## 1.16.0 - 2026-06-26

- Added a mobile in-race `POS` button that opens the leaderboard on demand without default HUD clutter.
- Kept desktop leaderboard behavior unchanged when the leaderboard setting is enabled.
- Highlighted the player row in the leaderboard and exposed leaderboard open/row/player-position metrics.
- Updated browser smoke coverage for mobile collapsed/open leaderboard behavior.

## 1.15.0 - 2026-06-26

- Added corner-aware player handling that uses track kerb/corner pressure, tire health, damage, and steering load.
- Reduced player grip and steering response when carrying too much speed through loaded corners.
- Exposed player handling metrics for browser smoke and debug inspection.
- Added unit coverage for corner grip loss and live race handling snapshots.

## 1.14.0 - 2026-06-26

- Reduced active-race per-frame churn by caching car wheel references and avoiding repeated child scans.
- Avoided redundant HUD, leaderboard, and track-map DOM writes during race updates.
- Throttled expensive debug metric sorting to a fixed cadence while keeping the test hook live.
- Tightened mobile balanced smoke gates back to the documented calls, triangle, and geometry hard budgets.

## 1.13.0 - 2026-06-26

- Added an ElevenLabs asset verification script that checks manifest statuses, duplicate IDs, and generated MP3 presence.
- Made the ElevenLabs generator load ignored local env files only for real generation without exposing credential values.
- Guarded full audio generation so missing voice IDs do not silently create a partial asset set unless explicitly requested.
- Added test coverage that keeps the manifest aligned with runtime audio IDs and the dedicated radio-team voice ID.

## 1.12.0 - 2026-06-26

- Added a deterministic campaign finish smoke hook that still uses the real race-finish, replay, podium, scoring, and finale transitions.
- Added browser coverage for the Campaign -> podium -> Next Race -> Finale UI path without waiting for four full races.
- Exposed campaign progress metrics for smoke tests and debug inspection.
- Added unit coverage for four-race campaign point accumulation.

## 1.11.0 - 2026-06-26

- Added a reusable caption queue so Arthur and Mags can trade tutorial, pre-race, and replay lines instead of only showing the first line.
- Extended pre-race lead-in timing so both announcers speak before lights-out, with start beeps tied to visible light activation.
- Kept mobile browser smoke on balanced performance while desktop still verifies high-detail generated cars.
- Hid the debug overlay unless explicitly requested with `?debug=1` or `gridline.debug=true`, keeping mobile controls clear.

## 1.10.0 - 2026-06-26

- Split planned radio-team ElevenLabs lines onto a dedicated `ELEVENLABS_RADIO_VOICE_ID` with contact, damage, and tire call assets.
- Decluttered the title menu by separating primary race actions from utility links and tightening the race setup panel.
- Added an isolated asset inspector page for generated chassis, wheel, driver, and procedural fallback QA.
- Added smoke coverage for the asset inspector and documented the unsure-decision expert/subagent rule in `AGENTS.md`.

## 1.9.0 - 2026-06-26

- Added queued podium and campaign-finale commentary that names the winner, player result, top three, and championship standings.
- Replaced immediate back-to-back finale captions with a sequenced post-race commentary queue.
- Exposed caption and podium-commentary debug metrics for browser smoke tests.
- Added generated-voice single-channel playback so future ElevenLabs podium/finale lines cannot overlap.

## 1.8.0 - 2026-06-26

- Added active-race spotter calls for side-by-side threats and fast-closing traffic.
- Added a single active-race announcement arbiter so contact/damage/tire radio beats spotter calls, and spotter calls beat normal position chatter.
- Added deterministic debug hooks and metrics for spotter callouts, dedupe suppression, and same-frame announcement conflicts.
- Added unit and browser smoke coverage for event kinds, priorities, line IDs, focus racers, and critical-radio conflict resolution.

## 1.7.0 - 2026-06-26

- Added a shared customizable driver rig with named helmet, visor, and celebration arm parts.
- Attached the same rig contract to generated high-detail cars so helmet customization remains separate from the generated driver suit.
- Expanded podium/finale celebration animation with arm and helmet motion while preserving idle cockpit motion.
- Updated generated-asset triangle metadata from the actual GLBs and exposed driver-rig debug metrics for race, podium, and finale smoke coverage.

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
