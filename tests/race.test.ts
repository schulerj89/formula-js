import { describe, expect, it, vi } from 'vitest';
import { cpuRacers, playerTemplate } from '../src/data/racers';
import { tracks } from '../src/data/tracks';
import { musicThemes } from '../src/data/audio';
import { formulaAssetManifest } from '../src/data/assets';
import { bodyPaintOptions, helmetPaintOptions } from '../src/data/customization';
import { dialogue } from '../src/data/dialogue';
import { elevenLabsSongAssets, elevenLabsVoiceAssets, matchVoiceAsset } from '../src/data/elevenlabs';
import { analyzeRaceAudio, RaceAudio } from '../src/game/audio';
import elevenLabsManifest from '../public/audio/elevenlabs/manifest.json';
import { analyzeCarContact, analyzeCpuRacecraft, createRace, type RacerState } from '../src/game/race';
import { createPositionCommentary, createSpotterCommentary, pickActiveRaceEvent } from '../src/game/raceCommentary';
import { createTrackMapLayout, summarizeRaceReadability } from '../src/game/raceReadability';
import { applyCampaignResults, createCampaignScores } from '../src/game/campaign';
import { createReplayEvents, createReplayRecorder, estimateReplayBytes, findReplayFrame } from '../src/game/replay';
import { createPodiumCeremony } from '../src/game/scene';
import { TrackPath } from '../src/game/trackPath';
import { animateDriverIdle, createFormulaCar, summarizeDriverRig } from '../src/game/models';
import { createFinaleCommentary, createRacePodiumCommentary } from '../src/game/podiumCommentary';
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
  it('keeps tutorial, pre-race, replay, podium, and finale dialogue as two-announcer exchanges', () => {
    for (const bank of [dialogue.tutorial, dialogue.prerace, dialogue.replay, dialogue.podium, dialogue.finale]) {
      expect(new Set(bank.map(([speaker]) => speaker))).toEqual(new Set(['Arthur Bell', 'Mags Whitlow']));
    }
  });

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
    expect(elevenLabsVoiceAssets).toHaveLength(5);
    expect(elevenLabsVoiceAssets.filter((asset) => asset.speaker === 'Radio').map((asset) => asset.id).sort()).toEqual([
      'radio-team-contact',
      'radio-team-damage',
      'radio-team-tires',
    ]);
    expect(
      matchVoiceAsset('Arthur Bell', 'Silverpine Switchback looks magnificent today: fast entries, dangerous exits, and very honest kerbs.')?.id,
    ).toBe('arthur-prerace');
    expect(matchVoiceAsset('Mags Whitlow', 'Five red lights, then it is noise, nerves, and no excuses.')?.id).toBe('mags-lights');
    expect(matchVoiceAsset('Radio', 'Damage is climbing. Stay off the outside kerbs and bring it home.')?.id).toBe('radio-team-damage');
    expect(matchVoiceAsset('Radio', 'Contact confirmed. Check the front wing and give them space.')?.id).toBe('radio-team-contact');
    expect(matchVoiceAsset('Radio', 'Tyres are fading. Brake earlier and keep the steering smooth.')?.id).toBe('radio-team-tires');
  });

  it('keeps the ElevenLabs manifest aligned with runtime assets and the dedicated radio voice ID', () => {
    expect(elevenLabsManifest.voiceLines.map((asset) => asset.id).sort()).toEqual(
      elevenLabsVoiceAssets.map((asset) => asset.id).sort(),
    );
    expect(elevenLabsManifest.songs.map((asset) => asset.id).sort()).toEqual(elevenLabsSongAssets.map((asset) => asset.id).sort());
    for (const manifestAsset of elevenLabsManifest.voiceLines) {
      const runtimeAsset = elevenLabsVoiceAssets.find((asset) => asset.id === manifestAsset.id);
      expect(runtimeAsset?.src).toBe(manifestAsset.file.replace(/^public/, ''));
      expect(matchVoiceAsset(manifestAsset.speaker, manifestAsset.text.replace('{track}', 'Silverpine Switchback'))?.id).toBe(manifestAsset.id);
    }
    for (const manifestAsset of elevenLabsManifest.songs) {
      const runtimeAsset = elevenLabsSongAssets.find((asset) => asset.id === manifestAsset.id);
      expect(runtimeAsset?.src).toBe(manifestAsset.file.replace(/^public/, ''));
    }
    expect(
      elevenLabsManifest.voiceLines
        .filter((asset) => asset.speaker === 'Radio')
        .map((asset) => asset.voiceEnv)
        .sort(),
    ).toEqual(['ELEVENLABS_RADIO_VOICE_ID', 'ELEVENLABS_RADIO_VOICE_ID', 'ELEVENLABS_RADIO_VOICE_ID']);
    expect(elevenLabsManifest.voiceLines.some((asset) => asset.speaker === 'Radio' && asset.voiceEnv !== 'ELEVENLABS_RADIO_VOICE_ID')).toBe(
      false,
    );
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

  it('keeps generated voice playback single-channel', async () => {
    const audio = new RaceAudio({ ...settings, mute: false });
    const firstVoice = {
      currentTime: 12,
      pause: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
    } as unknown as HTMLAudioElement;
    const secondVoice = {
      currentTime: 0,
      pause: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
    } as unknown as HTMLAudioElement;
    const internals = audio as unknown as {
      loadedVoices: Map<string, HTMLAudioElement>;
    };
    internals.loadedVoices.set('mags-lights', firstVoice);
    internals.loadedVoices.set('radio-team-damage', secondVoice);

    audio.speak('Mags Whitlow', 'Five red lights, then it is noise, nerves, and no excuses.');
    audio.speak('Radio', 'Damage is climbing. Stay off the outside kerbs and bring it home.');
    await Promise.resolve();
    await Promise.resolve();

    const metrics = audio.metrics();
    expect(firstVoice.pause).toHaveBeenCalledOnce();
    expect(firstVoice.currentTime).toBe(0);
    expect(secondVoice.play).toHaveBeenCalledOnce();
    expect(metrics.assets.generatedSpeechEvents).toBe(1);
    expect(metrics.assets.activeGeneratedVoice).toBe('radio-team-damage');
  });
});

