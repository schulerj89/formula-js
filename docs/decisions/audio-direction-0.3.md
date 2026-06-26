# Audio Direction Decision 0.3

This document sets the 0.3.0 audio direction for Formula JS / Gridline Apex. The goal is a celebratory pop-rock identity around races, a readable formula-car soundscape during races, and a clear asset path for generated music and voice without adding secrets or runtime coupling in this decision.

## Decision

- Use procedural pop-rock / celebratory music for four non-race themes: menu, pre-race, podium, and campaign finale.
- Do not play music during active racing. Active race audio must prioritize engine, tires, impact feedback, radio calls, and HUD-critical announcer/race-control cues.
- Treat car engine and radio readability as the core mix problem for 0.3.0. Music is brand flavor outside the driving window, not a constant bed.
- Use British announcer performances for Arthur Bell and Mags Whitlow, with voice direction distinct enough that players can identify speaker role from tone alone.
- Organize ElevenLabs-generated assets later under source-controlled manifests and ignored binary/output folders. Never commit ElevenLabs API keys, voice IDs intended to stay private, generated credentials, or local `.env` files.

## Music Themes

| Theme | Use | Direction | Loop / Length |
| --- | --- | --- | --- |
| Menu | Title, garage, career hub, options | Bright procedural pop-rock with clean guitars, handclaps, light synth sparkle, and a confident sports-broadcast pulse. Energetic but not fatiguing. | Seamless 60-90s loop with light intro sting. |
| Pre-race | Grid build, car select confirmation, countdown staging | Tighter drums, muted guitar chugs, rising bass motion, crowd-bed energy. Tension should build without masking lights, countdown, or radio setup. | 20-45s loop or layered stem that can duck for lights. |
| Podium | Race win, podium results, unlock celebration | Bigger chorus feel: open chords, live-feeling drums, short brass/synth accents, crowd lift. Triumphant without parody. | 30-60s loop with optional win sting. |
| Campaign finale | Final championship win and end-of-campaign celebration | Fullest version of the identity: anthemic guitars, halftime lift into driving chorus, celebratory crowd swell, clean melodic hook. | 90-150s cue, non-looping preferred with clean end tag. |

Music should be authored or generated as stems where practical: drums, bass, guitars/synths, crowd/sweeteners. Keep transient-heavy elements out of the center when announcer or radio speech is active.

## Active Race Mix

- No music after lights-out until the race is completed, paused, or transitioned to replay/results.
- Engine is the player-performance anchor. Prioritize player engine pitch, gear/throttle changes, rev limiter, and traction loss over all ambient material.
- Opponent engines should sit lower and wider than the player engine. Use proximity and overtake context to raise nearby cars briefly.
- Radio calls must cut through the engine without sounding disconnected. Duck engine and tire buses briefly under critical radio lines instead of raising radio volume excessively.
- Tire scrub, kerb hits, wall impacts, collision thuds, and damage warnings should be short, readable, and ranked by gameplay importance.
- Announcer/race-control lines during active race should be sparse. Avoid stacking announcer lines over radio calls, countdown, crash warnings, or finish-line moments.
- Crowd and environment beds stay low in active race and can rise only on start, final lap, overtake highlights, and finish.

Suggested priority order during active race:

1. Critical safety/gameplay cues: crash, wrong way, heavy damage, finish, countdown/lights.
2. Player engine, tire grip, gear/throttle feedback.
3. Team radio and spotter-style calls.
4. Nearby opponent engines and collision context.
5. Announcer flavor, crowd, and environment.

## Announcer Voice Direction

### Arthur Bell

- Accent: polished British motorsport lead, London / southern broadcast clarity.
- Role: race-craft authority and continuity voice.
- Performance: precise, composed, slightly clipped under pressure; urgency comes from pace and diction rather than shouting.
- Use cases: menu welcome, grid setup, lap milestones, rules, strategy notes, finish confirmation, serious incidents.
- Avoid: slapstick reads, exaggerated hype, or jokes that undercut crashes and player failure.

### Mags Whitlow

- Accent: warm northern British color commentator with dry timing.
- Role: human texture, wit, rivalry reads, and celebratory release.
- Performance: quick, observant, amused but never careless during danger; can be sharper and more playful outside active race.
- Use cases: menu flavor, rival callouts, pre-race tension, podium remarks, replay highlights, campaign finale celebration.
- Avoid: constant chatter, cartoon delivery, or punchlines over critical radio and safety cues.

Arthur should lead information. Mags should add character. If both are available for the same event, Arthur takes first read for clarity and Mags follows only when timing leaves space.

## ElevenLabs Asset Organization

When generated assets are added later, use a structure like:

```text
assets/
  audio/
    music/
      manifests/
        music-0.3.json
    voice/
      manifests/
        announcers-0.3.json
      generated/
        arthur-bell/
        mags-whitlow/
```

- Commit small manifests that describe line ids, speaker, intended scene, generation date, prompt/version notes, and final approved filenames.
- Do not commit secrets. Keep `ELEVENLABS_API_KEY`, private voice IDs, local generation settings, and scratch exports in `.env` or ignored local files.
- Generated binary audio can be committed only after licensing and repository-size policy are decided. Until then, keep generated output ignored or stored in external artifact storage.
- Use stable line ids so runtime code can reference approved assets without knowing provider details.
- Keep provider prompts and voice notes free of credentials. If a voice id is sensitive, refer to a local alias such as `arthur_bell_primary` in manifests and map it outside git.

## Implementation Guidance

- Add music state transitions only around menu, pre-race, podium/results, and campaign finale scenes.
- Add an explicit active-race music mute/stop rule before integrating any music manager.
- Add bus-level volume controls for `music`, `playerEngine`, `opponentEngine`, `tires`, `impacts`, `radio`, `announcer`, `crowd`, and `ui`.
- Any future smoke test for audio should verify that active race state reports no active music source while engine and radio buses remain available.
