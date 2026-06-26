# Podium Commentary 1.9

## Context

The podium and finale scenes already staged the top three cars and rendered results in the UI, but the captions were generic. The finale path also called two captions back-to-back, making the first line unreadable and risking overlapping generated voice playback later.

## Decision

Add pure podium commentary builders:

- Race podium commentary names the winner, second, third, the player's finish, and current campaign standings when available.
- Finale commentary names the campaign champion, points, wins, and top three.
- `main.ts` owns a small podium-commentary queue that emits one caption at a time using the existing caption timer.
- Debug metrics expose the current caption and podium-commentary line IDs for deterministic browser smoke tests.

Generated voice playback is now single-channel: a new generated voice pauses and resets the previous generated voice element before starting.

## Constraints

- No new assets or render cost.
- Do not call `showCaption` multiple times in one podium/finale tick.
- Keep text generation deterministic and unit-testable.
- Preserve the existing podium and finale screenshot flow.

## Follow-ups

- Add planned ElevenLabs voice entries for the new podium/finale lines once the line set stabilizes.
- Consider a closer driver-framed screenshot for the second queued finale line.