describe('customization and asset pipeline data', () => {
  it('defines body and helmet paint options plus modular asset budgets', () => {
    expect(bodyPaintOptions.length).toBeGreaterThanOrEqual(5);
    expect(helmetPaintOptions.length).toBeGreaterThanOrEqual(5);
    expect(formulaAssetManifest.referenceImages.chassis).toContain('formula-chassis-reference.png');
    expect(formulaAssetManifest.plannedGlb.wheel).toContain('formula-wheel.glb');
    expect(formulaAssetManifest.budgets.refinedAssetMaxBytes).toBeLessThanOrEqual(6_000_000);
    expect(formulaAssetManifest.generatedTriangles.chassis).toBeLessThanOrEqual(formulaAssetManifest.budgets.chassisTriangles);
    expect(formulaAssetManifest.generatedTriangles.wheel).toBeLessThanOrEqual(formulaAssetManifest.budgets.wheelTriangles);
    expect(formulaAssetManifest.generatedTriangles.driver).toBeLessThanOrEqual(formulaAssetManifest.budgets.driverTriangles);
  });

  it('builds a customizable driver rig with separate helmet, visor, and celebration arms', () => {
    const car = createFormulaCar(0xe53935, 0xffd166);
    const summary = summarizeDriverRig(car);

    expect(summary.hasDriver).toBe(true);
    expect(summary.hasTorso).toBe(true);
    expect(summary.hasHelmet).toBe(true);
    expect(summary.hasVisor).toBe(true);
    expect(summary.armCount).toBe(2);

    const driver = car.getObjectByName('customizable-driver')!;
    const leftArm = driver.getObjectByName('celebration-arm-left')!;
    const idleArmRotation = leftArm.rotation.z;
    animateDriverIdle(car, 0.8, true, true);

    expect(driver.position.y).toBeGreaterThanOrEqual(driver.userData.baseY);
    expect(leftArm.rotation.z).not.toBe(idleArmRotation);
    expect(car.getObjectByName('customizable-helmet')).toBeTruthy();
  });

  it('caches wheel references for active-race animation without child scans', () => {
    const car = createFormulaCar(0xe53935, 0xffd166);
    expect(car.userData.wheels).toHaveLength(4);
    expect(car.userData.wheels.every((wheel: { name: string }) => wheel.name === 'separate-wheel')).toBe(true);
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

  it('does not award driven distance while the player is stopped', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 20 * 30; i += 1) {
      snapshot = race.update(1 / 30, { throttle: false, brake: true, steer: 0 });
    }
    expect(snapshot.player.speed).toBe(0);
    expect(snapshot.player.distance).toBe(0);
    expect(snapshot.player.lap).toBe(0);
    expect(snapshot.player.finished).toBe(false);
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
    const summary = summarizeRaceReadability(snapshot, tracks[0]);
    expect(summary.totalRacers).toBe(8);
    expect(summary.position).toBe(snapshot.position);
    expect(summary.nearestAhead?.meters ?? 0).toBeGreaterThanOrEqual(0);
    expect(summary.nearestBehind?.meters ?? 0).toBeGreaterThanOrEqual(0);
    expect([summary.nearestAhead?.shortName, summary.nearestBehind?.shortName].filter(Boolean).length).toBeGreaterThan(0);
    expect(summary.nearestAhead?.racerId).not.toBe('player');
    expect(summary.nearestBehind?.racerId).not.toBe('player');
    expect(summary.nextBrakeMeters).toBeGreaterThanOrEqual(0);
    expect(['clear', 'soon', 'now']).toContain(summary.brakeUrgency);
  });

  it('reports closing traffic, side-by-side rivals, and urgent braking guidance', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const snapshot = race.snapshot();
    snapshot.player.distance = 0.06;
    snapshot.player.progress = 0.06;
    snapshot.player.speed = 62;
    snapshot.player.lateral = 0.2;
    snapshot.racers[1].distance = 0.067;
    snapshot.racers[1].progress = 0.067;
    snapshot.racers[1].speed = 48;
    snapshot.racers[1].lateral = -1.2;
    snapshot.racers[2].distance = 0.058;
    snapshot.racers[2].progress = 0.058;
    snapshot.racers[2].speed = 68;
    snapshot.racers[2].lateral = 1.6;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };

    const summary = summarizeRaceReadability(crafted, tracks[0]);

    expect(summary.nearestAhead?.racerId).toBe('cpu-1');
    expect(summary.nearestAhead?.closing).toBe(true);
    expect(summary.nearestBehind?.racerId).toBe('cpu-2');
    expect(summary.nearestBehind?.closing).toBe(true);
    expect(summary.sideBySide?.racerId).toBe('cpu-2');
    expect(summary.sideBySide?.side).toBe('right');
    expect(summary.nextBrakeMeters).toBeLessThan(60);
    expect(summary.brakeUrgency).toBe('now');
  });

  it('creates stable dynamic commentary for position gains', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const snapshot = createRace('timeAttack', tracks[0], racers, settings).snapshot();
    snapshot.player.distance = 0.22;
    snapshot.racers[1].distance = 0.2;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };

    const event = createPositionCommentary(2, crafted, settings.playerName);

    expect(event?.kind).toBe('position-gained');
    expect(event?.lineId).toBe('mags.position-gained.clean-pass');
    expect(event?.priority).toBe(2);
    expect(event?.speaker).toBe('Mags Whitlow');
    expect(event?.focusRacerId).toBe('cpu-1');
  });

  it('prioritizes side-by-side spotter commentary over normal race calls', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const snapshot = race.snapshot();
    snapshot.player.distance = 0.2;
    snapshot.player.progress = 0.2;
    snapshot.player.speed = 55;
    snapshot.player.lateral = -0.2;
    snapshot.racers[1].distance = 0.204;
    snapshot.racers[1].progress = 0.204;
    snapshot.racers[1].speed = 58;
    snapshot.racers[1].lateral = 1.3;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };
    const summary = summarizeRaceReadability(crafted, tracks[0]);

    const event = createSpotterCommentary(summary);

    expect(event?.kind).toBe('spotter-side');
    expect(event?.lineId).toBe('radio.spotter-side.right');
    expect(event?.priority).toBe(3);
    expect(event?.speaker).toBe('Radio');
    expect(event?.focusRacerId).toBe('cpu-1');
  });

  it('arbitrates critical contact radio above spotter and position calls', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const snapshot = race.snapshot();
    snapshot.player.distance = 0.2;
    snapshot.player.progress = 0.2;
    snapshot.player.speed = 55;
    snapshot.player.lateral = -0.2;
    snapshot.player.contactEvents = 1;
    snapshot.player.lastContactSeverity = 0.6;
    snapshot.player.lastContactRacerId = 'cpu-1';
    snapshot.racers[1].distance = 0.204;
    snapshot.racers[1].progress = 0.204;
    snapshot.racers[1].speed = 58;
    snapshot.racers[1].lateral = 1.3;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };
    const summary = summarizeRaceReadability(crafted, tracks[0]);

    const event = pickActiveRaceEvent({
      previousPosition: 2,
      snapshot: crafted,
      summary,
      playerName: settings.playerName,
      lastRadio: '',
      lastContactRadioEvent: 0,
    });

    expect(event?.kind).toBe('radio-team-contact');
    expect(event?.lineId).toBe('radio.contact.damage-check');
    expect(event?.priority).toBe(4);
    expect(event?.speaker).toBe('Radio');
    expect(event?.focusRacerId).toBe('cpu-1');
  });

  it('creates stable spotter commentary for fast closing traffic', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const snapshot = race.snapshot();
    snapshot.player.distance = 0.2;
    snapshot.player.progress = 0.2;
    snapshot.player.speed = 45;
    snapshot.racers[1].distance = 0.194;
    snapshot.racers[1].progress = 0.194;
    snapshot.racers[1].speed = 58;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };
    const summary = summarizeRaceReadability(crafted, tracks[0]);

    const event = createSpotterCommentary(summary);

    expect(event?.kind).toBe('spotter-closing');
    expect(event?.lineId).toBe('radio.spotter-closing.behind');
    expect(event?.priority).toBe(3);
    expect(event?.focusRacerId).toBe('cpu-1');
  });

  it('creates stable dynamic commentary for position losses', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const snapshot = createRace('timeAttack', tracks[0], racers, settings).snapshot();
    snapshot.player.distance = 0.2;
    snapshot.racers[1].distance = 0.22;
    const standings = [...snapshot.racers].sort((a, b) => b.distance - a.distance);
    const crafted = { ...snapshot, standings, position: standings.findIndex((racer) => racer.definition.id === 'player') + 1 };

    const event = createPositionCommentary(1, crafted, settings.playerName);

    expect(event?.kind).toBe('position-lost');
    expect(event?.lineId).toBe('arthur.position-lost.reset');
    expect(event?.priority).toBe(2);
    expect(event?.speaker).toBe('Arthur Bell');
    expect(event?.focusRacerId).toBe('cpu-1');
  });

  it('does not create dynamic position commentary when the position is unchanged', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const snapshot = createRace('timeAttack', tracks[0], racers, settings).snapshot();

    expect(createPositionCommentary(snapshot.position, snapshot, settings.playerName)).toBeNull();
  });

  it('gives CPU racers corner braking and overtake intent', () => {
    const track = tracks[0];
    const base = createRace('timeAttack', track, [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers], settings).snapshot().racers;
    const chaser = { ...base[1], progress: track.kerbZones[0][0] + 0.01, distance: 0.2, speed: 70 };
    const traffic = { ...base[2], distance: chaser.distance + 0.01, speed: 42 };
    const clearAhead = { ...base[3], distance: chaser.distance + 0.2 };
    const intent = analyzeCpuRacecraft(chaser as RacerState, 1, [base[0], chaser, traffic, clearAhead] as RacerState[], track);
    expect(intent.cornerLoad).toBeGreaterThan(0.5);
    expect(intent.braking).toBe(true);
    expect(intent.overtakeLane).not.toBe(0);
    expect(intent.trafficGapMeters).toBeGreaterThan(0);
    expect(Math.abs(intent.targetLateral)).toBeGreaterThan(0.75);
    expect(intent.targetSpeed).toBeLessThan(70);
  });

  it('keeps live CPU racecraft active during a race stint', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 32 * 30; i += 1) {
      snapshot = race.update(1 / 30, { throttle: true, brake: false, steer: Math.sin(i / 20) * 0.2 });
    }
    const cpus = snapshot.racers.filter((racer) => racer.definition.id !== 'player');
    expect(cpus.some((racer) => racer.racecraft.cornerLoad > 0.4)).toBe(true);
    expect(cpus.some((racer) => racer.racecraft.targetSpeed < 55)).toBe(true);
    expect(cpus.some((racer) => Math.abs(racer.racecraft.targetLateral) > 1)).toBe(true);
    expect(cpus.some((racer) => racer.tires < 0.99)).toBe(true);
  });

  it('detects close car overlap as contact severity', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const snapshot = createRace('timeAttack', tracks[0], racers, settings).snapshot();
    const player = snapshot.player;
    const rival = snapshot.racers[1];
    player.distance = 0.25;
    player.progress = 0.25;
    player.lateral = 0;
    player.speed = 58;
    rival.distance = player.distance + 0.0012;
    rival.progress = player.progress + 0.0012;
    rival.lateral = 0.65;
    rival.speed = 44;
    const contact = analyzeCarContact(player, rival, tracks[0].lengthKm);
    expect(contact.overlap).toBe(true);
    expect(contact.longitudinalMeters).toBeLessThan(13);
    expect(contact.lateralMeters).toBeLessThan(2.35);
    expect(contact.severity).toBeGreaterThan(0.2);
  });

  it('does not count the staggered starting grid as contact', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    let snapshot = race.snapshot();
    for (let i = 0; i < 30; i += 1) {
      snapshot = race.update(1 / 30, { throttle: false, brake: true, steer: 0 });
    }
    expect(snapshot.racers.reduce((total, racer) => total + racer.contactEvents, 0)).toBe(0);
    expect(snapshot.player.damage).toBe(1);
  });

  it('applies contact damage, tire loss, separation, and event counters', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const initial = race.snapshot();
    initial.player.distance = 0.25;
    initial.player.progress = 0.25;
    initial.player.lateral = 0;
    initial.player.speed = 58;
    const rival = initial.racers[1];
    rival.distance = 0.257;
    rival.progress = 0.986;
    rival.lateral = 0.5;
    rival.speed = 44;

    const snapshot = race.update(1 / 60, { throttle: false, brake: false, steer: 0 });

    expect(snapshot.player.contactEvents).toBeGreaterThan(0);
    expect(rival.contactEvents).toBeGreaterThan(0);
    expect(snapshot.player.lastContactRacerId).toBe(rival.definition.id);
    expect(snapshot.player.maxContactSeverity).toBeGreaterThan(0);
    expect(snapshot.player.damage).toBeLessThan(1);
    expect(snapshot.player.tires).toBeLessThan(1);
    expect(snapshot.player.speed).toBeLessThan(58);
    expect(Math.abs(snapshot.player.lateral - rival.lateral)).toBeGreaterThan(0.7);
  });

  it('suppresses repeated contact while either car is cooling down', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const race = createRace('timeAttack', tracks[0], racers, settings);
    const initial = race.snapshot();
    initial.player.distance = 0.25;
    initial.player.progress = 0.25;
    initial.player.lateral = 0;
    initial.player.speed = 50;
    const rival = initial.racers[1];
    rival.distance = 0.257;
    rival.progress = 0.986;
    rival.lateral = 0.45;
    rival.speed = 42;

    const first = race.update(1 / 60, { throttle: false, brake: false, steer: 0 });
    const eventsAfterFirst = first.player.contactEvents;
    rival.distance = first.player.distance + 0.007;
    rival.progress = first.player.progress + 0.001;
    rival.lateral = first.player.lateral + 0.4;
    const second = race.update(1 / 60, { throttle: false, brake: false, steer: 0 });

    expect(eventsAfterFirst).toBeGreaterThan(0);
    expect(second.player.contactEvents).toBe(eventsAfterFirst);
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

  it('accumulates a four-race player championship', () => {
    const racers = [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
    const results = racers.map((racer, index) => ({
      racerId: racer.id,
      name: racer.name,
      totalTime: 80 + index,
      bestLap: 26,
      damage: 1,
      tires: 1,
    }));
    let scores = createCampaignScores(racers);
    for (let raceIndex = 0; raceIndex < tracks.length; raceIndex += 1) {
      scores = applyCampaignResults(scores, results);
    }

    expect(scores[0].racerId).toBe('player');
    expect(scores[0].points).toBe(100);
    expect(scores[0].wins).toBe(4);
    expect(scores[0].podiums).toBe(4);
  });
});

