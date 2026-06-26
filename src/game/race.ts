import type { GameMode, GameSettings, RacerDefinition, RaceResult, TrackDefinition } from '../types';
import {
  BASE_GUARDRAIL_BOUNDARY,
  DEFAULT_LANE_CENTERING_STRENGTH,
  createTrackCollisionProfile,
  createTrackSpaceProfile,
  resolveTrackSpaceCollision,
  resolveDrivingAssistSettings,
  type DrivingAssistSettings,
  type TrackCollisionKind,
  type TrackCollisionProfile,
  type TrackSpaceProfile,
} from './trackSpace';

export interface RacerState {
  definition: RacerDefinition;
  progress: number;
  distance: number;
  lap: number;
  speed: number;
  lateral: number;
  lateralVelocity: number;
  totalTime: number;
  bestLap: number;
  currentLapTime: number;
  damage: number;
  tires: number;
  finished: boolean;
  finishTime: number;
  racecraft: CpuRacecraft;
  contactCooldown: number;
  contactEvents: number;
  lastContactSeverity: number;
  maxContactSeverity: number;
  lastContactRacerId: string | null;
  trackContactCooldown: number;
  trackContactEvents: number;
  lastTrackContactKind: TrackCollisionKind | null;
  lastTrackContactSide: -1 | 1 | null;
  lastTrackContactSeverity: number;
  visualYawOffset: number;
  visualRoll: number;
  handling: PlayerHandling;
}

export interface CpuRacecraft {
  targetSpeed: number;
  targetLateral: number;
  cornerLoad: number;
  braking: boolean;
  overtakeLane: -1 | 0 | 1;
  trafficGapMeters: number | null;
}

export interface PlayerHandling {
  cornerLoad: number;
  grip: number;
  steeringResponse: number;
  brakingDemand: number;
  understeer: number;
  assistCentering: number;
}

export interface RaceControl {
  throttle: boolean;
  brake: boolean;
  steer: number;
}

export const TRACK_EDGE_BOUNDARY = BASE_GUARDRAIL_BOUNDARY;

export interface RaceSnapshot {
  racers: RacerState[];
  player: RacerState;
  standings: RacerState[];
  position: number;
  complete: boolean;
}

export function createRace(
  mode: GameMode,
  track: TrackDefinition,
  racers: RacerDefinition[],
  settings: GameSettings,
): { update: (dt: number, control: RaceControl) => RaceSnapshot; snapshot: () => RaceSnapshot } {
  const laps = mode === 'timeAttack' ? 1 : track.laps;
  const collisionProfile = createTrackCollisionProfile(track);
  const trackSpace = collisionProfile.trackSpace;
  const assist = resolveDrivingAssistSettings(settings);
  const states: RacerState[] = racers.map((definition, index) => ({
    definition,
    progress: 0.985 - index * 0.006,
    distance: 0,
    lap: 0,
    speed: 0,
    lateral: (index % 2 === 0 ? -1 : 1) * Math.min(trackSpace.playerLateralRange.max - 0.45, 1.25 + Math.floor(index / 2) * Math.min(2.05, trackSpace.startingGridLateralSpread / 4.5)),
    lateralVelocity: 0,
    totalTime: 0,
    bestLap: Number.POSITIVE_INFINITY,
    currentLapTime: 0,
    damage: 1,
    tires: 1,
    finished: false,
    finishTime: Number.POSITIVE_INFINITY,
    racecraft: defaultRacecraft(),
    contactCooldown: 0,
    contactEvents: 0,
    lastContactSeverity: 0,
    maxContactSeverity: 0,
    lastContactRacerId: null,
    trackContactCooldown: 0,
    trackContactEvents: 0,
    lastTrackContactKind: null,
    lastTrackContactSide: null,
    lastTrackContactSeverity: 0,
    visualYawOffset: 0,
    visualRoll: 0,
    handling: defaultPlayerHandling(),
  }));
  const player = states[0];

  const update = (dt: number, control: RaceControl): RaceSnapshot => {
    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      if (state.finished) continue;
      state.totalTime += dt;
      state.currentLapTime += dt;
      state.contactCooldown = Math.max(0, state.contactCooldown - dt);
      state.trackContactCooldown = Math.max(0, state.trackContactCooldown - dt);
      state.lastContactSeverity = Math.max(0, state.lastContactSeverity - dt * 1.4);
      state.lastTrackContactSeverity = Math.max(0, state.lastTrackContactSeverity - dt * 1.4);

      if (i === 0) {
        updatePlayer(state, control, dt, settings, track, trackSpace, assist);
      } else {
        updateCpu(state, i, dt, track, states, trackSpace);
      }
      applyTrackSpaceCollisionResponse(state, dt, settings, collisionProfile, i === 0 ? 1 : 0.65);

      const lapDistance = Math.max(0, state.speed * dt / (track.lengthKm * 1000));
      const previousLap = Math.floor(state.distance);
      state.distance += lapDistance;
      state.progress = (0.985 - i * 0.006 + state.distance) % 1;
      const completedLaps = Math.min(laps, Math.floor(state.distance));
      if (completedLaps > previousLap) {
        state.lap = completedLaps;
        state.bestLap = Math.min(state.bestLap, state.currentLapTime);
        state.currentLapTime = 0;
      }
      if (state.distance >= laps) {
        state.lap = laps;
        state.finished = true;
        state.finishTime = state.totalTime;
      }
    }
    applyCarContacts(states, track, settings, trackSpace);
    for (const state of states) applyTrackSpaceCollisionResponse(state, dt, settings, collisionProfile, 0.45);

    return snapshot();
  };

  const snapshot = (): RaceSnapshot => {
    const standings = [...states].sort(compareRacePosition);
    return {
      racers: states,
      player,
      standings,
      position: standings.findIndex((state) => state.definition.id === player.definition.id) + 1,
      complete: player.finished,
    };
  };

  return { update, snapshot };
}

