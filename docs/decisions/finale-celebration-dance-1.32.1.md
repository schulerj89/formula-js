# Finale Celebration Dance 1.32.1

Gridline Apex 1.32.1 makes the campaign champion celebration visibly different from the normal race podium dance.

## Decisions

- Keep the regular podium winner animation as a side-to-side dance with lower arm motion.
- Give the campaign finale winner an overhead-arm champion motion with higher bounce, helmet movement, and torso twist.
- Expose `podiumCelebrationMode` and `podiumCelebrationEnergy` in driver-rig metrics so browser smoke can prove podium and finale use different animation states.
- Avoid adding assets or new geometry; this is animation-only and does not change the render budget.

## Verification

- Unit coverage compares podium and finale driver-rig animation summaries.
- Screenshot coverage asserts the podium reports `podium` and the campaign finale reports `finale` with higher celebration energy.
