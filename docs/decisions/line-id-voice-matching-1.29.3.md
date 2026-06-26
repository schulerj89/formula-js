# Line ID Voice Matching 1.29.3

Date: 2026-06-26

## Decision

Generated voice asset matching can use a stable line ID in addition to the existing speaker and exact text match.

## Reasoning

- Replay and race commentary now expose stable line IDs, but the audio path previously dropped them before generated voice matching.
- Matching by `speaker + lineId` lets safe caption copy edits keep using the same planned/generated voice asset.
- Speaker remains part of the lookup so a reused or mistyped line ID cannot route Arthur, Mags, and Radio voices across roles.
- Exact text matching remains the fallback for legacy calls and dynamic lines that do not yet carry line IDs.

## Follow-up

- Add replay-specific generated voice assets only after deciding which replay highlights should be fixed performances versus dynamic browser-speech captions.
