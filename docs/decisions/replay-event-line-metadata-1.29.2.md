# Replay Event Line Metadata 1.29.2

Date: 2026-06-26

## Decision

Replay highlight events carry stable `lineId` metadata, and radio-branded replay condition events also carry `radioKey`.

## Reasoning

- The replay system already had compact highlight captions, but kind/speaker/text was too loose for future generated voice matching.
- Stable line IDs let tests and generation tools identify the intended performance without relying on full caption text.
- `radioKey` preserves radio identity for replay damage and tyre highlights while leaving announcer-led replay beats unkeyed.
- The extra metadata is tiny compared with frame samples and is included in replay byte estimates.

## Follow-up

- If replay voice assets are generated later, match them by `lineId` first and fall back to text matching only for legacy lines.
