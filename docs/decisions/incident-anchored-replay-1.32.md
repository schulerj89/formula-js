# Incident-Anchored Replay 1.32

Gridline Apex 1.32.0 connects end-of-race replay commentary to race moments that actually happened.

## Decisions

- Extend the replay recorder with lightweight incident markers captured when active-race commentary or radio calls are emitted.
- Generate replay-specific highlight lines from retained incidents before falling back to generic timed middle-sector, damage, tyre, and finish beats.
- Keep replay events compact by storing only event source metadata, speaker/text identity, focus racer, and replay time, not extra frame data.
- Expose replay incident counts and each delivered replay event's `sourceKind` and `sourceTime` in debug metrics.

## Verification

- Unit coverage proves incident markers become replay-specific contact/pass/spotter events and stay inside the retained replay window after sample drops.
- Browser replay smoke forces a contact/radio incident, finishes the race, opens replay playback, and waits for a `radio-team-contact` sourced replay highlight.
- Replay byte-budget checks remain under 4 MB.