describe('podium commentary', () => {
  it('summarizes race winner, player result, and campaign standings', () => {
    const results = [
      { racerId: 'player', name: 'Test Driver', totalTime: 82, bestLap: 26, damage: 0.9, tires: 0.8 },
      { racerId: 'cpu-1', name: 'Luca Venn', totalTime: 84, bestLap: 27, damage: 0.9, tires: 0.8 },
      { racerId: 'cpu-2', name: 'Maya Cross', totalTime: 85, bestLap: 27.4, damage: 0.9, tires: 0.8 },
    ];
    const scores = [
      { racerId: 'player', name: 'Test Driver', points: 43, wins: 1, podiums: 2, lastFinish: 1 },
      { racerId: 'cpu-1', name: 'Luca Venn', points: 36, wins: 1, podiums: 2, lastFinish: 2 },
    ];

    const events = createRacePodiumCommentary(results, settings.playerName, scores);

    expect(events.map((event) => event.kind)).toEqual(['race-winner', 'player-result', 'campaign-standings']);
    expect(events[0].lineId).toBe('arthur.podium.winner');
    expect(events[0].text).toContain('Test Driver wins');
    expect(events[1].lineId).toBe('mags.podium.player-win');
    expect(events[1].focusRacerId).toBe('player');
    expect(events[2].text).toContain('leads Luca Venn by 7 points');
  });

  it('summarizes campaign finale champion and top three', () => {
    const scores = [
      { racerId: 'player', name: 'Test Driver', points: 96, wins: 3, podiums: 4, lastFinish: 1 },
      { racerId: 'cpu-1', name: 'Luca Venn', points: 88, wins: 1, podiums: 3, lastFinish: 2 },
      { racerId: 'cpu-2', name: 'Maya Cross', points: 80, wins: 0, podiums: 2, lastFinish: 3 },
    ];

    const events = createFinaleCommentary(scores, settings.playerName, 4);

    expect(events.map((event) => event.kind)).toEqual(['finale-champion', 'finale-top-three']);
    expect(events[0].lineId).toBe('arthur.finale.champion');
    expect(events[0].text).toContain('Test Driver is champion after 4 races');
    expect(events[1].text).toContain('Test Driver, Luca Venn, then Maya Cross');
  });
});
