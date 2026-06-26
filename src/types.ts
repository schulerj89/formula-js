export type GameMode = 'campaign' | 'timeAttack';
export type GameState = 'menu' | 'setup' | 'tutorial' | 'prerace' | 'race' | 'podium' | 'replay' | 'finale';
export type ControlMode = 'holdToGo' | 'splitPedals';
export type PerformanceMode = 'balanced' | 'highDetail' | 'battery';

export interface TrackDefinition {
  id: string;
  name: string;
  country: string;
  lengthKm: number;
  laps: number;
  difficulty: number;
  scenery: 'forest' | 'harbor' | 'city' | 'alpine';
  palette: {
    ground: number;
    road: number;
    accent: number;
    sky: number;
  };
  points: Array<[number, number]>;
  kerbZones: Array<[number, number]>;
  landmarks: Array<{ label: string; at: number; kind: 'tower' | 'bridge' | 'grandstand' | 'tunnel' }>;
}

export interface RacerDefinition {
  id: string;
  name: string;
  shortName: string;
  color: number;
  helmet: number;
  skill: number;
}

export interface RaceResult {
  racerId: string;
  name: string;
  totalTime: number;
  bestLap: number;
  damage: number;
  tires: number;
}

export interface GameSettings {
  playerName: string;
  controlMode: ControlMode;
  performanceMode: PerformanceMode;
  mute: boolean;
  realisticTires: boolean;
  realisticDamage: boolean;
  leaderboard: boolean;
  bodyPaint: string;
  helmetPaint: string;
}
