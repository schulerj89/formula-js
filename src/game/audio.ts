import type { GameSettings } from '../types';
import { announcerVoiceProfiles, type MusicCueId, type MusicTheme } from '../data/audio';
import { elevenLabsSongAssets, elevenLabsVoiceAssets, matchVoiceAsset } from '../data/elevenlabs';
import type { RaceControl, RaceSnapshot } from './race';

export interface RaceAudioFeedback {
  gear: number;
  revs: number;
  engineFrequency: number;
  engineGain: number;
  tireLoad: number;
  kerbLoad: number;
  offTrackLoad: number;
}

export class RaceAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineHarmonic: OscillatorNode | null = null;
  private engineHarmonicGain: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private currentMusic: MusicCueId | null = null;
  private activeMusicTitle = 'Silent';
  private lastSpeaker = '';
  private speechEnabled = typeof window !== 'undefined' && 'speechSynthesis' in window;
  private musicEvents = 0;
  private speechEvents = 0;
  private tireScrubEvents = 0;
  private impactEvents = 0;
  private kerbEvents = 0;
  private gearShiftEvents = 0;
  private radioDucks = 0;
  private tireCooldown = 0;
  private impactCooldown = 0;
  private lastGear = 1;
  private lastDamage = 1;
  private raceFeedback: RaceAudioFeedback = defaultFeedback();
  private assetWarmupStarted = false;
  private loadedSongs = new Map<MusicCueId, HTMLAudioElement>();
  private loadedVoices = new Map<string, HTMLAudioElement>();
  private missingAssets = new Set<string>();
  private disabledAssets = new Set<string>();
  private currentSongElement: HTMLAudioElement | null = null;
  private currentVoiceElement: HTMLAudioElement | null = null;
  private activeGeneratedMusicId: string | null = null;
  private activeGeneratedVoiceId: string | null = null;
  private generatedMusicEvents = 0;
  private generatedSpeechEvents = 0;
  private radioVoiceFilterChains = new WeakSet<HTMLAudioElement>();
  private radioVoiceFilterChainCount = 0;
  private assetErrors = 0;

  constructor(private readonly settings: GameSettings) {}

  resume(): void {
    if (this.settings.mute) return;
    this.context ??= new AudioContext();
    void this.context.resume();
    this.warmupAssets();
  }

  setEngine(speed: number): void {
    this.setEngineTone(analyzeRaceAudio({ speed, lateral: 0, damage: this.lastDamage } as RaceSnapshot['player'], { throttle: true, brake: false, steer: 0 }));
  }

  updateRaceFeedback(snapshot: RaceSnapshot, control: RaceControl, dt: number): void {
    this.tireCooldown = Math.max(0, this.tireCooldown - dt);
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);
    const feedback = analyzeRaceAudio(snapshot.player, control);
    this.raceFeedback = feedback;

    if (feedback.gear !== this.lastGear && snapshot.player.speed > 10) {
      this.gearShiftEvents += 1;
      this.playTone(180 + feedback.gear * 36, 0.035, 'square', 0.018);
    }
    this.lastGear = feedback.gear;

    if (feedback.tireLoad > 0.58 && this.tireCooldown <= 0) {
      this.tireScrubEvents += 1;
      this.tireCooldown = 0.26;
      this.playNoise(0.07, Math.min(0.05, feedback.tireLoad * 0.04), 1100);
    }

    if (feedback.kerbLoad > 0.28 && this.impactCooldown <= 0) {
      this.kerbEvents += 1;
      this.impactCooldown = 0.34;
      this.playTone(92, 0.07, 'triangle', 0.055);
    }

    const damageDrop = Math.max(0, this.lastDamage - snapshot.player.damage);
    if (damageDrop > 0.003 && this.impactCooldown <= 0) {
      this.impactEvents += 1;
      this.impactCooldown = 0.42;
      this.playTone(58, 0.11, 'sawtooth', 0.06);
    }
    this.lastDamage = snapshot.player.damage;
    this.setEngineTone(feedback);
  }

  private setEngineTone(feedback: RaceAudioFeedback): void {
    if (this.settings.mute || !this.context) return;
    if (!this.engine) {
      this.engine = this.context.createOscillator();
      this.engine.type = 'sawtooth';
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain);
      this.engineGain.connect(this.context.destination);
      this.engine.start();
      this.engineHarmonic = this.context.createOscillator();
      this.engineHarmonic.type = 'square';
      this.engineHarmonicGain = this.context.createGain();
      this.engineHarmonicGain.gain.value = 0;
      this.engineHarmonic.connect(this.engineHarmonicGain);
      this.engineHarmonicGain.connect(this.context.destination);
      this.engineHarmonic.start();
    }
    this.engine.frequency.setTargetAtTime(feedback.engineFrequency, this.context.currentTime, 0.035);
    this.engineGain?.gain.setTargetAtTime(feedback.engineGain, this.context.currentTime, 0.05);
    this.engineHarmonic?.frequency.setTargetAtTime(feedback.engineFrequency * 1.72, this.context.currentTime, 0.04);
    this.engineHarmonicGain?.gain.setTargetAtTime(feedback.engineGain * 0.28 * feedback.revs, this.context.currentTime, 0.045);
  }

  stopEngine(): void {
    this.engineGain?.gain.setTargetAtTime(0, this.context?.currentTime ?? 0, 0.08);
    this.engineHarmonicGain?.gain.setTargetAtTime(0, this.context?.currentTime ?? 0, 0.08);
  }

  stopMusic(): void {
    this.currentMusic = null;
    this.activeMusicTitle = 'Silent';
    this.musicTimer = 0;
    if (this.currentSongElement) {
      this.currentSongElement.pause();
      this.currentSongElement.currentTime = 0;
      this.currentSongElement = null;
      this.activeGeneratedMusicId = null;
    }
  }

  beep(count: number): void {
    if (this.settings.mute || !this.context) return;
    const now = this.context.currentTime;
    for (let i = 0; i < count; i += 1) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.frequency.value = count >= 5 && i === count - 1 ? 660 : 440;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.18 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.13);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.14);
    }
  }

  playMusic(theme: MusicTheme, dt: number): void {
    if (this.settings.mute || !this.context) return;
    if (this.currentMusic !== theme.id) {
      this.currentMusic = theme.id;
      this.activeMusicTitle = theme.title;
      this.musicTimer = 0;
      this.musicStep = 0;
      if (this.playGeneratedSong(theme)) return;
    }
    if (!this.currentSongElement && this.loadedSongs.has(theme.id) && this.playGeneratedSong(theme)) return;
    if (this.currentSongElement) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const stepSeconds = 60 / theme.bpm / 2;
    this.musicTimer = stepSeconds;
    const chord = theme.chordOffsets[Math.floor(this.musicStep / 4) % theme.chordOffsets.length];
    const lead = theme.leadOffsets[this.musicStep % theme.leadOffsets.length];
    const bass = theme.bassPattern[this.musicStep % theme.bassPattern.length];
    this.playTone(theme.rootHz * ratio(bass - 12), stepSeconds * 0.9, 'sawtooth', theme.gain * 0.72);
    this.playTone(theme.rootHz * ratio(chord), stepSeconds * 1.7, 'triangle', theme.gain * 0.6);
    this.playTone(theme.rootHz * ratio(lead), stepSeconds * 0.65, 'square', theme.gain * 0.34);
    this.playDrum(this.musicStep % 4 === 0 ? 'kick' : this.musicStep % 4 === 2 ? 'snare' : 'hat');
    this.musicStep += 1;
    this.musicEvents += 1;
  }

  speak(speaker: string, text: string): void {
    this.lastSpeaker = speaker;
    if (this.settings.mute) return;
    this.radioClick(speaker === 'Radio');
    if (speaker === 'Radio') {
      this.radioDucks += 1;
      this.engineGain?.gain.setTargetAtTime(Math.max(0.012, this.raceFeedback.engineGain * 0.45), this.context?.currentTime ?? 0, 0.025);
      this.engineHarmonicGain?.gain.setTargetAtTime(0.004, this.context?.currentTime ?? 0, 0.025);
    }
    if (this.playGeneratedVoice(speaker, text)) return;
    this.speakWithBrowser(speaker, text);
  }

  private speakWithBrowser(speaker: string, text: string): void {
    if (!this.speechEnabled || typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    const profile = announcerVoiceProfiles[speaker as keyof typeof announcerVoiceProfiles] ?? announcerVoiceProfiles['Arthur Bell'];
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = speaker === 'Radio' ? 0.78 : 0.62;
    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find((voice) => /en-GB|British|UK|Daniel|Oliver|Arthur|Martha|Serena/i.test(`${voice.lang} ${voice.name}`));
    if (britishVoice) utterance.voice = britishVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    this.speechEvents += 1;
  }

  metrics(): {
    musicCue: string;
    musicEvents: number;
    speechEnabled: boolean;
    speechEvents: number;
    lastSpeaker: string;
    assets: {
      generatedMusicReady: number;
      generatedVoiceReady: number;
      missingAssets: number;
      generatedMusicEvents: number;
      generatedSpeechEvents: number;
      fallbackMusicEvents: number;
      fallbackSpeechEvents: number;
      radioVoiceFilterChains: number;
      assetErrors: number;
      activeGeneratedMusic: string | null;
      activeGeneratedVoice: string | null;
    };
    race: RaceAudioFeedback & {
      tireScrubEvents: number;
      impactEvents: number;
      kerbEvents: number;
      gearShiftEvents: number;
      radioDucks: number;
    };
  } {
    return {
      musicCue: this.activeMusicTitle,
      musicEvents: this.musicEvents,
      speechEnabled: this.speechEnabled,
      speechEvents: this.speechEvents,
      lastSpeaker: this.lastSpeaker,
      assets: {
        generatedMusicReady: this.loadedSongs.size,
        generatedVoiceReady: this.loadedVoices.size,
        missingAssets: this.missingAssets.size,
        generatedMusicEvents: this.generatedMusicEvents,
        generatedSpeechEvents: this.generatedSpeechEvents,
        fallbackMusicEvents: this.musicEvents,
        fallbackSpeechEvents: this.speechEvents,
        radioVoiceFilterChains: this.radioVoiceFilterChainCount,
        assetErrors: this.assetErrors,
        activeGeneratedMusic: this.activeGeneratedMusicId,
        activeGeneratedVoice: this.activeGeneratedVoiceId,
      },
      race: {
        ...this.raceFeedback,
        tireScrubEvents: this.tireScrubEvents,
        impactEvents: this.impactEvents,
        kerbEvents: this.kerbEvents,
        gearShiftEvents: this.gearShiftEvents,
        radioDucks: this.radioDucks,
      },
    };
  }

  private radioClick(isRadio: boolean): void {
    if (!this.context || this.settings.mute) return;
    this.playTone(isRadio ? 920 : 620, 0.035, 'square', isRadio ? 0.055 : 0.028);
    setTimeout(() => this.playTone(isRadio ? 660 : 520, 0.035, 'square', isRadio ? 0.04 : 0.02), 42);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || this.settings.mute) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + Math.max(0.03, duration));
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start();
    osc.stop(this.context.currentTime + Math.max(0.04, duration + 0.02));
  }

  private playDrum(kind: 'kick' | 'snare' | 'hat'): void {
    if (!this.context) return;
    const frequency = kind === 'kick' ? 72 : kind === 'snare' ? 180 : 440;
    const duration = kind === 'hat' ? 0.035 : 0.08;
    const volume = kind === 'kick' ? 0.05 : kind === 'snare' ? 0.035 : 0.018;
    this.playTone(frequency, duration, kind === 'hat' ? 'square' : 'triangle', volume);
  }

  private warmupAssets(): void {
    if (this.assetWarmupStarted || typeof Audio === 'undefined') return;
    this.assetWarmupStarted = true;
    elevenLabsSongAssets.forEach((asset) => {
      void this.prepareAudioElement(asset.src, asset.id, true).then((element) => {
        if (element) this.loadedSongs.set(asset.cue, element);
      });
    });
    elevenLabsVoiceAssets.forEach((asset) => {
      void this.prepareAudioElement(asset.src, asset.id, false).then((element) => {
        if (element) this.loadedVoices.set(asset.id, element);
      });
    });
  }

  private async prepareAudioElement(src: string, assetId: string, loop: boolean): Promise<HTMLAudioElement | null> {
    try {
      const response = await fetch(resolvePublicAssetUrl(src), { method: 'HEAD' });
      if (!response.ok) {
        this.missingAssets.add(assetId);
        return null;
      }
      const audio = new Audio(resolvePublicAssetUrl(src));
      audio.dataset.assetId = assetId;
      audio.preload = 'auto';
      audio.loop = loop;
      audio.volume = loop ? 0.32 : 0.86;
      const ready = await waitForAudioReady(audio);
      if (!ready) {
        this.assetErrors += 1;
        this.disabledAssets.add(assetId);
        return null;
      }
      if (!loop && assetId.startsWith('radio-team-')) this.configureRadioVoiceElement(audio);
      return audio;
    } catch {
      this.assetErrors += 1;
      this.missingAssets.add(assetId);
      return null;
    }
  }

  private playGeneratedSong(theme: MusicTheme): boolean {
    const song = this.loadedSongs.get(theme.id);
    if (!song || this.disabledAssets.has(song.dataset.assetId ?? theme.id)) {
      if (this.currentSongElement) {
        this.currentSongElement.pause();
        this.currentSongElement = null;
        this.activeGeneratedMusicId = null;
      }
      return false;
    }
    if (this.currentSongElement === song) {
      return true;
    }
    if (this.currentSongElement && this.currentSongElement !== song) {
      this.currentSongElement.pause();
      this.currentSongElement.currentTime = 0;
    }
    this.currentSongElement = song;
    this.activeGeneratedMusicId = null;
    song.currentTime = 0;
    void song
      .play()
      .then(() => {
        if (this.currentSongElement === song) this.activeGeneratedMusicId = song.dataset.assetId ?? theme.id;
        this.generatedMusicEvents += 1;
      })
      .catch(() => {
        this.disabledAssets.add(song.dataset.assetId ?? theme.id);
        this.assetErrors += 1;
        if (this.currentSongElement === song) {
          this.currentSongElement = null;
          this.activeGeneratedMusicId = null;
        }
      });
    return true;
  }

  private playGeneratedVoice(speaker: string, text: string): boolean {
    const asset = matchVoiceAsset(speaker, text);
    if (!asset || this.disabledAssets.has(asset.id)) return false;
    const voice = this.loadedVoices.get(asset.id);
    if (!voice) return false;
    if (asset.speaker === 'Radio') this.configureRadioVoiceElement(voice);
    if (this.currentVoiceElement && this.currentVoiceElement !== voice) {
      this.currentVoiceElement.pause();
      this.currentVoiceElement.currentTime = 0;
    }
    this.currentVoiceElement = voice;
    this.activeGeneratedVoiceId = null;
    voice.currentTime = 0;
    void voice.play().then(() => {
      if (this.currentVoiceElement === voice) {
        this.activeGeneratedVoiceId = asset.id;
        this.generatedSpeechEvents += 1;
      }
    }).catch(() => {
      this.disabledAssets.add(asset.id);
      this.assetErrors += 1;
      if (this.currentVoiceElement === voice) {
        this.currentVoiceElement = null;
        this.activeGeneratedVoiceId = null;
      }
      this.speakWithBrowser(speaker, text);
    });
    return true;
  }

  private configureRadioVoiceElement(voice: HTMLAudioElement): void {
    if (!this.context || this.radioVoiceFilterChains.has(voice)) return;
    try {
      const source = this.context.createMediaElementSource(voice);
      const highpass = this.context.createBiquadFilter();
      const lowpass = this.context.createBiquadFilter();
      const drive = this.context.createWaveShaper();
      const gain = this.context.createGain();
      highpass.type = 'highpass';
      highpass.frequency.value = 420;
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2600;
      drive.curve = createRadioCompressionCurve();
      drive.oversample = '2x';
      gain.gain.value = 0.95;
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(drive);
      drive.connect(gain);
      gain.connect(this.context.destination);
      this.radioVoiceFilterChains.add(voice);
      this.radioVoiceFilterChainCount += 1;
    } catch {
      this.assetErrors += 1;
    }
  }

  private playNoise(duration: number, volume: number, filterFrequency: number): void {
    if (!this.context || this.settings.mute) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'highpass';
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);
    source.start();
    source.stop(this.context.currentTime + duration);
  }
}

