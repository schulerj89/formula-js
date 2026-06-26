# ElevenLabs Line ID Manifest 1.29.4

Date: 2026-06-26

## Decision

The ElevenLabs voice plan and checked manifest include stable `lineIds` for each planned voice asset.

## Reasoning

- Runtime generated voice matching can now use `speaker + lineId`, but the generation manifest did not expose those IDs.
- Keeping line IDs in the manifest lets `audio:check` catch drift before generated MP3 work starts.
- The change does not add new MP3 requirements or change the planned/generated status model.
- Existing speaker/text matching remains as a fallback for dynamic lines and legacy call sites.

## Follow-up

- Add replay-specific voice assets only after deciding which replay highlights should be fixed generated performances.
