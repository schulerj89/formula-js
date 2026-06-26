import { describe, expect, it, vi } from 'vitest';
import { cpuRacers, playerTemplate } from '../src/data/racers';
import { tracks } from '../src/data/tracks';
import { musicThemes } from '../src/data/audio';
import { formulaAssetManifest } from '../src/data/assets';
import { bodyPaintOptions, helmetPaintOptions } from '../src/data/customization';
import { elevenLabsSongAssets, elevenLabsVoiceAssets, matchVoiceAsset } from '../src/data/elevenlabs';
import { analyzeRaceAudio, RaceAudio } from '../src/game/audio';
import { createRace } from '../src/game/race';
import { createTrackMapLayout, summarizeRaceReadability } from '../src/game/raceReadability';
import { applyCampaignResults, createCampaignScores } from '../src/game/campaign';
import { createReplayEvents, createReplayRecorder, estimateReplayBytes, findReplayFrame } from '../src/game/replay';
import { createPodiumCeremony } from '../src/game/scene';
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

function createFakeAudioContext(): AudioContext {
  const createAudioParam = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const createNode = () => ({
    type: 'sine',
    frequency: createAudioParam(),
    gain: createAudioParam(),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  return {
    currentTime: 0,
    destination: {},
    createGain: createNode,
    createOscillator: createNode,
  } as unknown as AudioContext;
}

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

  it('builds a three-step podium ceremony with finale confetti scaling', () => {
    const path = new TrackPath(tracks[0]);
    const racePodium = createPodiumCeremony(path, tracks[0], false);
    const finalePodium = createPodiumCeremony(path, tracks[0], true);
    expect(racePodium.slots.map((slot) => slot.rank).sort()).toEqual([1, 2, 3]);
    expect(racePodium.stats.platforms).toBe(3);
    expect(racePodium.stats.lightRigs).toBe(2);
    expect(racePodium.stats.confettiPieces).toBe(90);
    expect(finalePodium.stats.confettiPieces).toBeGreaterThan(racePodium.stats.confettiPieces);
    expect(finalePodium.stats.finaleMode).toBe(true);
  });

  it('projects each circuit into a bounded live track map route', () => {
    for (const track of tracks) {
      const layout = createTrackMapLayout(track);
      const coordinates = layout.routePoints.split(' ').map((pair) => pair.split(',').map(Number));
      expect(coordinates).toHaveLength(track.points.length + 1);
      expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1]);
      for (const [x, y] of coordinates) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(layout.size);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(layout.size);
      }
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

  it('maps ElevenLabs runtime assets to non-race music cues and key voice lines', () => {
    expect(elevenLabsSongAssets.map((asset) => asset.cue).sort()).toEqual(['finale', 'menu', 'podium', 'prerace']);
    expect(elevenLabsVoiceAssets).toHaveLength(3);
    expect(
      matchVoiceAsset('Arthur Bell', 'Silverpine Switchback looks magnificent today: fast entries, dangerous exits, and very honest kerbs.')?.id,
    ).toBe('arthur-prerace');
    expect(matchVoiceAsset('Mags Whitlow', 'Five red lights, then it is noise, nerves, and no excuses.')?.id).toBe('mags-lights');
    expect(matchVoiceAsset('Radio', 'Damage is climbing. Stay off the outside kerbs and bring it home.')?.id).toBe('radio-damage');
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

  it('falls back to procedural music after generated song playback rejects', async () => {
    const audio = new RaceAudio({ ...settings, mute: false });
    const menuTheme = musicThemes.menu;
    const generatedSong = {
      dataset: { assetId: 'menu-gridline-spark' },
      currentTime: 0,
      pause: vi.fn(),
      play: vi.fn(() => Promise.reject(new Error('blocked'))),
    } as unknown as HTMLAudioElement;
    const internals = audio as unknown as {
      context: AudioContext;
      loadedSongs: Map<string, HTMLAudioElement>;
    };
    internals.context = createFakeAudioContext();
    internals.loadedSongs.set('menu', generatedSong);

    audio.playMusic(menuTheme, 1);
    await Promise.resolve();
    await Promise.resolve();
    audio.playMusic(menuTheme, 1);

    const metrics = audio.metrics();
    expect(metrics.assets.assetErrors).toBe(1);
    expect(metrics.assets.generatedMusicEvents).toBe(0);
    expect(metrics.assets.activeGeneratedMusic).toBeNull();
    expect(metrics.assets.fallbackMusicEvents).toBeGreaterThan(0);
  });

  it('falls back to browser speech after generated voice playback rejects', async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class FakeSpeechSynthesisUtterance {
      rate = 1;
      pitch = 1;
      volume = 1;
      voice?: SpeechSynthesisVoice;

      constructor(readonly text: string) {}
    }
    vi.stubGlobal('window', {
      speechSynthesis: {
        cancel,
        getVoices: () => [],
        speak,
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance);
    try {
      const audio = new RaceAudio({ ...settings, mute: false });
      const generatedVoice = {
        currentTime: 0,
        play: vi.fn(() => Promise.reject(new Error('decode failed'))),
      } as unknown as HTMLAudioElement;
      const internals = audio as unknown as {
        loadedVoices: Map<string, HTMLAudioElement>;
      };
      internals.loadedVoices.set('mags-lights', generatedVoice);

      audio.speak('Mags Whitlow', 'Five red lights, then it is noise, nerves, and no excuses.');
      await Promise.resolve();
      await Promise.resolve();

      const metrics = audio.metrics();
      expect(metrics.assets.assetErrors).toBe(1);
      expect(metrics.assets.generatedSpeechEvents).toBe(0);
      expect(metrics.assets.fallbackSpeechEvents).toBe(1);
      expect(cancel).toHaveBeenCalledOnce();
      expect(speak).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('keeps time attack active beyond the smoke-test launch window', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 8 * 30; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: 0 });
    }
    expect(snapshot.complete).toBe(false);
    expect(snapshot.player.finished).toBe(false);
    expect(snapshot.player.lap).toBe(0);
    expect(snapshot.player.distance).toBeLessThan(1);
    expect(snapshot.player.totalTime).toBeGreaterThanOrEqual(7.9);
  });

  it('requires a plausible driven lap before completing time attack', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 120 * 30 && !snapshot.complete; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: 0 });
    }
    expect(snapshot.complete).toBe(true);
    expect(snapshot.player.finishTime).toBeGreaterThan(45);
    expect(snapshot.player.finishTime).toBeLessThan(90);
    expect(snapshot.player.lap).toBe(1);
  });

  it('summarizes nearest rivals for the mobile race readout', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 180; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: 0.1 });
    }
    const summary = summarizeRaceReadability(snapshot, tracks[0].lengthKm);
    expect(summary.totalRacers).toBe(8);
    expect(summary.position).toBe(snapshot.position);
    expect(summary.nearestAhead?.meters ?? 0).toBeGreaterThanOrEqual(0);
    expect(summary.nearestBehind?.meters ?? 0).toBeGreaterThanOrEqual(0);
    expect([summary.nearestAhead?.shortName, summary.nearestBehind?.shortName].filter(Boolean).length).toBeGreaterThan(0);
    expect(summary.nearestAhead?.racerId).not.toBe('player');
    expect(summary.nearestBehind?.racerId).not.toBe('player');
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