export function createResults(snapshot: RaceSnapshot): RaceResult[] {
  return snapshot.standings.map((state) => ({
    racerId: state.definition.id,
    name: state.definition.name,
    totalTime: state.finishTime === Number.POSITIVE_INFINITY ? state.totalTime : state.finishTime,
    bestLap: state.bestLap === Number.POSITIVE_INFINITY ? state.currentLapTime : state.bestLap,
    damage: state.damage,
    tires: state.tires,
  }));
}

function updatePlayer(
  state: RacerState,
  control: RaceControl,
  dt: number,
  settings: GameSettings,
  track: TrackDefinition,
  trackSpace: TrackSpaceProfile,
  assist: DrivingAssistSettings,
): void {
  const handling = analyzePlayerHandling(state, control, track);
  state.handling = handling;
  const throttle = control.throttle ? 28 * (1 - handling.cornerLoad * 0.1) : 0;
  const brake = control.brake ? 42 * (1 + handling.cornerLoad * 0.12) : 0;
  const cornerDrag = handling.cornerLoad * Math.max(0, state.speed - 44) * (control.brake ? 0.04 : 0.085);
  const lateralScrub = Math.abs(state.lateralVelocity) * 0.55;
  const drag = 9 + Math.abs(control.steer) * 2.6 + handling.understeer * 8 + cornerDrag + lateralScrub;
  state.speed += (throttle - brake - drag) * dt;
  state.speed = clamp(state.speed, 0, 82);
  const speedSteerFactor = clamp(0.42 + state.speed / 95, 0.42, 1.08);
  const brakeRotationBoost = control.brake ? 1.18 : 1;
  const steeringAcceleration = control.steer * handling.steeringResponse * 1.18 * speedSteerFactor * brakeRotationBoost;
  state.lateralVelocity += steeringAcceleration * dt;
  if (assist.laneCenteringStrength > 0) state.lateralVelocity -= state.lateral * assist.laneCenteringStrength * dt * (0.5 + state.speed / 150);
  const damping = clamp(1 - dt * (0.82 + assist.steeringAssistStrength * 0.72 + handling.cornerLoad * 0.16), 0.74, 0.99);
  state.lateralVelocity *= damping;
  state.lateralVelocity = clamp(state.lateralVelocity, -10.5, 10.5);
  state.lateral += state.lateralVelocity * dt;
  state.lateral = clamp(state.lateral, -trackSpace.trackEdgeBoundary - 1.4, trackSpace.trackEdgeBoundary + 1.4);
  const offTrack = Math.max(0, Math.abs(state.lateral) - trackSpace.offTrackSlowdownStart);
  if (offTrack > 0) {
    state.speed *= 1 - Math.min(0.65, offTrack * dt * 0.7);
    if (settings.realisticDamage) state.damage = Math.max(0, state.damage - offTrack * dt * 0.025);
  }
  if (settings.realisticTires) {
    const wear = (0.002 + Math.abs(control.steer) * 0.009 + Math.abs(state.lateralVelocity) * 0.002 + (control.brake ? 0.01 : 0) + handling.cornerLoad * 0.004 + handling.understeer * 0.012) * dt;
    state.tires = Math.max(0, state.tires - wear);
  }
  const conditionLimit = 82 * (0.55 + state.damage * 0.45) * (0.72 + state.tires * 0.28);
  state.speed = Math.min(state.speed, conditionLimit);
  state.visualYawOffset = clamp(control.steer * 0.08 + state.lateralVelocity * 0.028 - handling.understeer * control.steer * 0.06, -0.22, 0.22);
  state.visualRoll = clamp(-control.steer * 0.035 - state.lateralVelocity * 0.012, -0.12, 0.12);
}

