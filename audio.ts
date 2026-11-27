export class RallyAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
  private muted = false;
  private paused = false;
  private lastGear = 1;

  public unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.28;
    master.connect(ctx.destination);

    // Boxer rally engine twin oscillators -> lowpass -> gain
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 2.2;

    const eGain = ctx.createGain();
    eGain.gain.value = 0.0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 110;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(eGain);
    eGain.connect(master);

    osc1.start();
    osc2.start();

    // Tire / gravel skid noise buffer
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const sFilter = ctx.createBiquadFilter();
    sFilter.type = 'bandpass';
    sFilter.frequency.value = 1100;
    sFilter.Q.value = 1.6;

    const sGain = ctx.createGain();
    sGain.gain.value = 0;

    noiseSrc.connect(sFilter);
    sFilter.connect(sGain);
    sGain.connect(master);
    noiseSrc.start();

    this.ctx = ctx;
    this.masterGain = master;
    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = eGain;
    this.skidFilter = sFilter;
    this.skidGain = sGain;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute || this.paused ? 0 : 0.28, this.ctx.currentTime, 0.04);
    }
  }

  public setPaused(pause: boolean): void {
    this.paused = pause;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted || pause ? 0 : 0.28, this.ctx.currentTime, 0.04);
    }
  }

  public updateTelemetry(rpm: number, throttle: number, slipAngle: number, isGravel: boolean, gear: number): void {
    if (!this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.skidGain || !this.skidFilter) {
      return;
    }
    if (this.muted || this.paused) return;

    const now = this.ctx.currentTime;
    const baseFreq = 38 + (rpm / 8200) * 145;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.03);
    this.engineFilter.frequency.setTargetAtTime(240 + throttle * 620 + (rpm / 8200) * 420, now, 0.04);
    this.engineGain.gain.setTargetAtTime(0.18 + throttle * 0.22, now, 0.05);

    // Gear shift turbo blow-off chirp
    if (gear > this.lastGear) {
      this.playTone(960, 480, 0.08, 0.08, 'sine');
    }
    this.lastGear = gear;

    // Skid / gravel spray volume
    const skidLevel = slipAngle > 0.14 ? Math.min(0.24, (slipAngle - 0.14) * 0.45) : 0;
    this.skidFilter.frequency.setTargetAtTime(isGravel ? 620 : 1450, now, 0.05);
    this.skidGain.gain.setTargetAtTime(skidLevel, now, 0.04);
  }

  public playImpact(strength: number): void {
    if (!this.ctx || this.muted || this.paused) return;
    this.playTone(130, 42, 0.16, Math.min(0.35, 0.12 + strength * 0.25), 'triangle');
  }

  public playCountdownBeep(finalGo: boolean): void {
    if (!this.ctx || this.muted) return;
    this.playTone(finalGo ? 880 : 440, finalGo ? 880 : 440, finalGo ? 0.22 : 0.12, 0.18, 'sine');
  }

  public playLapChime(isFinish: boolean): void {
    if (!this.ctx || this.muted) return;
    this.playTone(587.33, 587.33, 0.12, 0.18, 'triangle');
    setTimeout(() => this.playTone(isFinish ? 1174.66 : 880, isFinish ? 1174.66 : 880, 0.25, 0.2, 'triangle'), 110);
  }

  private playTone(fStart: number, fEnd: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, now);
    if (fStart !== fEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
