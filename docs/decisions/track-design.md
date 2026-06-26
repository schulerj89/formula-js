# Track Design Decision

This document defines four race tracks for a mobile-first Three.js Formula-style browser game. The tracks are designed for simple top-down or chase-camera racing, readable racing lines, short sessions, and AI that can be tuned without full simulation complexity.

## Design Goals

- Each circuit should be recognizable from its silhouette within one lap.
- Tracks should fit short mobile sessions: roughly 45-80 seconds per lap for an average player.
- Every circuit needs at least one braking zone, one flowing section, one obvious overtake setup, and one mistake-punishing corner.
- Kerbs should teach the racing line visually without requiring the player to memorize corner names.
- Scenery landmarks should help orientation, especially on small screens.

## Track 1: Harbor Sprint

**Theme:** Modern waterfront street circuit with glass towers, marina barriers, cranes, and a short tunnel under a pedestrian bridge.

**Lap length feel:** Short and punchy. This should be the beginner-friendly circuit: easy to learn, hard enough to optimize. Target 45-55 seconds per lap.

**Corner sequence:**

1. Short start/finish straight into a medium right-hander.
2. Fast left kink along the marina wall.
3. Heavy braking into a tight right hairpin beside the ferry terminal.
4. Short acceleration zone into a left-right chicane.
5. Long sweeping left around the harbor basin.
6. Brief tunnel straight.
7. Final right-hand 90-degree corner back onto the main straight.

**Red/white kerb placement guidance:**

- Place inside kerbs on the right hairpin, both chicane apexes, the harbor sweeper apex, and the final right.
- Put exit kerbs after the hairpin and final corner to reward early throttle.
- Keep the marina-wall fast kink mostly unkerbed so the barrier proximity creates tension.
- On mobile, make chicane kerbs wide and high-contrast because they are the clearest visual cue for the ideal line.

**Scenery landmarks:**

- Docked yachts and a blue marina wall along the fast left kink.
- A ferry terminal canopy at the hairpin braking zone.
- Stacked shipping containers near the chicane.
- A short lit tunnel under a pedestrian bridge before the final corner.
- Tall glass tower reflections near the start/finish straight.

**AI difficulty notes:**

- Easy AI should brake early for the hairpin and take a conservative line through the chicane.
- Medium AI should carry speed through the harbor sweeper but avoid attacking the marina kink.
- Hard AI should use the hairpin exit kerb and defend the inside into the final corner.
- Main AI weakness should be traction out of the tight hairpin, giving players a clean passing opportunity.

## Track 2: Alpine Crest

**Theme:** Mountain road circuit with elevation changes, pine forests, cliffside guardrails, and a chalet village section.

**Lap length feel:** Medium length with rhythm changes. It should feel like the technical track, with more steering precision than outright top speed. Target 60-70 seconds per lap.

**Corner sequence:**

1. Uphill start/finish straight into a blind left crest.
2. Downhill right sweeper requiring a lift.
3. Tight uphill left hairpin.
4. Short straight through pine trees.
5. Medium-speed right-left esses.
6. Long downhill braking zone into a square right near the village.
7. Late-apex left around the chalet plaza.
8. Fast uphill final right kink onto the main straight.

**Red/white kerb placement guidance:**

- Use inside kerbs on the hairpin, esses, village square right, and late-apex chalet left.
- Do not place a large inside kerb on the blind crest; use roadside paint or rumble strips instead so players are not encouraged to cut an unreadable corner.
- Add exit kerbs on the downhill right sweeper and chalet left, but keep cliffside exits narrow to preserve risk.
- Kerbs in the esses should alternate visibly: right apex, left apex, then a short exit strip.

**Scenery landmarks:**

- Snow-capped mountain backdrop visible from the main straight.
- Pine tree tunnel after the uphill hairpin.
- Cliffside guardrail and valley drop on the downhill sweeper.
- Chalet village with flags near the square right.
- Cable car tower near the final uphill kink.

**AI difficulty notes:**

- Easy AI should lift heavily over the blind crest and brake early for the downhill village corner.
- Medium AI should maintain rhythm through the esses but avoid aggressive kerb use.
- Hard AI should late apex the chalet left and carry momentum onto the main straight.
- Main AI weakness should be the blind crest-to-sweeper transition, where the player can gain time by trusting the line.

## Track 3: Neon Loop

**Theme:** Night city circuit with neon signs, elevated rail, reflective asphalt, and wide boulevard sections.

**Lap length feel:** Fast and flowing. This should be the speed track with one technical braking zone. Target 50-60 seconds per lap.

**Corner sequence:**

1. Long boulevard straight into a high-speed right bend.
2. Quick left kink under the elevated rail.
3. Heavy braking into a wide left hairpin around a neon plaza.
4. Short drag race into a shallow right sweeper.
5. Fast right-left-right S section between light pylons.
6. Medium-speed left onto the riverside.
7. Final tightening right leading back to the boulevard straight.

**Red/white kerb placement guidance:**

- Place low, flat kerbs on the fast S section so players can brush them without losing control.
- Use a prominent inside kerb and long exit kerb at the neon plaza hairpin.
- Put an outside exit kerb on the final tightening right to signal track limits under acceleration.
- Avoid excessive kerbing on the boulevard bend; lane markings and barriers should carry the visual language there.

**Scenery landmarks:**

- Neon plaza billboard at the left hairpin.
- Elevated rail crossing above the early left kink.
- Light pylons framing the S section.
- Riverside reflections and low barriers before the final corner.
- Animated start gantry with bright city signage.

**AI difficulty notes:**

