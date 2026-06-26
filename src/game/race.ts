import type { GameMode, GameSettings, RacerDefinition, RaceResult, TrackDefinition } from '../types';
import { progressDelta } from './trackPath';

export interface RacerState {
  definition: RacerDefinition;
  progress: number;
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
        updateCpu(state, i, dt, track.difficulty);
      }

      const previous = state.progress;
      const lapDistance = Math.max(0.0001, state.speed * dt / (track.lengthKm * 1000));
      state.progress = (state.progress + lapDistance) % 1;
      if (progressDelta(previous, state.progress) < -0.5 || (previous > 0.94 && state.progress < 0.08)) {
        state.lap += 1;
        state.bestLap = Math.min(state.bestLap, state.currentLapTime);
        state.currentLapTime = 0;
      }
      if (state.lap >= laps) {
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
  state.speed *= 0.55 + state.damage * 0.45;
  state.speed *= 0.72 + state.tires * 0.28;
}

function updateCpu(state: RacerState, index: number, dt: number, difficulty: number): void {
  const wave = Math.sin(state.totalTime * 0.8 + index * 1.7) * 0.5 + 0.5;
  const target = 47 + state.definition.skill * 19 + difficulty * 2 - wave * 5;
  state.speed += (target - state.speed) * dt * 0.65;
  state.lateral = Math.sin(state.totalTime * 0.7 + index) * 2.2;
  state.tires = Math.max(0.15, state.tires - dt * 0.0008);
}

function compareRacePosition(a: RacerState, b: RacerState): number {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  if (a.lap !== b.lap) return b.lap - a.lap;
  return b.progress - a.progress;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
