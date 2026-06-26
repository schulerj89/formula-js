# Title Wordmark 1.29

Date: 2026-06-26

## Decision

Use a CSS-only motorsport wordmark for the title page instead of relying on downloaded or locally installed display fonts.

## Reasoning

- The title needed a stronger first impression without adding menu clutter or network-dependent font loading.
- Local system fallback fonts keep startup fast and avoid a new render-blocking asset.
- Split title lines allow a racing-style silhouette while preserving the accessible heading name.
- Browser metrics and screenshot coverage can verify the treatment, zero letter spacing, and spacing above primary actions.

## Follow-up

- Revisit a bundled display font only if it is measured against startup and bundle budgets.
- Keep future title-page additions secondary to the playable entry points.
