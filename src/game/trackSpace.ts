import type { GameSettings, SteeringAssistMode, TrackDefinition } from '../types';

export const DEFAULT_ROAD_WIDTH = 11;
export const ROAD_WIDTH = DEFAULT_ROAD_WIDTH;
export const DRIVABLE_HALF_WIDTH = ROAD_WIDTH / 2;
export const PROTECTED_ROAD_HALF_WIDTH = DRIVABLE_HALF_WIDTH + 0.35;
export const CAR_COLLISION_RADIUS = 0.9;
export const BASE_GUARDRAIL_BOUNDARY = DRIVABLE_HALF_WIDTH + 2.35 - 0.45 - CAR_COLLISION_RADIUS;
export const PIT_WALL_BOUNDARY = DRIVABLE_HALF_WIDTH + 1.6 - 0.3 - CAR_COLLISION_RADIUS;
export const APEX_MARKER_BOUNDARY = DRIVABLE_HALF_WIDTH + 1.55 - 0.42 - CAR_COLLISION_RADIUS;
export const OFF_TRACK_SLOWDOWN_START = 4.8;
export const DEFAULT_STEERING_ASSIST_MODE: SteeringAssistMode = 'reduced';
export const DEFAULT_STEERING_ASSIST_STRENGTH = 0.34;
export const DEFAULT_LANE_CENTERING_STRENGTH = 0.22;

export interface LateralRange {
  min: number;
  max: number;
}

export interface TrackSpaceProfile {
  trackId: string;
  roadWidth: number;
  drivableHalfWidth: number;
  protectedHalfWidth: number;
  usablePassingWidth: number;
  estimatedLaneCount: number;
  playerLateralRange: LateralRange;
  cpuLateralRange: LateralRange;
  startingGridLateralSpread: number;
  trackEdgeBoundary: number;
  pitWallBoundary: number;
  apexMarkerBoundary: number;
  tireWallBoundary: number;
  offTrackSlowdownStart: number;
}

export interface DrivingAssistSettings {
  steeringAssistMode: SteeringAssistMode;
  steeringAssistStrength: number;
  laneCenteringStrength: number;
}

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
  trackSpace: TrackSpaceProfile;
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

export function createTrackSpaceProfile(track: TrackDefinition): TrackSpaceProfile {
  const roadWidth = Math.max(8, track.roadWidth ?? DEFAULT_ROAD_WIDTH);
  const drivableHalfWidth = roadWidth / 2;
  const protectedHalfWidth = drivableHalfWidth + 0.35;
  const playerLimit = Math.max(3.8, drivableHalfWidth - 1);
  const cpuLimit = Math.max(3.5, drivableHalfWidth - 1.25);
  const usablePassingWidth = round(playerLimit * 2);
  return {
    trackId: track.id,
    roadWidth,
    drivableHalfWidth,
    protectedHalfWidth,
    usablePassingWidth,
    estimatedLaneCount: Math.max(1, Math.floor(usablePassingWidth / 4)),
    playerLateralRange: { min: round(-playerLimit), max: round(playerLimit) },
    cpuLateralRange: { min: round(-cpuLimit), max: round(cpuLimit) },
    startingGridLateralSpread: round(Math.min(playerLimit * 1.75, 9.2)),
    trackEdgeBoundary: round(drivableHalfWidth + 2.35 - 0.45 - CAR_COLLISION_RADIUS),
    pitWallBoundary: round(drivableHalfWidth + 1.6 - 0.3 - CAR_COLLISION_RADIUS),
    apexMarkerBoundary: round(drivableHalfWidth + 1.55 - 0.42 - CAR_COLLISION_RADIUS),
    tireWallBoundary: round(drivableHalfWidth + 6 - 0.78 - CAR_COLLISION_RADIUS),
    offTrackSlowdownStart: round(Math.max(4.8, drivableHalfWidth - 0.7)),
  };
}

export function resolveDrivingAssistSettings(settings?: Partial<Pick<GameSettings, 'steeringAssistMode' | 'steeringAssistStrength' | 'laneCenteringStrength'>>): DrivingAssistSettings {
  const steeringAssistMode = settings?.steeringAssistMode ?? DEFAULT_STEERING_ASSIST_MODE;
  const modeStrength = steeringAssistMode === 'arcade' ? 0.72 : steeringAssistMode === 'reduced' ? DEFAULT_STEERING_ASSIST_STRENGTH : 0;
  const modeCentering = steeringAssistMode === 'arcade' ? 0.78 : steeringAssistMode === 'reduced' ? DEFAULT_LANE_CENTERING_STRENGTH : 0;
  return {
    steeringAssistMode,
    steeringAssistStrength: clamp(settings?.steeringAssistStrength ?? modeStrength, 0, 1),
    laneCenteringStrength: clamp(settings?.laneCenteringStrength ?? modeCentering, 0, 1.6),
  };
}

export function createTrackCollisionProfile(track: TrackDefinition): TrackCollisionProfile {
  const trackSpace = createTrackSpaceProfile(track);
  const zones: TrackCollisionZone[] = [
    {
      kind: 'guardrail',
      name: 'full-course-guardrail',
      start: 0,
      end: 1,
      side: 'both',
      boundary: trackSpace.trackEdgeBoundary,
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
      boundary: trackSpace.tireWallBoundary,
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
      boundary: trackSpace.apexMarkerBoundary,
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
      boundary: trackSpace.pitWallBoundary,
      severityMultiplier: 1.08,
      speedLoss: 0.46,
      damageScale: 0.16,
      tireScale: 0.018,
    });
  }

  return {
    trackId: track.id,
    roadHalfWidth: trackSpace.drivableHalfWidth,
    protectedHalfWidth: trackSpace.protectedHalfWidth,
    trackSpace,
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