- Easy AI should brake too much for the high-speed bend and take a wide hairpin line.
- Medium AI should be strong on straights but cautious through the S section.
- Hard AI should maximize exit speed from the final tightening right and use slipstream-like behavior on the boulevard.
- Main AI weakness should be over-defending the hairpin entry, allowing switchback passes on exit.

## Track 4: Desert Switchback

**Theme:** Purpose-built desert circuit with sandstone cliffs, heat haze, solar farms, and broad runoff areas.

**Lap length feel:** Longest and most complete circuit. It should feel like the championship finale: varied, strategic, and slightly more demanding. Target 70-80 seconds per lap.

**Corner sequence:**

1. Long start/finish straight into a heavy braking right-left complex.
2. Medium-speed left sweeper past the solar field.
3. Short straight into a double-apex right.
4. Technical left-right-left switchback through sandstone walls.
5. Back straight with slight rightward bend.
6. Tight left hairpin at the far end.
7. Fast right sweeper into a final left-right chicane.
8. Short run to the finish line.

**Red/white kerb placement guidance:**

- Use strong inside kerbs for the opening right-left complex, double-apex right, hairpin, and final chicane.
- Add two separate kerb segments on the double-apex right so the player can read both apexes.
- Keep switchback kerbs narrow and slightly raised to discourage full cuts through the sandstone section.
- Use wide exit kerbs after the opening complex and final chicane because these are the main throttle commitment points.

**Scenery landmarks:**

- Solar panel field along the left sweeper.
- Sandstone canyon walls around the technical switchback.
- Wind turbines beyond the back straight.
- Desert grandstand and timing tower near the start/finish.
- Dusty runoff zones with tire stacks at the opening complex and hairpin.

**AI difficulty notes:**

- Easy AI should struggle with the double-apex right and brake early for the far hairpin.
- Medium AI should be competitive on the back straight but inconsistent in the switchback.
- Hard AI should attack the opening complex and final chicane kerbs while staying stable.
- Main AI weakness should be compromised exits from the switchback, giving the player a run down the back straight.

## Runtime Track Data Fields

The main game should keep track definitions data-driven so each circuit can be loaded from the same renderer, AI, and collision systems.

```ts
type TrackDefinition = {
  id: string;
  name: string;
  theme: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  lapTimeTargetSeconds: {
    easy: number;
    medium: number;
    hard: number;
  };
  startGrid: {
    position: [number, number, number];
    rotationY: number;
    slots: Array<{ offset: [number, number, number]; rotationY: number }>;
  };
  centerline: Array<[number, number, number]>;
  trackWidth: number;
  runoffWidth: number;
  checkpoints: Array<{
    id: string;
    position: [number, number, number];
    width: number;
    order: number;
  }>;
  sectors: Array<{
    id: string;
    startCheckpointId: string;
    endCheckpointId: string;
    character: "straight" | "braking" | "technical" | "flowing";
  }>;
  corners: Array<{
    id: string;
    name: string;
    direction: "left" | "right" | "left-right" | "right-left";
    entrySpeedHint: "slow" | "medium" | "fast";
    apex: [number, number, number];
    exit: [number, number, number];
    aiBrakeBias: number;
    overtakeChance: "low" | "medium" | "high";
  }>;
  kerbs: Array<{
    id: string;
    side: "inside" | "outside";
    startDistance: number;
    endDistance: number;
    colorPattern: "red-white";
    rideHeight: "flat" | "low" | "raised";
  }>;
  scenery: Array<{
    id: string;
    type: "building" | "tree" | "barrier" | "sign" | "grandstand" | "landmark" | "prop";
    position: [number, number, number];
    rotationY: number;
    scale: [number, number, number];
    mobileImportance: "low" | "medium" | "high";
  }>;
  aiRacingLine: Array<{
    position: [number, number, number];
    targetSpeed: number;
    brakeZone?: boolean;
    defendLine?: boolean;
  }>;
  cameraHints: Array<{
    zoneId: string;
    preferredDistance: number;
    preferredHeight: number;
    lookAhead: number;
  }>;
  minimap: {
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
    rotation: number;
  };
};
```

Recommended initial track metadata:

| Track | Difficulty | Best Use | Primary Overtake Zone | Main Risk |
| --- | ---: | --- | --- | --- |
| Harbor Sprint | 1 | First race, tutorial, time trials | Ferry hairpin | Chicane cuts |
| Alpine Crest | 3 | Skill challenge, steering precision | Village square right | Blind crest speed |
| Neon Loop | 2 | Fast arcade race, drafting feel | Neon plaza hairpin | Final corner exit wall |
| Desert Switchback | 4 | Finale, longer race, AI showcase | Far hairpin | Switchback rhythm loss |

## Circuit Feel Verification Checklist

- The player can identify the next corner direction from camera view, kerbs, barriers, or landmarks before reaching the braking zone.
- Each lap has a clear rhythm: accelerate, brake, rotate, exit, then reset for the next section.
- At least one corner per track punishes over-speed without causing unavoidable crashes.
- Red/white kerbs mark useful apexes and exits, not every edge of the road.
- AI can complete five consecutive laps without wall contact, missed checkpoints, or severe corner cutting.
- Easy AI leaves at least one repeatable passing chance per lap.
- Hard AI uses kerbs and racing lines visibly but still makes small recoverable mistakes.
- Mobile screen readability holds at race speed: track edge, kerbs, car, and next landmark remain visually distinct.
- Lap times differ meaningfully between tracks, with Desert Switchback longest and Harbor Sprint shortest.
- The minimap silhouette of each track is distinct enough to recognize at a glance.
