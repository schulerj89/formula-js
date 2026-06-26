# Race Start Decision 0.5

This document sets the 0.5.0 race-start direction for Formula JS / Gridline Apex. The start sequence should feel like a broadcast grid launch, stay readable on phones, and give players enough setup information before lights-out without slowing repeat races.

## Decision

- Use a five-red-light start system as the primary visual countdown.
- Keep the light gantry, countdown text, and start-state messaging inside the mobile safe area.
- Treat lights, audio cues, and announcer/race-control lines as one coordinated start sequence, not separate effects.
- Show only race-critical setup before lights-out: track, lap count, grid position, controls reminder, and objective.
- Keep tutorial guidance short and contextual. Do not block the start once the player has seen the guidance.
- Add smoke tests that verify sequence timing, mobile visibility, and no input advantage before lights-out.

## Five Red Lights

- Display five unlit housings above or near the horizon line, large enough to read on a 360px-wide viewport.
- Illuminate one red light at a time from left to right until all five are lit.
- Avoid tiny bulbs, thin outlines, or text-only countdowns. The light state must be readable without audio.
- Keep the player car, nearest grid rivals, and first corner visible beneath the gantry whenever possible.
- Provide a reduced-motion fallback that preserves the same timing but removes aggressive flashes or camera shake.

## Countdown Timing

The default sequence should be predictable but still tense:

| Phase | Duration | Notes |
| --- | ---: | --- |
| Grid hold | 1.0s | Camera settles, player input is locked, setup HUD is visible. |
| Red 1 | 0.6s | First light turns on with a short cue. |
| Red 2 | 0.6s | Second light turns on. |
| Red 3 | 0.6s | Third light turns on. |
| Red 4 | 0.6s | Fourth light turns on. |
| Red 5 | 0.8-1.4s | Hold is slightly variable per race, but never longer than 1.4s. |
| Lights-out | Instant | All lights clear, input unlocks, race timer starts. |

Input should remain locked until the same frame that lights-out is shown. Holding throttle before lights-out may preload player intent, but it must not move the car or improve launch timing before unlock.

## Sound And Announcer Interplay

- Use a short mechanical light cue for each red light, with the fifth cue slightly weightier.
- Duck pre-race music and crowd bed during the five-light sequence.
- Arthur Bell should lead the start with one concise race-control-style line before the first red light or during grid hold.
- Mags Whitlow may add a short color line before grid hold on special races, but never during the five red lights.
- Do not stack voice lines over the final red-light hold or lights-out.
- At lights-out, prioritize engine launch, tire bite, and crowd swell over announcer speech.
- If a start is restarted, canceled, or false-start handling is added later, race-control voice takes priority over character commentary.

## Tutorial Guidance

- First race only: show a compact control reminder during grid hold, then fade it before the third red light.
- Mobile guidance should use icons and short labels for steer, throttle, brake, and pause.
- Keyboard/gamepad guidance should match the active input method when known.
- Repeat races should show only a minimal "Hold throttle, launch on lights-out" hint when useful.
- Tutorial copy must not cover the light gantry, player car, or first braking marker.

## Before Lights-Out

Show this information before the sequence commits to lights-out:

- Track name and layout.
- Lap count or event length.
- Player grid position.
- Start objective, such as finish target or rival to beat.
- Active assists or control mode if changed from default.
- Weather or surface condition only if it affects launch or first-corner grip.

Hide or de-emphasize non-critical UI before the first red light. Garage, customization, leaderboard, and pause affordances should not compete with the gantry.

## Smoke-Test Checks

- Desktop and mobile viewports show all five lights fully inside the visible safe area.
- The light sequence reaches red 1 through red 5 in order, then clears all lights on lights-out.
- Total countdown duration stays within the expected range: 4.0s to 4.6s from grid hold start to lights-out.
- Player and CPU cars cannot move before lights-out.
- Player input unlocks on the same frame or tick that lights-out is displayed.
- First-time tutorial text is visible during grid hold and gone before launch.
- Audio events do not overlap final hold voice lines with lights-out engine launch.
- Reduced-motion mode keeps the countdown functional and removes disruptive flashes or shakes.
- A 360x640 smoke viewport has no overlapping countdown text, tutorial guidance, touch controls, or light gantry.
