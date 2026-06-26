import type { RaceResult } from '../types';
import type { RaceCommentaryKind } from './raceCommentary';
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

export type ReplayEventKind = 'opening' | 'move' | 'contact' | 'damage' | 'tires' | 'finish';
export type ReplayRadioKey = 'contact' | 'damage' | 'tires';
export type ReplayEventSourceKind = RaceCommentaryKind | 'timed';

export interface ReplayIncidentMarker {
  time?: number;
  sourceKind: RaceCommentaryKind;
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  text: string;
  focusRacerId: string | null;
  radioKey: ReplayRadioKey | null;
}

export interface ReplayHighlightEvent {
  time: number;
  kind: ReplayEventKind;
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  text: string;
  focusRacerId?: string;
  radioKey: ReplayRadioKey | null;
  sourceKind: ReplayEventSourceKind;
  sourceTime: number;
}

export interface RaceReplay {
  trackId: string;
  trackName: string;
  playerName: string;
  duration: number;
  frames: ReplayFrame[];
  events: ReplayHighlightEvent[];
  incidentCount: number;
  results: RaceResult[];
  estimatedBytes: number;
  sampleRate: number;
  droppedSamples: number;
}

export interface ReplayRecorder {
  record: (dt: number, snapshot: RaceSnapshot) => void;
  markIncident: (marker: ReplayIncidentMarker) => void;
  finalize: (results: RaceResult[]) => RaceReplay;
  frameCount: () => number;
  incidentCount: () => number;
}

const bytesPerNumber = 8;
const numbersPerRacerFrame = 4;
const frameOverheadBytes = 16;

export function createReplayRecorder(trackId: string, trackName: string, playerName: string, sampleRate = 10, maxFrames = 1200): ReplayRecorder {
  const frames: ReplayFrame[] = [];
  const incidents: Required<ReplayIncidentMarker>[] = [];
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
    markIncident(marker) {
      const incidentTime = marker.time ?? elapsed;
      if (incidents.some((incident) => incident.sourceKind === marker.sourceKind && incident.lineId === marker.lineId && Math.abs(incident.time - incidentTime) < 1.25)) {
        return;
      }
      incidents.push({
        ...marker,
        time: incidentTime,
      });
    },
    finalize(results) {
      const retainedStart = frames[0]?.time ?? 0;
      const normalizedFrames = frames.map((frame) => ({
        ...frame,
        time: round(Math.max(0, frame.time - retainedStart)),
      }));
      const retainedDuration = Math.max(normalizedFrames[normalizedFrames.length - 1]?.time ?? 0, sampleInterval);
      const normalizedIncidents = incidents
        .filter((incident) => incident.time >= retainedStart)
        .map((incident) => ({
          ...incident,
          time: round(Math.min(Math.max(0, incident.time - retainedStart), retainedDuration)),
        }));
      const events = createReplayEvents(trackName, playerName, retainedDuration, results, normalizedIncidents);
      return {
        trackId,
        trackName,
        playerName,
        duration: retainedDuration,
        frames: normalizedFrames,
        events,
        incidentCount: normalizedIncidents.length,
        results,
        estimatedBytes: estimateReplayBytes(normalizedFrames, events),
        sampleRate,
        droppedSamples,
      };
    },
    frameCount() {
      return frames.length;
    },
    incidentCount() {
      return incidents.length;
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
      (event.focusRacerId?.length ?? 0) +
      event.sourceKind.length,
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

export function createReplayEvents(
  trackName: string,
  playerName: string,
  duration: number,
  results: RaceResult[],
  incidents: ReplayIncidentMarker[] = [],
): ReplayHighlightEvent[] {
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
      sourceKind: 'timed',
      sourceTime: openingTime,
    },
  ];

  const incidentEvents = incidents
    .filter((incident) => incident.time !== undefined)
    .sort((a, b) => incidentPriority(a.sourceKind) - incidentPriority(b.sourceKind) || (a.time ?? 0) - (b.time ?? 0))
    .slice(0, 3)
    .map((incident) => createIncidentReplayEvent(incident, safeDuration, playerName));

  if (incidentEvents.length > 0) {
    events.push(...incidentEvents);
  } else {
    events.push({
      time: boundedReplayTime(safeDuration, safeDuration * 0.34),
      kind: 'move',
      lineId: 'mags.replay.middle-sector-commitment',
      speaker: 'Mags Whitlow',
      text: 'Watch the middle sector here: confidence on entry, tiny correction, then full commitment on exit.',
      focusRacerId: 'player',
      radioKey: null,
      sourceKind: 'timed',
      sourceTime: boundedReplayTime(safeDuration, safeDuration * 0.34),
    });
  }

  if (playerResult && playerResult.damage < 0.82 && !events.some((event) => event.kind === 'damage')) {
    const time = boundedReplayTime(safeDuration, safeDuration * 0.55);
    events.push({
      time,
      kind: 'damage',
      lineId: 'radio.replay.damage-kerb-bite',
      speaker: 'Radio',
      text: 'Replay confirms the damage warning. The outside kerb took a proper bite.',
      focusRacerId: 'player',
      radioKey: 'damage',
      sourceKind: 'timed',
      sourceTime: time,
    });
  }

  if (playerResult && playerResult.tires < 0.72 && !events.some((event) => event.kind === 'tires')) {
    const time = boundedReplayTime(safeDuration, safeDuration * 0.7);
    events.push({
      time,
      kind: 'tires',
      lineId: 'radio.replay.tires-fading-inputs',
      speaker: 'Radio',
      text: 'The tyres were fading here, and every steering input started costing lap time.',
      focusRacerId: 'player',
      radioKey: 'tires',
      sourceKind: 'timed',
      sourceTime: time,
    });
  }

  const finishTime = boundedReplayTime(safeDuration, Math.max(openingTime, safeDuration - Math.min(0.45, safeDuration * 0.15)));
  events.push({
    time: finishTime,
    kind: 'finish',
    lineId: winner?.racerId === 'player' ? 'mags.replay.finish-player-win' : 'arthur.replay.finish-rival-win',
    speaker: winner?.racerId === 'player' ? 'Mags Whitlow' : 'Arthur Bell',
    text: winner
      ? `${winner.name} reaches the flag first. That is the replay headline, neat as you like.`
      : 'The flag falls, and the replay has shown exactly where this race turned.',
    focusRacerId: winner?.racerId,
    radioKey: null,
    sourceKind: 'timed',
    sourceTime: finishTime,
  });

  return events.sort((a, b) => a.time - b.time);
}

