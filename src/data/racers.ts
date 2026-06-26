import type { RacerDefinition } from '../types';

export const playerTemplate: RacerDefinition = {
  id: 'player',
  name: 'Player',
  shortName: 'YOU',
  color: 0xe53935,
  helmet: 0xfff8e1,
  skill: 1,
};

export const cpuRacers: RacerDefinition[] = [
  { id: 'cpu-1', name: 'Luca Venn', shortName: 'VEN', color: 0x2f80ed, helmet: 0xffffff, skill: 0.94 },
  { id: 'cpu-2', name: 'Maya Cross', shortName: 'CRO', color: 0x00a676, helmet: 0x101820, skill: 0.91 },
  { id: 'cpu-3', name: 'Theo Pike', shortName: 'PIK', color: 0xffc857, helmet: 0x243b53, skill: 0.88 },
  { id: 'cpu-4', name: 'Nina Vale', shortName: 'VAL', color: 0x6c63ff, helmet: 0xf8f7ff, skill: 0.86 },
  { id: 'cpu-5', name: 'Arjun Stone', shortName: 'STO', color: 0xff6b6b, helmet: 0x12263a, skill: 0.84 },
  { id: 'cpu-6', name: 'Bea Hart', shortName: 'HAR', color: 0x12b5cb, helmet: 0xf4d35e, skill: 0.82 },
  { id: 'cpu-7', name: 'Oscar Flint', shortName: 'FLI', color: 0xf45b69, helmet: 0x1d1e2c, skill: 0.8 },
];
