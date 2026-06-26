import type { GameMode, GameSettings, RacerDefinition, RaceResult, TrackDefinition } from '../types';

export interface RacerState {
  definition: RacerDefinition;
  progress: number;
  distance: number;
  lap: number;
  speed: number;
  lateral: number;
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
}

export interface RaceControl {
  throttle: boolean;
  brake: boolean;
  steer: number;
}

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
  const states: RacerState[] = racers.map((definition, index) => ({
    definition,
    progress: 0.985 - index * 0.006,
    distance: 0,
    lap: 0,
    speed: 0,
    lateral: (index % 2 === 0 ? -1 : 1) * (1.1 + Math.floor(index / 2) * 1.15),
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
      state.lastContactSeverity = Math.max(0, state.lastContactSeverity - dt * 1.4);

      if (i === 0) {
        updatePlayer(state, control, dt, settings, track);
      } else {
        updateCpu(state, i, dt, track, states);
      }

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
    applyCarContacts(states, track, settings);

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

function updatePlayer(state: RacerState, control: RaceControl, dt: number, settings: GameSettings, track: TrackDefinition): void {
  const handling = analyzePlayerHandling(state, control, track);
  state.handling = handling;
  const throttle = control.throttle ? 28 * (1 - handling.cornerLoad * 0.1) : 0;
  const brake = control.brake ? 42 * (1 + handling.cornerLoad * 0.12) : 0;
  const cornerDrag = handling.cornerLoad * Math.max(0, state.speed - 44) * (control.brake ? 0.04 : 0.085);
  const drag = 9 + Math.abs(control.steer) * 4 + handling.understeer * 8 + cornerDrag;
  state.speed += (throttle - brake - drag) * dt;
  state.speed = clamp(state.speed, 0, 82);
  state.lateral += control.steer * dt * handling.steeringResponse * Math.max(0.25, state.speed / 60);
  const offTrack = Math.max(0, Math.abs(state.lateral) - 4.8);
  if (offTrack > 0) {
    state.speed *= 1 - Math.min(0.65, offTrack * dt * 0.7);
    if (settings.realisticDamage) state.damage = Math.max(0, state.damage - offTrack * dt * 0.025);
  }
  state.lateral *= 1 - dt * 1.6;
  if (settings.realisticTires) {
    const wear = (0.002 + Math.abs(control.steer) * 0.012 + (control.brake ? 0.01 : 0) + handling.cornerLoad * 0.004 + handling.understeer * 0.012) * dt;
    state.tires = Math.max(0, state.tires - wear);
  }
  const conditionLimit = 82 * (0.55 + state.damage * 0.45) * (0.72 + state.tires * 0.28);
  state.speed = Math.min(state.speed, conditionLimit);
}

export function analyzePlayerHandling(
  state: Pick<RacerState, 'progress' | 'speed' | 'tires' | 'damage' | 'lateral'>,
  control: RaceControl,
  track: TrackDefinition,
): PlayerHandling {
  const cornerLoad = cornerPressure(state.progress, track);
  const speedLoad = clamp((state.speed - 34) / 48, 0, 1);
  const steeringLoad = Math.abs(control.steer);
  const conditionGrip = 0.6 + clamp(state.tires, 0, 1) * 0.27 + clamp(state.damage, 0, 1) * 0.13;
  const lateralLoad = clamp(Math.abs(state.lateral) / 5.2, 0, 1);
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
  };
}

function updateCpu(state: RacerState, index: number, dt: number, track: TrackDefinition, states: RacerState[]): void {
  const racecraft = analyzeCpuRacecraft(state, index, states, track);
  state.racecraft = racecraft;
  const speedResponse = racecraft.braking ? 1.55 : 0.72;
  state.speed += (racecraft.targetSpeed - state.speed) * dt * speedResponse;
  state.speed = clamp(state.speed, 0, 84);
  const lateralResponse = Math.min(1, dt * (racecraft.overtakeLane ? 2.6 : 1.8));
  state.lateral += (racecraft.targetLateral - state.lateral) * lateralResponse;
  const lateralLoad = Math.abs(state.lateral) / 4.8;
  state.tires = Math.max(0.15, state.tires - dt * (0.0007 + racecraft.cornerLoad * 0.0012 + lateralLoad * 0.0005));
  if (Math.abs(state.lateral) > 4.8) state.damage = Math.max(0.35, state.damage - dt * 0.01);
}

export function analyzeCpuRacecraft(state: RacerState, index: number, states: RacerState[], track: TrackDefinition): CpuRacecraft {
  const cornerLoad = cornerPressure(state.progress, track);
  const baseSpeed = 50 + state.definition.skill * 18 + track.difficulty * 1.6;
  const cornerSpeedLoss = cornerLoad * (14 + track.difficulty * 2.4);
  const lane = ((index % 3) - 1) * 1.05;
  const cornerSide = index % 2 === 0 ? -1 : 1;
  let targetLateral = lane * (1 - cornerLoad) + cornerSide * 2.65 * cornerLoad;
  let targetSpeed = baseSpeed - cornerSpeedLoss;
  let overtakeLane: -1 | 0 | 1 = 0;
  let trafficGapMeters: number | null = null;
  const traffic = nearestTrafficAhead(state, states, track.lengthKm);
  if (traffic && traffic.gapMeters < 82 && state.definition.skill >= traffic.racer.definition.skill - 0.05) {
    overtakeLane = index % 2 === 0 ? 1 : -1;
    trafficGapMeters = traffic.gapMeters;
    targetLateral += overtakeLane * (1.25 + (82 - traffic.gapMeters) / 82);
    targetSpeed += 4.5;
  }
  targetSpeed *= 0.82 + state.tires * 0.18;
  return {
    targetSpeed: clamp(targetSpeed, 32, 82),
    targetLateral: clamp(targetLateral, -4.25, 4.25),
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

function applyCarContacts(states: RacerState[], track: TrackDefinition, settings: GameSettings): void {
  for (let aIndex = 0; aIndex < states.length; aIndex += 1) {
    const a = states[aIndex];
    if (a.finished) continue;
    for (let bIndex = aIndex + 1; bIndex < states.length; bIndex += 1) {
      const b = states[bIndex];
      if (b.finished || a.contactCooldown > 0 || b.contactCooldown > 0) continue;
      const contact = analyzeCarContact(a, b, track.lengthKm);
      if (!contact.overlap) continue;
      applyContactToPair(a, b, contact.severity, settings);
    }
  }
}

function applyContactToPair(a: RacerState, b: RacerState, severity: number, settings: GameSettings): void {
  const pushDirection = a.lateral <= b.lateral ? -1 : 1;
  a.lateral = clamp(a.lateral + pushDirection * severity * 0.72, -5.4, 5.4);
  b.lateral = clamp(b.lateral - pushDirection * severity * 0.72, -5.4, 5.4);
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
  };
}

function compareRacePosition(a: RacerState, b: RacerState): number {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return b.distance - a.distance;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