const ratio = (semitones: number): number => 2 ** (semitones / 12);

function createRadioCompressionCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(256 * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2.4) * 0.82;
  }
  return curve;
}

function resolvePublicAssetUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  return new URL(url.slice(1), document.baseURI).toString();
}

function waitForAudioReady(audio: HTMLAudioElement): Promise<boolean> {
  if (audio.readyState >= 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ready: boolean): void => {
      if (settled) return;
      settled = true;
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('loadeddata', onReady);
      audio.removeEventListener('error', onError);
      window.clearTimeout(timeout);
      resolve(ready);
    };
    const onReady = (): void => done(true);
    const onError = (): void => done(false);
    const timeout = window.setTimeout(() => done(false), 2500);
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('loadeddata', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.load();
  });
}

export function analyzeRaceAudio(
  player: Pick<RaceSnapshot['player'], 'speed' | 'lateral' | 'damage'>,
  control: RaceControl,
): RaceAudioFeedback {
  const speed = Math.max(0, player.speed);
  const gear = Math.min(7, Math.max(1, Math.floor(speed / 12) + 1));
  const gearSpan = 12;
  const gearProgress = (speed % gearSpan) / gearSpan;
  const revs = clamp(0.28 + gearProgress * 0.62 + (control.throttle ? 0.12 : 0) - (control.brake ? 0.08 : 0), 0.22, 1);
  const offTrackLoad = clamp((Math.abs(player.lateral) - 4.8) / 2.4, 0, 1);
  const kerbLoad = clamp((Math.abs(player.lateral) - 3.55) / 1.4, 0, 1) * clamp(speed / 42, 0, 1);
  const tireLoad = clamp(Math.abs(control.steer) * 0.76 + (control.brake ? 0.28 : 0) + offTrackLoad * 0.45 + speed / 260, 0, 1);
  return {
    gear,
    revs,
    engineFrequency: 92 + gear * 74 + revs * 420 + speed * 1.4,
    engineGain: clamp(0.018 + speed / 1050 + (control.throttle ? 0.012 : 0), 0.012, 0.095),
    tireLoad,
    kerbLoad,
    offTrackLoad,
  };
}

function defaultFeedback(): RaceAudioFeedback {
  return {
    gear: 1,
    revs: 0,
    engineFrequency: 0,
    engineGain: 0,
    tireLoad: 0,
    kerbLoad: 0,
    offTrackLoad: 0,
  };
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
