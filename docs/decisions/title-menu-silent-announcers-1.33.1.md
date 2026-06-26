# Title Menu Silent Announcers 1.33.1

The title menu should be a music-and-flyover screen, not an announcer booth.

## Decision

- Do not start an Arthur or Mags caption when the app boots to the title menu.
- Do not rotate title dialogue while `gameState === 'menu'`.
- When returning to the title, stop active generated voice playback, cancel browser speech synthesis, clear queued captions, and hide the caption panel.
- Keep announcer speech in tutorial, pre-race, active race callouts, replay, podium, and finale.

## Verification

- Unit coverage proves `RaceAudio.stopSpeech()` cancels generated/browser voice and blocks stale generated-voice fallback speech.
- Browser screenshot smoke asserts the title menu has no active caption and zero speech events before and after the flyover track changes.
