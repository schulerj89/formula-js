# Campaign Objectives 1.33

Gridline Apex campaign races now give the player one concrete objective before lights-out: finish at or above a target position and beat a named rival.

## Decision

- Generate a deterministic objective for each campaign race from current campaign scores, racer roster, race index, and selected track.
- Start the campaign with a reachable podium target, tighten the middle races around the nearest rival, and require a win in the finale race before the Champions screen.
- Show the objective during the pre-race lights phase, then hide it during active racing so the HUD stays focused.
- Report the objective result on the podium before the standings line.

## Rationale

Campaign mode had scoring and podium/finale payoff, but each race still felt like a detached time attack until the standings appeared. A short objective gives the player immediate race context without adding title-screen or race-HUD clutter.

The objective stays tied to existing campaign scores rather than adding a separate quest system. That keeps it deterministic for tests and easy to expose through debug metrics.

## Verification

- Unit tests cover objective creation, rival selection, outcome evaluation, and podium commentary insertion.
- Campaign browser smoke verifies the pre-race objective card, objective line ID, podium outcome metrics, and captures a campaign objective screenshot artifact.
- Time-attack screenshot smoke asserts the objective card is absent outside campaign mode.