function applyTrackSpaceCollisionResponse(
  state: RacerState,
  dt: number,
  settings: GameSettings,
  collisionProfile: TrackCollisionProfile,
  severityScale: number,
): void {
  const collision = resolveTrackSpaceCollision(collisionProfile, state.progress, state.lateral, state.speed);
  if (!collision) return;
  const severity = Math.round(collision.severity * severityScale * 1000) / 1000;
  state.lateral = collision.side * collision.boundary;
  state.lateralVelocity = -collision.side * Math.min(Math.abs(state.lateralVelocity) * 0.32 + severity * 1.25, 4.2);
  state.speed *= 1 - Math.min(0.8, collision.speedLoss + severity * 0.24);
  state.lastTrackContactKind = collision.kind;
  state.lastTrackContactSide = collision.side;
  state.lastTrackContactSeverity = Math.max(state.lastTrackContactSeverity, severity);
  if (state.trackContactCooldown <= 0) {
    state.trackContactEvents += 1;
    state.trackContactCooldown = 0.42;
  }
  if (settings.realisticDamage) state.damage = Math.max(0, state.damage - severity * dt * collision.damageScale);
  if (settings.realisticTires) state.tires = Math.max(0, state.tires - severity * dt * collision.tireScale);
  state.visualYawOffset = clamp(state.visualYawOffset - collision.side * severity * 0.08, -0.22, 0.22);
  state.visualRoll = clamp(state.visualRoll + collision.side * severity * 0.05, -0.12, 0.12);
}

export function analyzePlayerHandling(
  state: Pick<RacerState, 'progress' | 'speed' | 'tires' | 'damage' | 'lateral'>,
  control: RaceControl,
  track: TrackDefinition,
): PlayerHandling {
  const trackSpace = createTrackSpaceProfile(track);
  const assist = resolveDrivingAssistSettings();
  const cornerLoad = cornerPressure(state.progress, track);
  const speedLoad = clamp((state.speed - 34) / 48, 0, 1);
  const steeringLoad = Math.abs(control.steer);
  const conditionGrip = 0.6 + clamp(state.tires, 0, 1) * 0.27 + clamp(state.damage, 0, 1) * 0.13;
  const lateralLoad = clamp(Math.abs(state.lateral) / trackSpace.playerLateralRange.max, 0, 1);
  const brakingDemand = clamp(cornerLoad * speedLoad * (control.brake ? 0.55 : control.throttle ? 1 : 0.78), 0, 1);
  const grip = clamp(conditionGrip - cornerLoad * 0.18 - speedLoad * steeringLoad * 0.14 - lateralLoad * 0.08, 0.44, 1);
  const understeer = clamp(brakingDemand * steeringLoad - grip * 0.46, 0, 1);
  const steeringResponse = clamp(8 * (0.58 + grip * 0.42) * (1 - understeer * 0.38), 4.1, 8);
  return {
    cornerLoad,
    grip: Math.round(grip * 1000) / 1000,
    steeringResponse: Math.round(steeringResponse * 1000) / 1000,
    brakingDemand: Math.round(brakingDemand * 1000) / 1000,
    understeer: Math.round(understeer * 1000) / 1000,
    assistCentering: assist.laneCenteringStrength,
  };
}

