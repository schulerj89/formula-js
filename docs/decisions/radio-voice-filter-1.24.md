# Radio Voice Filter 1.24

Gridline Apex keeps the radio team separate from Arthur Bell and Mags Whitlow, but a generated MP3 could still play back as a clean narrator track if routed directly through an `HTMLAudioElement`.

## Decision

Generated `radio-team-*` voice assets now route through a WebAudio filter chain before playback:

- High-pass at 420 Hz to remove clean studio low end.
- Low-pass at 2600 Hz to narrow the voice into a pit-wall radio band.
- Mild waveshaping to add compressed radio drive without masking the words.
- A dedicated metrics counter reports configured radio voice filter chains.

Browser speech fallback still uses the Radio profile, radio clicks, and engine ducking. If the browser refuses the generated MP3, fallback speech remains available.

## Consequences

- Radio-team lines use `ELEVENLABS_RADIO_VOICE_ID` and runtime radio processing.
- Arthur and Mags generated lines stay clean announcer playback.
- Unit coverage proves a generated radio line is routed through the filter chain and still ducks race audio.
