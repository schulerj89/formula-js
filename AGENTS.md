# Agent Notes

- Keep this repo mobile-first and performance-measured.
- Preserve user changes; avoid broad rewrites.
- Use the todo/progress list once a versioned slice is underway.
- Use procedural fallbacks before external assets.
- Never commit API keys or generated secrets.
- If a domain or product decision is uncertain, create or use the relevant expert/subagent before implementation and record the accepted decision in `docs/decisions/`.
- Radio team audio must use the dedicated radio voice env/ID and radio processing; never route those lines through Arthur or Mags announcer voices.
- Keep the title page decluttered; favor playable entry points and secondary links over dense text or stacked explanation.
- Check generated GLB/model assets in the isolated asset inspector before integrating them into the main game scene.