function updateCpu(state: RacerState, index: number, dt: number, track: TrackDefinition, states: RacerState[], trackSpace: TrackSpaceProfile): void {
  const racecraft = analyzeCpuRacecraft(state, index, states, track);
  state.racecraft = racecraft;
  const speedResponse = racecraft.braking ? 1.55 : 0.72;
  state.speed += (racecraft.targetSpeed - state.speed) * dt * speedResponse;
  state.speed = clamp(state.speed, 0, 84);
  const lateralResponse = Math.min(1, dt * (racecraft.overtakeLane ? 2.6 : 1.8));
  const previousLateral = state.lateral;
  state.lateral += (racecraft.targetLateral - state.lateral) * lateralResponse;
  state.lateral = clamp(state.lateral, trackSpace.cpuLateralRange.min, trackSpace.cpuLateralRange.max);
  state.lateralVelocity = (state.lateral - previousLateral) / Math.max(0.001, dt);
  const lateralLoad = Math.abs(state.lateral) / trackSpace.cpuLateralRange.max;
  state.tires = Math.max(0.15, state.tires - dt * (0.0007 + racecraft.cornerLoad * 0.0012 + lateralLoad * 0.0005));
  if (Math.abs(state.lateral) > trackSpace.offTrackSlowdownStart) state.damage = Math.max(0.35, state.damage - dt * 0.01);
  state.visualYawOffset = clamp(state.lateralVelocity * 0.018 + racecraft.overtakeLane * 0.035, -0.16, 0.16);
  state.visualRoll = clamp(-state.lateralVelocity * 0.008, -0.08, 0.08);
}

export function analyzeCpuRacecraft(state: RacerState, index: number, states: RacerState[], track: TrackDefinition): CpuRacecraft {
  const trackSpace = createTrackSpaceProfile(track);
  const cornerLoad = cornerPressure(state.progress, track);
  const baseSpeed = 50 + state.definition.skill * 18 + track.difficulty * 1.6;
  const cornerSpeedLoss = cornerLoad * (14 + track.difficulty * 2.4);
  const laneSpacing = Math.min(2.35, trackSpace.cpuLateralRange.max / 2.6);
  const lane = ((index % 3) - 1) * laneSpacing;
  const cornerSide = index % 2 === 0 ? -1 : 1;
  let targetLateral = lane * (1 - cornerLoad) + cornerSide * trackSpace.cpuLateralRange.max * 0.55 * cornerLoad;
  let targetSpeed = baseSpeed - cornerSpeedLoss;
  let overtakeLane: -1 | 0 | 1 = 0;
  let trafficGapMeters: number | null = null;
  const traffic = nearestTrafficAhead(state, states, track.lengthKm);
  if (traffic && traffic.gapMeters < 82 && state.definition.skill >= traffic.racer.definition.skill - 0.05) {
    overtakeLane = index % 2 === 0 ? 1 : -1;
    trafficGapMeters = traffic.gapMeters;
    const overtakeTarget = overtakeLane * Math.max(2.2, trackSpace.cpuLateralRange.max * 0.58);
    targetLateral = targetLateral * 0.55 + overtakeTarget + overtakeLane * ((82 - traffic.gapMeters) / 82) * 0.75;
    targetSpeed += 4.5;
  }
  targetSpeed *= 0.82 + state.tires * 0.18;
  return {
    targetSpeed: clamp(targetSpeed, 32, 82),
    targetLateral: clamp(targetLateral, trackSpace.cpuLateralRange.min, trackSpace.cpuLateralRange.max),
    cornerLoad,
    braking: cornerLoad > 0.58 && state.speed > targetSpeed + 1.5,
    overtakeLane,
    trafficGapMeters,
  };
}

function cornerPressure(progress: number, track: TrackDefinition): number {
  let pressure = 0;
  for (const [start, end] of track.kerbZones) {
    const toEntry = forwardProgressDistance(progress, start);
    const fromExit = forwardProgressDistance(end, progress);
    const inCorner = progressInRange(progress, start, end);
    if (inCorner) pressure = Math.max(pressure, 1);
    if (toEntry < 0.06) pressure = Math.max(pressure, (1 - toEntry / 0.06) * 0.78);
    if (fromExit < 0.035) pressure = Math.max(pressure, (1 - fromExit / 0.035) * 0.42);
  }
  return Math.round(clamp(pressure, 0, 1) * 1000) / 1000;
}

function nearestTrafficAhead(state: RacerState, states: RacerState[], trackLengthKm: number): { racer: RacerState; gapMeters: number } | null {
  let nearest: { racer: RacerState; gapMeters: number } | null = null;
  for (const candidate of states) {
    if (candidate === state || candidate.finished) continue;
    let gap = candidate.distance - state.distance;
    if (gap < 0) gap += 1;
    if (gap <= 0 || gap > 0.035) continue;
    const gapMeters = Math.round(gap * trackLengthKm * 1000);
    if (!nearest || gapMeters < nearest.gapMeters) nearest = { racer: candidate, gapMeters };
  }
  return nearest;
}

