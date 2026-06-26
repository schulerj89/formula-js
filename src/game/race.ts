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
}

export interface CpuRacecraft {
  targetSpeed: number;
  targetLateral: number;
  cornerLoad: number;
  braking: boolean;
  overtakeLane: -1 | 0 | 1;
  trafficGapMeters: number | null;
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
  }));
  const player = states[0];

  const update = (dt: number, control: RaceControl): RaceSnapshot => {
    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      if (state.finished) continue;
      state.totalTime += dt;
      state.currentLapTime += dt;

      if (i === 0) {
        updatePlayer(state, control, dt, settings);
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

function updatePlayer(state: RacerState, control: RaceControl, dt: number, settings: GameSettings): void {
  const throttle = control.throttle ? 28 : 0;
  const brake = control.brake ? 42 : 0;
  const drag = 9 + Math.abs(control.steer) * 4;
  state.speed += (throttle - brake - drag) * dt;
  state.speed = clamp(state.speed, 0, 82);
  state.lateral += control.steer * dt * 8 * Math.max(0.25, state.speed / 60);
  const offTrack = Math.max(0, Math.abs(state.lateral) - 4.8);
  if (offTrack > 0) {
    state.speed *= 1 - Math.min(0.65, offTrack * dt * 0.7);
    if (settings.realisticDamage) state.damage = Math.max(0, state.damage - offTrack * dt * 0.025);
  }
  state.lateral *= 1 - dt * 1.6;
  if (settings.realisticTires) {
    const wear = (0.002 + Math.abs(control.steer) * 0.012 + (control.brake ? 0.01 : 0)) * dt;
    state.tires = Math.max(0, state.tires - wear);
  }
  const conditionLimit = 82 * (0.55 + state.damage * 0.45) * (0.72 + state.tires * 0.28);
  state.speed = Math.min(state.speed, conditionLimit);
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

function progressInRange(progress: number, start: number, end: number): boolean {
  if (start <= end) return progress >= start && progress <= end;
  return progress >= start || progress <= end;
}

function forwardProgressDistance(from: number, to: number): number {
  const delta = to - from;
  return delta < 0 ? delta + 1 : delta;
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

function compareRacePosition(a: RacerState, b: RacerState): number {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return b.distance - a.distance;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
