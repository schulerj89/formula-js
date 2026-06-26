import type { GameSettings } from '../types';
import { announcerVoiceProfiles, type MusicCueId, type MusicTheme } from '../data/audio';

export class RaceAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private currentMusic: MusicCueId | null = null;
  private activeMusicTitle = 'Silent';
  private lastSpeaker = '';
  private speechEnabled = typeof window !== 'undefined' && 'speechSynthesis' in window;
  private musicEvents = 0;
  private speechEvents = 0;

  constructor(private readonly settings: GameSettings) {}

  resume(): void {
    if (this.settings.mute) return;
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  setEngine(speed: number): void {
    if (this.settings.mute || !this.context) return;
    if (!this.engine) {
      this.engine = this.context.createOscillator();
      this.engine.type = 'sawtooth';
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain);
      this.engineGain.connect(this.context.destination);
      this.engine.start();
    }
    this.engine.frequency.setTargetAtTime(70 + speed * 6, this.context.currentTime, 0.04);
    this.engineGain?.gain.setTargetAtTime(Math.min(0.08, 0.015 + speed / 1200), this.context.currentTime, 0.05);
  }

  stopEngine(): void {
    this.engineGain?.gain.setTargetAtTime(0, this.context?.currentTime ?? 0, 0.08);
  }

  stopMusic(): void {
    this.currentMusic = null;
    this.activeMusicTitle = 'Silent';
    this.musicTimer = 0;
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
    }
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
    if (!this.speechEnabled || !('SpeechSynthesisUtterance' in window)) return;
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

  metrics(): { musicCue: string; musicEvents: number; speechEnabled: boolean; speechEvents: number; lastSpeaker: string } {
    return {
      musicCue: this.activeMusicTitle,
      musicEvents: this.musicEvents,
      speechEnabled: this.speechEnabled,
      speechEvents: this.speechEvents,
      lastSpeaker: this.lastSpeaker,
    };
  }

  private radioClick(isRadio: boolean): void {
    if (!this.context || this.settings.mute) return;
    this.playTone(isRadio ? 920 : 620, 0.035, 'square', isRadio ? 0.055 : 0.028);
    setTimeout(() => this.playTone(isRadio ? 660 : 520, 0.035, 'square', isRadio ? 0.04 : 0.02), 42);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context) return;
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
}

const ratio = (semitones: number): number => 2 ** (semitones / 12);