export function analyzeCarContact(a: RacerState, b: RacerState, trackLengthKm: number): { overlap: boolean; severity: number; longitudinalMeters: number; lateralMeters: number } {
  const longitudinalMeters = Math.round(longitudinalSeparation(a.progress, b.progress) * trackLengthKm * 1000 * 10) / 10;
  const lateralMeters = Math.round(Math.abs(a.lateral - b.lateral) * 10) / 10;
  const longitudinalOverlap = clamp((6.5 - longitudinalMeters) / 6.5, 0, 1);
  const lateralOverlap = clamp((1.9 - lateralMeters) / 1.9, 0, 1);
  const relativeSpeed = Math.abs(a.speed - b.speed);
  const severity = longitudinalOverlap > 0 && lateralOverlap > 0 ? clamp(longitudinalOverlap * 0.48 + lateralOverlap * 0.34 + relativeSpeed / 220, 0.06, 1) : 0;
  return {
    overlap: severity > 0,
    severity: Math.round(severity * 1000) / 1000,
    longitudinalMeters,
    lateralMeters,
  };
}

function applyCarContacts(states: RacerState[], track: TrackDefinition, settings: GameSettings, trackSpace: TrackSpaceProfile): void {
  for (let aIndex = 0; aIndex < states.length; aIndex += 1) {
    const a = states[aIndex];
    if (a.finished) continue;
    for (let bIndex = aIndex + 1; bIndex < states.length; bIndex += 1) {
      const b = states[bIndex];
      if (b.finished || a.contactCooldown > 0 || b.contactCooldown > 0) continue;
      const contact = analyzeCarContact(a, b, track.lengthKm);
      if (!contact.overlap) continue;
      applyContactToPair(a, b, contact.severity, settings, trackSpace);
    }
  }
}

function applyContactToPair(a: RacerState, b: RacerState, severity: number, settings: GameSettings, trackSpace: TrackSpaceProfile): void {
  const pushDirection = a.lateral <= b.lateral ? -1 : 1;
  const previousA = a.lateral;
  const previousB = b.lateral;
  a.lateral = clamp(a.lateral + pushDirection * severity * 0.72, -trackSpace.trackEdgeBoundary, trackSpace.trackEdgeBoundary);
  b.lateral = clamp(b.lateral - pushDirection * severity * 0.72, -trackSpace.trackEdgeBoundary, trackSpace.trackEdgeBoundary);
  a.lateralVelocity = a.lateral - previousA;
  b.lateralVelocity = b.lateral - previousB;
  const faster = a.speed >= b.speed ? a : b;
  const slower = faster === a ? b : a;
  faster.speed *= 1 - severity * 0.18;
  slower.speed *= 1 - severity * 0.08;
  for (const racer of [a, b]) {
    racer.contactCooldown = 0.48;
    racer.contactEvents += 1;
    racer.lastContactSeverity = severity;
    racer.maxContactSeverity = Math.max(racer.maxContactSeverity, severity);
    racer.lastContactRacerId = racer === a ? b.definition.id : a.definition.id;
    if (settings.realisticDamage) racer.damage = Math.max(0, racer.damage - severity * 0.055);
    if (settings.realisticTires) racer.tires = Math.max(0, racer.tires - severity * 0.018);
  }
}

function progressInRange(progress: number, start: number, end: number): boolean {
  if (start <= end) return progress >= start && progress <= end;
  return progress >= start || progress <= end;
}

function forwardProgressDistance(from: number, to: number): number {
  const delta = to - from;
  return delta < 0 ? delta + 1 : delta;
}

function longitudinalSeparation(a: number, b: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1 - direct);
}

function defaultRacecraft(): CpuRacecraft {
  return {
    targetSpeed: 0,
    targetLateral: 0,
    cornerLoad: 0,
    braking: false,
    overtakeLane: 0,
    trafficGapMeters: null,
  };
}

function defaultPlayerHandling(): PlayerHandling {
  return {
    cornerLoad: 0,
    grip: 1,
    steeringResponse: 8,
    brakingDemand: 0,
    understeer: 0,
    assistCentering: DEFAULT_LANE_CENTERING_STRENGTH,
  };
}

function compareRacePosition(a: RacerState, b: RacerState): number {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return b.distance - a.distance;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
