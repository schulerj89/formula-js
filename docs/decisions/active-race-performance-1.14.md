# Active Race Performance 1.14

Date: 2026-06-26

## Context

The 0.2 performance decision set mobile balanced hard gates at fewer than 150 render calls, fewer than 180k triangles, and fewer than 60 geometries. Later smoke coverage allowed much looser limits, and the active race loop still did avoidable per-frame work.

## Decision

Tighten the mobile balanced browser smoke gates to the documented hard budgets and reduce hot-path churn before adding more scene detail. Cache wheel references on car groups, update HUD/map text only when values change, update leaderboard HTML only when standings/laps change, and rebuild debug metrics at a fixed 200 ms cadence instead of sorting frame samples every animation frame.

## Consequences

- Mobile smoke now proves the race scene stays inside the original render budgets.
- The race loop still updates visible speed, bars, map dots, and debug hook metrics, but avoids repeated unchanged DOM writes.
- Future visual detail should keep these gates green before raising counts.
