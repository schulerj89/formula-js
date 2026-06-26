# Repeat Race Performance Smoke 1.17

Date: 2026-06-26

## Context

The 0.2 performance decision called for a menu -> race -> menu -> race regression check so repeated scene rebuilds do not hide renderer or replay memory growth. Existing browser smoke covered one active race and campaign flow, but not a repeated race lifecycle inside one browser page.

## Decision

Expose scene lifecycle and active material-count metrics from the app, then add a mobile balanced Playwright smoke that starts a time attack, records active race counters, finishes through the debug race-finish hook, returns to menu, starts a second time attack, and compares the second race against the first.

## Consequences

- Browser smoke now proves repeated race rebuilds stay inside mobile render and material budgets.
- Replay bytes are checked against the 4 MB hard budget.
- Chromium heap growth is checked when `performance.memory` is available, with the same 15 MB tolerance from the performance decision.
