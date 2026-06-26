import { describe, expect, it } from 'vitest';
import { cpuRacers, playerTemplate } from '../src/data/racers';
import { tracks } from '../src/data/tracks';
import { musicThemes } from '../src/data/audio';
import { formulaAssetManifest } from '../src/data/assets';
import { bodyPaintOptions, helmetPaintOptions } from '../src/data/customization';
import { analyzeRaceAudio } from '../src/game/audio';
import { createRace } from '../src/game/race';
import { applyCampaignResults, createCampaignScores } from '../src/game/campaign';
import { createReplayEvents, createReplayRecorder, estimateReplayBytes, findReplayFrame } from '../src/game/replay';
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
  bodyPaint: 'scarlet',
  helmetPaint: 'ivory',
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

  it('maps race state into gear, rev, tire, and kerb audio feedback', () => {
    const calm = analyzeRaceAudio({ speed: 18, lateral: 0.5, damage: 1 }, { throttle: true, brake: false, steer: 0.1 });
    const loaded = analyzeRaceAudio({ speed: 58, lateral: 5.6, damage: 0.8 }, { throttle: true, brake: true, steer: 0.9 });
    expect(calm.gear).toBeGreaterThanOrEqual(1);
    expect(loaded.gear).toBeGreaterThan(calm.gear);
    expect(loaded.engineFrequency).toBeGreaterThan(calm.engineFrequency);
    expect(loaded.tireLoad).toBeGreaterThan(calm.tireLoad);
    expect(loaded.kerbLoad).toBeGreaterThan(calm.kerbLoad);
    expect(loaded.offTrackLoad).toBeGreaterThan(0);
  });
});

describe('customization and asset pipeline data', () => {
  it('defines body and helmet paint options plus modular asset budgets', () => {
    expect(bodyPaintOptions.length).toBeGreaterThanOrEqual(5);
    expect(helmetPaintOptions.length).toBeGreaterThanOrEqual(5);
    expect(formulaAssetManifest.referenceImages.chassis).toContain('formula-chassis-reference.png');
    expect(formulaAssetManifest.plannedGlb.wheel).toContain('formula-wheel.glb');
    expect(formulaAssetManifest.budgets.refinedAssetMaxBytes).toBeLessThanOrEqual(6_000_000);
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
    expect(replay.events.length).toBeGreaterThanOrEqual(3);
    expect(replay.events[0].speaker).toBe('Arthur Bell');
    expect(findReplayFrame(replay, 0.8)?.racers).toHaveLength(8);
  });

  it('creates compact replay highlight events for damage, tire wear, and finish calls', () => {
    const events = createReplayEvents('Test Track', 'Test Driver', 30, [
      { racerId: 'rival', name: 'Luca Venn', totalTime: 30, bestLap: 29, damage: 1, tires: 0.9 },
      { racerId: 'player', name: 'Test Driver', totalTime: 31, bestLap: 30, damage: 0.6, tires: 0.65 },
    ]);
    expect(events.map((event) => event.kind)).toEqual(['opening', 'move', 'damage', 'tires', 'finish']);
    expect(events.every((event, index) => index === 0 || event.time >= events[index - 1].time)).toBe(true);
    expect(events.find((event) => event.kind === 'damage')?.speaker).toBe('Radio');
    expect(events.find((event) => event.kind === 'finish')?.focusRacerId).toBe('rival');
  });

  it('keeps replay event times inside the retained frame window when samples drop', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const recorder = createReplayRecorder(tracks[0].id, tracks[0].name, settings.playerName, 10, 5);
    let snapshot = race.snapshot();
    for (let i = 0; i < 80; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: 0.15 });
      recorder.record(1 / 30, snapshot);
    }
    const replay = recorder.finalize([]);
    expect(replay.droppedSamples).toBeGreaterThan(0);
    expect(replay.frames[0].time).toBe(0);
    expect(replay.duration).toBeLessThan(1);
    expect(replay.events.every((event) => event.time <= replay.duration)).toBe(true);
    expect(findReplayFrame(replay, replay.duration + 0.05)?.racers).toHaveLength(8);
  });

  it('counts replay highlight events in the replay byte estimate', () => {
    const frames = [{ time: 0, racers: [{ id: 'player', progress: 0, lateral: 0, speed: 0, lap: 0 }] }];
    const events = createReplayEvents('Test Track', 'Test Driver', 5, []);
    expect(estimateReplayBytes(frames, events)).toBeGreaterThan(estimateReplayBytes(frames));
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
