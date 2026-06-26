import type { TrackDefinition } from '../types';

export const ROAD_WIDTH = 11;
export const DRIVABLE_HALF_WIDTH = ROAD_WIDTH / 2;
export const PROTECTED_ROAD_HALF_WIDTH = DRIVABLE_HALF_WIDTH + 0.35;
export const CAR_COLLISION_RADIUS = 0.9;
export const BASE_GUARDRAIL_BOUNDARY = DRIVABLE_HALF_WIDTH + 2.35 - 0.45 - CAR_COLLISION_RADIUS;
export const PIT_WALL_BOUNDARY = DRIVABLE_HALF_WIDTH + 1.6 - 0.3 - CAR_COLLISION_RADIUS;
export const APEX_MARKER_BOUNDARY = DRIVABLE_HALF_WIDTH + 1.55 - 0.42 - CAR_COLLISION_RADIUS;
export const OFF_TRACK_SLOWDOWN_START = 4.8;

export type TrackCollisionKind = 'guardrail' | 'pit_wall' | 'apex_marker' | 'tire_wall';
export type TrackCollisionSide = -1 | 1 | 'both';

export interface TrackCollisionZone {
  kind: TrackCollisionKind;
  name: string;
  start: number;
  end: number;
  side: TrackCollisionSide;
  boundary: number;
  severityMultiplier: number;
  speedLoss: number;
  damageScale: number;
  tireScale: number;
}

export interface TrackCollisionProfile {
  trackId: string;
  roadHalfWidth: number;
  protectedHalfWidth: number;
  zones: TrackCollisionZone[];
}

export interface TrackSpaceCollision {
  kind: TrackCollisionKind;
  name: string;
  side: -1 | 1;
  boundary: number;
  penetration: number;
  severity: number;
  speedLoss: number;
  damageScale: number;
  tireScale: number;
}

export function createTrackCollisionProfile(track: TrackDefinition): TrackCollisionProfile {
  const zones: TrackCollisionZone[] = [
    {
      kind: 'guardrail',
      name: 'full-course-guardrail',
      start: 0,
      end: 1,
      side: 'both',
      boundary: BASE_GUARDRAIL_BOUNDARY,
      severityMultiplier: 0.82,
      speedLoss: 0.34,
      damageScale: 0.1,
      tireScale: 0.012,
    },
  ];

  for (const [start, end] of track.kerbZones) {
    zones.push({
      kind: 'tire_wall',
      name: `tire-wall-${start.toFixed(3)}-${end.toFixed(3)}`,
      start,
      end,
      side: 'both',
      boundary: DRIVABLE_HALF_WIDTH + 6 - 0.78 - CAR_COLLISION_RADIUS,
      severityMultiplier: 1,
      speedLoss: 0.42,
      damageScale: 0.13,
      tireScale: 0.015,
    });
  }

  for (const apex of track.readability?.apexes ?? []) {
    zones.push({
      kind: 'apex_marker',
      name: `apex-marker-${apex.at.toFixed(3)}-${apex.side}`,
      start: apex.kerb[0],
      end: apex.kerb[1],
      side: apex.side,
      boundary: APEX_MARKER_BOUNDARY,
      severityMultiplier: 0.72,
      speedLoss: 0.22,
      damageScale: 0.055,
      tireScale: 0.02,
    });
  }

  if (track.id === 'marina') {
    zones.push({
      kind: 'pit_wall',
      name: 'marina-pit-wall',
      start: 0.895,
      end: 0.985,
      side: 1,
      boundary: PIT_WALL_BOUNDARY,
      severityMultiplier: 1.08,
      speedLoss: 0.46,
      damageScale: 0.16,
      tireScale: 0.018,
    });
  }

  return {
    trackId: track.id,
    roadHalfWidth: DRIVABLE_HALF_WIDTH,
    protectedHalfWidth: PROTECTED_ROAD_HALF_WIDTH,
    zones,
  };
}

export function resolveTrackSpaceCollision(profile: TrackCollisionProfile, progress: number, lateral: number, speed: number): TrackSpaceCollision | null {
  const side = lateral < 0 ? -1 : 1;
  const absoluteLateral = Math.abs(lateral);
  let activeZone: TrackCollisionZone | null = null;

  for (const zone of profile.zones) {
    if (!zoneMatches(zone, progress, side)) continue;
    if (absoluteLateral <= zone.boundary) continue;
    if (!activeZone || zone.boundary < activeZone.boundary) activeZone = zone;
  }

  if (!activeZone) return null;
  const penetration = absoluteLateral - activeZone.boundary;
  const severity = round(clamp(penetration / 1.35 + speed / 155, 0.08, 1) * activeZone.severityMultiplier);
  return {
    kind: activeZone.kind,
    name: activeZone.name,
    side,
    boundary: activeZone.boundary,
    penetration: round(penetration),
    severity,
    speedLoss: activeZone.speedLoss,
    damageScale: activeZone.damageScale,
    tireScale: activeZone.tireScale,
  };
}

function zoneMatches(zone: TrackCollisionZone, progress: number, side: -1 | 1): boolean {
  if (zone.side !== 'both' && zone.side !== side) return false;
  return progressInRange(normalizeProgress(progress), zone.start, zone.end);
}

function progressInRange(progress: number, start: number, end: number): boolean {
  const normalizedStart = normalizeProgress(start);
  const normalizedEnd = normalizeProgress(end);
  if (normalizedStart === normalizedEnd) return true;
  if (normalizedStart < normalizedEnd) return progress >= normalizedStart && progress <= normalizedEnd;
  return progress >= normalizedStart || progress <= normalizedEnd;
}

function normalizeProgress(progress: number): number {
  const wrapped = progress % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