function createIncidentReplayEvent(incident: ReplayIncidentMarker, duration: number, playerName: string): ReplayHighlightEvent {
  const time = boundedReplayTime(duration, incident.time ?? 0);
  const focusRacerId = incident.focusRacerId ?? 'player';
  if (incident.sourceKind === 'radio-team-contact') {
    return {
      time,
      kind: 'contact',
      lineId: 'radio.replay.contact-check',
      speaker: 'Radio',
      text: 'Replay shows the contact point. Check the front wing, then give them room.',
      focusRacerId,
      radioKey: 'contact',
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  if (incident.sourceKind === 'radio-team-damage') {
    return {
      time,
      kind: 'damage',
      lineId: 'radio.replay.damage-kerb-bite',
      speaker: 'Radio',
      text: 'Replay confirms the damage warning. The outside kerb took a proper bite.',
      focusRacerId: 'player',
      radioKey: 'damage',
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  if (incident.sourceKind === 'radio-team-tires') {
    return {
      time,
      kind: 'tires',
      lineId: 'radio.replay.tires-fading-inputs',
      speaker: 'Radio',
      text: 'The tyres were fading here, and every steering input started costing lap time.',
      focusRacerId: 'player',
      radioKey: 'tires',
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  if (incident.sourceKind === 'position-lost') {
    return {
      time,
      kind: 'move',
      lineId: 'arthur.replay.incident-reset',
      speaker: 'Arthur Bell',
      text: `Replay marks the moment ${playerName} had to reset after the position slipped away.`,
      focusRacerId,
      radioKey: null,
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  if (incident.sourceKind === 'spotter-side') {
    return {
      time,
      kind: 'move',
      lineId: 'radio.replay.side-by-side',
      speaker: 'Radio',
      text: 'Replay catches the side-by-side squeeze. Holding the line was the right call.',
      focusRacerId,
      radioKey: null,
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  if (incident.sourceKind === 'spotter-closing') {
    return {
      time,
      kind: 'move',
      lineId: 'radio.replay.closing-traffic',
      speaker: 'Radio',
      text: 'Replay picks up the closing traffic before the braking zone. That gap was shrinking fast.',
      focusRacerId,
      radioKey: null,
      sourceKind: incident.sourceKind,
      sourceTime: time,
    };
  }
  return {
    time,
    kind: 'move',
    lineId: 'mags.replay.incident-pass',
    speaker: 'Mags Whitlow',
    text: `${playerName} made this move stick right here. Brave timing, tidy exit, no wasted road.`,
    focusRacerId,
    radioKey: null,
    sourceKind: incident.sourceKind,
    sourceTime: time,
  };
}

function incidentPriority(kind: ReplayEventSourceKind): number {
  if (kind === 'radio-team-contact') return 0;
  if (kind === 'radio-team-damage' || kind === 'radio-team-tires') return 1;
  if (kind === 'position-gained' || kind === 'position-lost') return 2;
  if (kind === 'spotter-side' || kind === 'spotter-closing') return 3;
  return 4;
}

function boundedReplayTime(duration: number, value: number): number {
  return round(Math.min(Math.max(0, value), duration));
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
