import type { RaceResult } from '../types';
import type { RaceSnapshot } from './race';

export interface ReplayRacerFrame {
  id: string;
  progress: number;
  lateral: number;
  speed: number;
  lap: number;
}

export interface ReplayFrame {
  time: number;
  racers: ReplayRacerFrame[];
}

export interface RaceReplay {
  trackId: string;
  trackName: string;
  playerName: string;
  duration: number;
  frames: ReplayFrame[];
  results: RaceResult[];
  estimatedBytes: number;
  sampleRate: number;
  droppedSamples: number;
}

export interface ReplayRecorder {
  record: (dt: number, snapshot: RaceSnapshot) => void;
  finalize: (results: RaceResult[]) => RaceReplay;
  frameCount: () => number;
}

const bytesPerNumber = 8;
const numbersPerRacerFrame = 4;
const frameOverheadBytes = 16;

export function createReplayRecorder(trackId: string, trackName: string, playerName: string, sampleRate = 10, maxFrames = 1200): ReplayRecorder {
  const frames: ReplayFrame[] = [];
  const sampleInterval = 1 / sampleRate;
  let elapsed = 0;
  let nextSample = 0;
  let droppedSamples = 0;

  return {
    record(dt, snapshot) {
      elapsed += dt;
      if (elapsed < nextSample) return;
      nextSample = elapsed + sampleInterval;
      if (frames.length >= maxFrames) {
        frames.shift();
        droppedSamples += 1;
      }
      frames.push({
        time: elapsed,
        racers: snapshot.racers.map((racer) => ({
          id: racer.definition.id,
          progress: round(racer.progress),
          lateral: round(racer.lateral),
          speed: round(racer.speed),
          lap: racer.lap,
        })),
      });
    },
    finalize(results) {
      return {
        trackId,
        trackName,
        playerName,
        duration: elapsed,
        frames: [...frames],
        results,
        estimatedBytes: estimateReplayBytes(frames),
        sampleRate,
        droppedSamples,
      };
    },
    frameCount() {
      return frames.length;
    },
  };
}

export function estimateReplayBytes(frames: ReplayFrame[]): number {
  return frames.reduce((total, frame) => total + frameOverheadBytes + frame.racers.length * numbersPerRacerFrame * bytesPerNumber, 0);
}

export function findReplayFrame(replay: RaceReplay, elapsed: number): ReplayFrame | null {
  if (replay.frames.length === 0) return null;
  const wrapped = replay.duration > 0 ? elapsed % replay.duration : 0;
  let frame = replay.frames[0];
  for (const candidate of replay.frames) {
    if (candidate.time > wrapped) break;
    frame = candidate;
  }
  return frame;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
