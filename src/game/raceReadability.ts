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
}

export interface RaceReadabilitySummary {
  position: number;
  totalRacers: number;
  nearestAhead: RivalGap | null;
  nearestBehind: RivalGap | null;
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

export function summarizeRaceReadability(snapshot: RaceSnapshot, trackLengthKm: number): RaceReadabilitySummary {
  const playerIndex = snapshot.standings.findIndex((state) => state.definition.id === snapshot.player.definition.id);
  const nearestAhead = playerIndex > 0 ? createAheadGap(snapshot.standings[playerIndex - 1], snapshot.player, trackLengthKm) : null;
  const nearestBehind =
    playerIndex >= 0 && playerIndex < snapshot.standings.length - 1
      ? createBehindGap(snapshot.standings[playerIndex + 1], snapshot.player, trackLengthKm)
      : null;
  return {
    position: snapshot.position,
    totalRacers: snapshot.standings.length,
    nearestAhead,
    nearestBehind,
  };
}

function createAheadGap(rival: RacerState, player: RacerState, trackLengthKm: number): RivalGap | null {
  return createGap(rival, racerDistance(rival) - racerDistance(player), trackLengthKm);
}

function createBehindGap(rival: RacerState, player: RacerState, trackLengthKm: number): RivalGap | null {
  return createGap(rival, racerDistance(player) - racerDistance(rival), trackLengthKm);
}

function createGap(rival: RacerState, distanceDelta: number, trackLengthKm: number): RivalGap | null {
  let gap = distanceDelta;
  if (gap < 0) gap += 1;
  if (gap < 0) return null;
  return {
    racerId: rival.definition.id,
    shortName: rival.definition.shortName,
    meters: Math.round(gap * trackLengthKm * 1000),
  };
}

function racerDistance(state: RacerState): number {
  return state.distance;
}
