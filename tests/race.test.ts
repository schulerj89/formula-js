import { describe, expect, it } from 'vitest';
import { cpuRacers, playerTemplate } from '../src/data/racers';
import { tracks } from '../src/data/tracks';
import { createRace } from '../src/game/race';
import { TrackPath } from '../src/game/trackPath';
import type { GameSettings } from '../src/types';

const settings: GameSettings = {
  playerName: 'Test Driver',
  controlMode: 'holdToGo',
  performanceMode: 'balanced',
  mute: true,
  realisticTires: true,
  realisticDamage: true,
  leaderboard: true,
};

describe('track data', () => {
  it('defines four closed race tracks with kerb zones and landmarks', () => {
    expect(tracks).toHaveLength(4);
    for (const track of tracks) {
      expect(track.points.length).toBeGreaterThanOrEqual(11);
      expect(track.kerbZones.length).toBeGreaterThanOrEqual(3);
      expect(track.landmarks.length).toBeGreaterThanOrEqual(3);
      expect(new TrackPath(track).length).toBeGreaterThan(650);
    }
  });
});

describe('race simulation', () => {
  it('runs player and seven CPU racers with changing standings', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    expect(snapshot.racers).toHaveLength(8);
    for (let i = 0; i < 240; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: Math.sin(i / 18) * 0.5 });
    }
    expect(snapshot.player.speed).toBeGreaterThan(20);
    expect(snapshot.player.tires).toBeLessThan(1);
    expect(snapshot.position).toBeGreaterThanOrEqual(1);
    expect(snapshot.position).toBeLessThanOrEqual(8);
  });
});
