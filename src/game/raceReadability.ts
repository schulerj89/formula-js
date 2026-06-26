import type { RaceSnapshot, RacerState } from './race';
import type { TrackDefinition } from '../types';

export interface TrackMapLayout {
  size: number;
  routePoints: string;
  project: (x: number, z: number) => { x: number; y: number };
}

export interface RivalGap {
  racerId: string;
  shortName: string;
  meters: number;
  closingRate: number;
  closing: boolean;
}

export interface SideBySideWarning {
  racerId: string;
  shortName: string;
  side: 'left' | 'right';
  meters: number;
}

export interface RaceReadabilitySummary {
  position: number;
  totalRacers: number;
  nearestAhead: RivalGap | null;
  nearestBehind: RivalGap | null;
  sideBySide: SideBySideWarning | null;
  nextBrakeMeters: number | null;
  brakeUrgency: 'clear' | 'soon' | 'now';
}

export function createTrackMapLayout(track: TrackDefinition, size = 128, padding = 12): TrackMapLayout {
  const xs = track.points.map(([x]) => x);
  const zs = track.points.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const drawable = Math.max(1, size - padding * 2);
  const scale = drawable / Math.max(spanX, spanZ);
  const offsetX = (size - spanX * scale) / 2;
  const offsetY = (size - spanZ * scale) / 2;
  const project = (x: number, z: number) => ({
    x: Math.round((offsetX + (x - minX) * scale) * 10) / 10,
    y: Math.round((offsetY + (z - minZ) * scale) * 10) / 10,
  });
  const closedPoints = [...track.points, track.points[0]];
  const routePoints = closedPoints.map(([x, z]) => {
    const point = project(x, z);
    return `${point.x},${point.y}`;
  }).join(' ');
  return { size, routePoints, project };
}

export function summarizeRaceReadability(snapshot: RaceSnapshot, track: TrackDefinition): RaceReadabilitySummary {
  const playerIndex = snapshot.standings.findIndex((state) => state.definition.id === snapshot.player.definition.id);
  const nearestAhead = playerIndex > 0 ? createAheadGap(snapshot.standings[playerIndex - 1], snapshot.player, track.lengthKm) : null;
  const nearestBehind =
    playerIndex >= 0 && playerIndex < snapshot.standings.length - 1
      ? createBehindGap(snapshot.standings[playerIndex + 1], snapshot.player, track.lengthKm)
      : null;
  const nextBrakeMeters = nextBrakeZoneMeters(snapshot.player.progress, track);
  const brakeUrgency = nextBrakeMeters !== null && nextBrakeMeters < Math.max(45, snapshot.player.speed * 1.05) ? 'now' : nextBrakeMeters !== null && nextBrakeMeters < 180 ? 'soon' : 'clear';
  return {
    position: snapshot.position,
    totalRacers: snapshot.standings.length,
    nearestAhead,
    nearestBehind,
    sideBySide: findSideBySide(snapshot.player, snapshot.racers, track.lengthKm),
    nextBrakeMeters,
    brakeUrgency,
  };
}

function createAheadGap(rival: RacerState, player: RacerState, trackLengthKm: number): RivalGap | null {
  return createGap(rival, racerDistance(rival) - racerDistance(player), player.speed - rival.speed, trackLengthKm);
}

function createBehindGap(rival: RacerState, player: RacerState, trackLengthKm: number): RivalGap | null {
  return createGap(rival, racerDistance(player) - racerDistance(rival), rival.speed - player.speed, trackLengthKm);
}

function createGap(rival: RacerState, distanceDelta: number, closingRate: number, trackLengthKm: number): RivalGap | null {
  let gap = distanceDelta;
  if (gap < 0) gap += 1;
  if (gap < 0) return null;
  const roundedClosingRate = Math.round(closingRate * 10) / 10;
  return {
    racerId: rival.definition.id,
    shortName: rival.definition.shortName,
    meters: Math.round(gap * trackLengthKm * 1000),
    closingRate: roundedClosingRate,
    closing: roundedClosingRate > 1.5,
  };
}

function findSideBySide(player: RacerState, racers: RacerState[], trackLengthKm: number): SideBySideWarning | null {
  let closest: SideBySideWarning | null = null;
  for (const rival of racers) {
    if (rival === player || rival.finished) continue;
    const meters = Math.round(longitudinalSeparation(player.distance, rival.distance) * trackLengthKm * 1000);
    if (meters > 22) continue;
    const lateralDelta = rival.lateral - player.lateral;
    if (Math.abs(lateralDelta) < 0.9) continue;
    const warning = {
      racerId: rival.definition.id,
      shortName: rival.definition.shortName,
      side: lateralDelta < 0 ? 'left' : 'right',
      meters,
    } satisfies SideBySideWarning;
    if (!closest || warning.meters < closest.meters) closest = warning;
  }
  return closest;
}

function nextBrakeZoneMeters(progress: number, track: TrackDefinition): number | null {
  if (track.kerbZones.length === 0) return null;
  const entry = track.kerbZones
    .map(([start]) => forwardProgressDistance(progress, start))
    .sort((a, b) => a - b)[0];
  return Math.round(entry * track.lengthKm * 1000);
}

function longitudinalSeparation(a: number, b: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1 - direct);
}

function forwardProgressDistance(from: number, to: number): number {
  const fromWrapped = wrap01(from);
  const toWrapped = wrap01(to);
  const delta = toWrapped - fromWrapped;
  return delta < 0 ? delta + 1 : delta;
}

function wrap01(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function racerDistance(state: RacerState): number {
  return state.distance;
}
