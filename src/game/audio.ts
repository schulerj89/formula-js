import type { GameSettings } from '../types';

export class RaceAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicTimer = 0;

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

  menuMusic(dt: number): void {
    if (this.settings.mute || !this.context) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const notes = [196, 247, 294, 330, 392, 330, 294, 247];
    const note = notes[Math.floor(performance.now() / 420) % notes.length];
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0.045, this.context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }
}
