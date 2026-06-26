# Critical Radio Latching 1.29.1

Date: 2026-06-26

## Decision

Latch low-damage and low-tyre radio warnings once each per race, while keeping new contact events eligible through the existing contact-event counter.

## Reasoning

- Critical health radio bypasses normal announcer cooldowns so safety calls are not delayed.
- Remembering only the last radio key allowed damage and tyre warnings to alternate every frame when both were below threshold.
- Per-warning latching preserves the requested low-health radio feedback without turning it into repeated chatter over the engine mix.
- Contact radio remains event-based because a new collision should still cut through immediately.
- Replay damage and tyre condition highlights use the same Radio identity so low-health messages do not shift back to the announcers during replay.

## Follow-up

- If races become longer, consider reset thresholds so a repaired or recovered system can warn again after a meaningful state change.
