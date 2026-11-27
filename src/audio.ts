import { publicUrl } from "./public-url";

type Group = "steps" | "glass" | "metal" | "stone" | "wood" | "bell" | "tick";

const FILES: Record<Group, string[]> = {
  steps: ["footstep_concrete_000", "footstep_concrete_001", "footstep_concrete_002"],
  glass: [
    "impact_glass_heavy_000",
    "impact_glass_heavy_001",
    "impact_glass_heavy_002",
    "impact_glass_light_000",
    "impact_glass_light_001",
  ],
  metal: [
    "impact_metal_heavy_000",
    "impact_metal_heavy_001",
    "impact_metal_medium_000",
    "impact_metal_medium_001",
  ],
  stone: ["impact_mining_000", "impact_mining_001"],
  wood: ["impact_plank_medium_000", "footstep_wood_000"],
  bell: ["impact_bell_heavy_000", "impact_bell_heavy_001"],
  tick: ["impact_generic_light_000"],
};

export class AudioBus {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private beamGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private raw = new Map<string, ArrayBuffer>();
  muted = false;
  volume = 0.8;
  private started = false;
  private bedsReady = false;
  private arming: Promise<void> | null = null;
  private chimeIn = 8;

  async load(): Promise<void> {
    const names = Object.values(FILES).flat();
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(publicUrl(`assets/audio/${name}.ogg`));
          if (!res.ok) return;
          this.raw.set(name, await res.arrayBuffer());
        } catch {
          /* synthesis covers the gap */
        }
      }),
    );
  }

  private async arm(): Promise<void> {
    if (this.bedsReady) return;
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume();
    for (const [name, data] of this.raw) {
      try {
        this.buffers.set(name, await ctx.decodeAudioData(data.slice(0)));
      } catch {
        /* keep going */
      }
    }
    if (this.master) this.buildBeds(ctx, this.master);
    this.bedsReady = true;
    this.started = true;
  }

  ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    this.arming ??= this.arm();
    await this.arming;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (!this.muted && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  update(dt: number): void {
    if (!this.started || this.muted) return;
    this.chimeIn -= dt;
    if (this.chimeIn <= 0) {
      this.chimeIn = 14 + Math.random() * 10;
      this.play("bell", 0.18, 0.85 + Math.random() * 0.2);
      this.tone(740, 0.9, 0.04, "sine");
    }
  }

  footstep(sprint: boolean): void {
    this.play("steps", sprint ? 0.45 : 0.32, sprint ? 1.12 : 0.96);
    this.noiseBurst(0.05, 180, 900, 0.04);
  }

  shatter(kind: "glass" | "metal" | "stone" | "wood", intensity = 1): void {
    const group: Group = kind;
    this.play(group, Math.min(0.85, 0.35 + intensity * 0.4), 0.85 + Math.random() * 0.3);
    this.noiseBurst(0.12 + intensity * 0.08, kind === "glass" ? 1200 : 200, 5000, 0.08 * intensity);
    if (intensity > 0.6) this.tone(90, 0.18, 0.12 * intensity, "sine");
  }

  boom(): void {
    this.tone(70, 32, 0.55, "sine", 0.45);
    this.noiseBurst(0.4, 40, 400, 0.2);
    this.play("stone", 0.7, 0.7);
  }

  switchPower(): void {
    this.tone(520, 880, 0.07, "sine", 0.08);
    this.play("tick", 0.25, 1.2);
  }

  restore(): void {
    this.play("bell", 0.4, 1.15);
    this.tone(440, 660, 0.22, "triangle", 0.08);
  }

  whoosh(): void {
    this.noiseBurst(0.35, 300, 1800, 0.06);
  }

  toneLift(): void {
    this.switchPower();
    this.shatter("glass", 0.35);
    this.tone(420, 160, 0.45, "sine", 0.1);
  }

  setHum(amount: number): void {
    if (!this.humGain || !this.ctx) return;
    const target = this.muted ? 0 : amount * 0.16 * this.volume;
    this.humGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  setBeam(on: boolean): void {
    if (!this.beamGain || !this.ctx) return;
    const target = on && !this.muted ? 0.05 * this.volume : 0;
    this.beamGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private play(group: Group, volume: number, rate: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const names = FILES[group];
    const name = names[Math.floor(Math.random() * names.length)];
    const buf = this.buffers.get(name);
    if (!buf) {
      this.noiseBurst(0.08, 400, 2000, volume * 0.2);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  private tone(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    peak = 0.12,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, low: number, high: number, peak: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  private buildBeds(ctx: AudioContext, master: GainNode): void {
    const seconds = 2;
    const noise = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.045;
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(master);
    wind.start();

    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    for (const freq of [46, 70, 92]) {
      const osc = ctx.createOscillator();
      osc.type = freq === 46 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = freq === 46 ? 0.7 : 0.22;
      osc.connect(g);
      g.connect(this.humGain);
      osc.start();
    }
    this.humGain.connect(master);

    const beam = ctx.createBufferSource();
    beam.buffer = noise;
    beam.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 640;
    bp.Q.value = 4;
    this.beamGain = ctx.createGain();
    this.beamGain.gain.value = 0;
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = 148;
    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.2;
    beam.connect(bp);
    bp.connect(this.beamGain);
    saw.connect(sawGain);
    sawGain.connect(this.beamGain);
    this.beamGain.connect(master);
    beam.start();
    saw.start();
  }
}
