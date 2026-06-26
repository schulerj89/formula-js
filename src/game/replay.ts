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

export type ReplayEventKind = 'opening' | 'move' | 'damage' | 'tires' | 'finish';
export type ReplayRadioKey = 'damage' | 'tires';

export interface ReplayHighlightEvent {
  time: number;
  kind: ReplayEventKind;
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  text: string;
  focusRacerId?: string;
  radioKey: ReplayRadioKey | null;
}

export interface RaceReplay {
  trackId: string;
  trackName: string;
  playerName: string;
  duration: number;
  frames: ReplayFrame[];
  events: ReplayHighlightEvent[];
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
      const retainedStart = frames[0]?.time ?? 0;
      const normalizedFrames = frames.map((frame) => ({
        ...frame,
        time: round(Math.max(0, frame.time - retainedStart)),
      }));
      const retainedDuration = Math.max(normalizedFrames[normalizedFrames.length - 1]?.time ?? 0, sampleInterval);
      const events = createReplayEvents(trackName, playerName, retainedDuration, results);
      return {
        trackId,
        trackName,
        playerName,
        duration: retainedDuration,
        frames: normalizedFrames,
        events,
        results,
        estimatedBytes: estimateReplayBytes(normalizedFrames, events),
        sampleRate,
        droppedSamples,
      };
    },
    frameCount() {
      return frames.length;
    },
  };
}

export function estimateReplayBytes(frames: ReplayFrame[], events: ReplayHighlightEvent[] = []): number {
  const frameBytes = frames.reduce((total, frame) => total + frameOverheadBytes + frame.racers.length * numbersPerRacerFrame * bytesPerNumber, 0);
  const eventBytes = events.reduce(
    (total, event) =>
      total +
      32 +
      event.text.length * 2 +
      event.speaker.length * 2 +
      event.kind.length +
      event.lineId.length +
      (event.radioKey?.length ?? 0) +
      (event.focusRacerId?.length ?? 0),
    0,
  );
  return frameBytes + eventBytes;
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

export function createReplayEvents(trackName: string, playerName: string, duration: number, results: RaceResult[]): ReplayHighlightEvent[] {
  const safeDuration = Math.max(0.001, duration);
  const winner = results[0];
  const playerResult = results.find((result) => result.racerId === 'player') ?? results[0];
  const openingTime = boundedReplayTime(safeDuration, Math.min(0.25, safeDuration * 0.2));
  const events: ReplayHighlightEvent[] = [
    {
      time: openingTime,
      kind: 'opening',
      lineId: 'arthur.replay.opening-launch',
      speaker: 'Arthur Bell',
      text: `${trackName} replay begins with ${playerName} launching into a very crowded bit of tarmac.`,
      focusRacerId: 'player',
      radioKey: null,
    },
    {
      time: boundedReplayTime(safeDuration, safeDuration * 0.34),
      kind: 'move',
      lineId: 'mags.replay.middle-sector-commitment',
      speaker: 'Mags Whitlow',
      text: 'Watch the middle sector here: confidence on entry, tiny correction, then full commitment on exit.',
      focusRacerId: 'player',
      radioKey: null,
    },
  ];

  if (playerResult && playerResult.damage < 0.82) {
    events.push({
      time: boundedReplayTime(safeDuration, safeDuration * 0.55),
      kind: 'damage',
      lineId: 'radio.replay.damage-kerb-bite',
      speaker: 'Radio',
      text: 'Replay confirms the damage warning. The outside kerb took a proper bite.',
      focusRacerId: 'player',
      radioKey: 'damage',
    });
  }

  if (playerResult && playerResult.tires < 0.72) {
    events.push({
      time: boundedReplayTime(safeDuration, safeDuration * 0.7),
      kind: 'tires',
      lineId: 'radio.replay.tires-fading-inputs',
      speaker: 'Radio',
      text: 'The tyres were fading here, and every steering input started costing lap time.',
      focusRacerId: 'player',
      radioKey: 'tires',
    });
  }

  events.push({
    time: boundedReplayTime(safeDuration, Math.max(openingTime, safeDuration - Math.min(0.45, safeDuration * 0.15))),
    kind: 'finish',
    lineId: winner?.racerId === 'player' ? 'mags.replay.finish-player-win' : 'arthur.replay.finish-rival-win',
    speaker: winner?.racerId === 'player' ? 'Mags Whitlow' : 'Arthur Bell',
    text: winner
      ? `${winner.name} reaches the flag first. That is the replay headline, neat as you like.`
      : 'The flag falls, and the replay has shown exactly where this race turned.',
    focusRacerId: winner?.racerId,
    radioKey: null,
  });

  return events.sort((a, b) => a.time - b.time);
}

function boundedReplayTime(duration: number, value: number): number {
  return round(Math.min(Math.max(0, value), duration));
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
