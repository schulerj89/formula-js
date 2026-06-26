import { describe, expect, it } from 'vitest';
import { cpuRacers, playerTemplate } from '../src/data/racers';
import { tracks } from '../src/data/tracks';
import { musicThemes } from '../src/data/audio';
import { createRace } from '../src/game/race';
import { applyCampaignResults, createCampaignScores } from '../src/game/campaign';
import { createReplayRecorder, findReplayFrame } from '../src/game/replay';
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

describe('audio data', () => {
  it('defines four non-race music themes with distinct titles and tempos', () => {
    expect(Object.keys(musicThemes).sort()).toEqual(['finale', 'menu', 'podium', 'prerace']);
    const titles = new Set(Object.values(musicThemes).map((theme) => theme.title));
    expect(titles.size).toBe(4);
    for (const theme of Object.values(musicThemes)) {
      expect(theme.bpm).toBeGreaterThanOrEqual(100);
      expect(theme.bpm).toBeLessThanOrEqual(140);
      expect(theme.leadOffsets.length).toBeGreaterThanOrEqual(8);
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

describe('replay recording', () => {
  it('samples bounded race frames and can play them back by elapsed time', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const recorder = createReplayRecorder(tracks[0].id, tracks[0].name, settings.playerName, 5, 12);
    let snapshot = race.snapshot();
    for (let i = 0; i < 90; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: 0.2 });
      recorder.record(1 / 30, snapshot);
    }
    const replay = recorder.finalize([]);
    expect(replay.frames.length).toBeGreaterThan(4);
    expect(replay.frames.length).toBeLessThanOrEqual(12);
    expect(replay.estimatedBytes).toBeLessThan(10_000);
    expect(replay.droppedSamples).toBeGreaterThan(0);
    expect(findReplayFrame(replay, 0.8)?.racers).toHaveLength(8);
  });
});

describe('campaign scoring', () => {
  it('awards points, wins, and podiums across race results', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const scores = createCampaignScores(racers);
    const results = racers.map((racer, index) => ({
      racerId: racer.id,
      name: racer.name,
      totalTime: 80 + index,
      bestLap: 26,
      damage: 1,
      tires: 1,
    }));
    const next = applyCampaignResults(scores, results);
    expect(next[0].racerId).toBe('player');
    expect(next[0].points).toBe(25);
    expect(next[0].wins).toBe(1);
    expect(next[1].points).toBe(18);
    expect(next[2].podiums).toBe(1);
  });
});
