/**
 * Shape-Shift Racer Procedural Audio Synthesizer.
 * Generates all SFX and the 120 BPM Am-F-C-G Synthwave soundtrack loop procedurally in memory
 * as Float32Array PCM at 44.1 kHz (or native AudioContext sample rate) with zero external audio assets.
 */

export const DEFAULT_SAMPLE_RATE = 44100;

/**
 * 1. Morph Sound (Sci-Fi Linear Frequency Sweep)
 * Duration: 0.16s
 * Pitch: Linear sweep 260 Hz -> 840 Hz
 * Envelope: Linear amplitude decay 0.35 -> 0.0
 * Formula: wave(t) = sin(2 * pi * f(t) * t) * (0.35 * (1 - t / 0.16))
 */
export function synthesizeMorph(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.16;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = 260.0 + (840.0 - 260.0) * (t / dur);
    const env = 0.35 * (1.0 - t / dur);
    out[i] = Math.max(-1.0, Math.min(1.0, Math.sin(2.0 * Math.PI * freq * t) * env));
  }
  return out;
}

/**
 * 2. Obstacle Clear Chime (Dual Sine Chord)
 * Duration: 0.20s
 * Waveform: Equal dual sine chord at D5 (587.33 Hz) and A5 (880.00 Hz)
 * Envelope: Exponential decay exp(-12t) * 0.40
 * Formula: (0.5 * sin(2*pi*587.33*t) + 0.5 * sin(2*pi*880.0*t)) * exp(-12t) * 0.40
 */
export function synthesizeClear(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.20;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const wave =
      0.5 * Math.sin(2.0 * Math.PI * 587.33 * t) +
      0.5 * Math.sin(2.0 * Math.PI * 880.00 * t);
    const env = Math.exp(-12.0 * t) * 0.40;
    out[i] = Math.max(-1.0, Math.min(1.0, wave * env));
  }
  return out;
}

/**
 * 3. Coin Pickup (Classic Two-Stage Bright Ping)
 * Duration: 0.18s
 * Pitch Jump: f = 987.77 Hz (B5) for t < 0.06s; f = 1318.51 Hz (E6) for t >= 0.06s
 * Waveform: Fundamental + 0.30 2nd harmonic: sin(2*pi*f*t) + 0.3 * sin(4*pi*f*t)
 * Envelope: Exponential decay exp(-11t) * 0.35
 */
export function synthesizeCoin(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.18;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = t < 0.06 ? 987.77 : 1318.51;
    const wave =
      Math.sin(2.0 * Math.PI * freq * t) +
      0.3 * Math.sin(4.0 * Math.PI * freq * t);
    const env = Math.exp(-11.0 * t) * 0.35;
    out[i] = Math.max(-1.0, Math.min(1.0, wave * env));
  }
  return out;
}

/**
 * 4. Streak Multiplier Up (Ascending 4-Note Synth Arpeggio)
 * Duration: 0.34s
 * Notes: Ascending 4 notes [523.25 (C5), 659.25 (E5), 783.99 (G5), 1046.50 (C6) Hz]
 * Sub-note duration: 0.34 / 4 = 0.085s per note
 * Sub-note envelope: Exponential decay exp(-16 * (t % 0.085)) * 0.42
 */
export function synthesizeStreak(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.34;
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const stepDur = dur / notes.length; // 0.085s
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(Math.floor(t / stepDur), notes.length - 1);
    const freq = notes[noteIdx];
    const localT = t % stepDur;
    const env = Math.exp(-16.0 * localT) * 0.42;
    out[i] = Math.max(-1.0, Math.min(1.0, Math.sin(2.0 * Math.PI * freq * t) * env));
  }
  return out;
}

/**
 * 5. Near-Miss Whoosh Ping
 * Duration: 0.20s
 * Pitch: Linear sweep 620 Hz -> 1180 Hz
 * Envelope: Exponential decay exp(-10t) * 0.32
 */
export function synthesizeNearMiss(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.20;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = 620.0 + (1180.0 - 620.0) * (t / dur);
    const env = Math.exp(-10.0 * t) * 0.32;
    out[i] = Math.max(-1.0, Math.min(1.0, Math.sin(2.0 * Math.PI * freq * t) * env));
  }
  return out;
}

/**
 * 6. Biome Transition Shimmer
 * Duration: 0.45s
 * Waveform: 3-tone chord: 0.40 * sin(2*pi*440*t) + 0.35 * sin(2*pi*659.25*t) + 0.25 * sin(2*pi*880*t)
 * Envelope: Half-sine window sin(pi * t / dur) * 0.38
 */
export function synthesizeBiome(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.45;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const wave =
      0.40 * Math.sin(2.0 * Math.PI * 440.0 * t) +
      0.35 * Math.sin(2.0 * Math.PI * 659.25 * t) +
      0.25 * Math.sin(2.0 * Math.PI * 880.00 * t);
    const env = Math.sin((Math.PI * t) / dur) * 0.38;
    out[i] = Math.max(-1.0, Math.min(1.0, wave * env));
  }
  return out;
}

/**
 * 7. Crash / Explosion Sound (White Noise + 72 Hz Low Rumble)
 * Duration: 0.35s
 * Waveform: Uniform white noise [-1.0, 1.0] * 0.65 + low rumble sine at 72 Hz * 0.35
 * Envelope: Exponential decay exp(-7.5t) * 0.60
 */
export function synthesizeCrash(
  sampleRate: number = DEFAULT_SAMPLE_RATE,
  rng: () => number = Math.random
): Float32Array {
  const dur = 0.35;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const noise = (rng() * 2.0 - 1.0) * 0.65;
    const rumble = Math.sin(2.0 * Math.PI * 72.0 * t) * 0.35;
    const env = Math.exp(-7.5 * t) * 0.60;
    out[i] = Math.max(-1.0, Math.min(1.0, (noise + rumble) * env));
  }
  return out;
}

/**
 * 8. Calibration Done Chime (3-Tone Ascending A-Major Triad)
 * Duration: 0.30s
 * Pitch: 3 equal 0.10s segments: 440.00 Hz (A4), 554.37 Hz (C#5), 659.25 Hz (E5)
 * Envelope: Linear amplitude decay from 0.38 -> 0.05
 */
export function synthesizeCalibrated(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.30;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = t < 0.10 ? 440.00 : t < 0.20 ? 554.37 : 659.25;
    const env = 0.38 - (0.38 - 0.05) * (t / dur);
    out[i] = Math.max(-1.0, Math.min(1.0, Math.sin(2.0 * Math.PI * freq * t) * env));
  }
  return out;
}

/**
 * 9. Jump Spring Whoosh (Eyebrow Raise)
 * Duration: 0.22s
 * Pitch: 220 Hz upward spring sweep to 740 Hz
 */
export function synthesizeJump(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.22;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  let phase = 0.0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = 220.0 + 520.0 * Math.pow(t / dur, 0.7);
    phase += (2.0 * Math.PI * freq) / sampleRate;
    const env = Math.exp(-7.0 * t) * 0.42;
    out[i] = Math.max(-1.0, Math.min(1.0, Math.sin(phase) * env));
  }
  return out;
}

/**
 * 10. Energy Shield + Nitro Boost Chord (Asymmetric Wink)
 * Duration: 0.38s
 * Dual sweep and harmonic synth chord
 */
export function synthesizeShield(sampleRate: number = DEFAULT_SAMPLE_RATE): Float32Array {
  const dur = 0.38;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  let sweepPhase = 0.0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const fSweep = 330.0 + (990.0 - 330.0) * (t / dur);
    sweepPhase += (2.0 * Math.PI * fSweep) / sampleRate;
    const wave =
      0.45 * Math.sin(sweepPhase) +
      0.35 * Math.sin(2.0 * Math.PI * 659.25 * t) +
      0.20 * Math.sin(2.0 * Math.PI * 987.77 * t);
    const env = Math.sin((Math.PI * t) / dur) * 0.45;
    out[i] = Math.max(-1.0, Math.min(1.0, wave * env));
  }
  return out;
}

/**
 * 9. Synthwave Soundtrack Loop (8.0s Seamless Loop at 120 BPM)
 * Structure: Seamless 4-bar loop at 120 BPM (0.5s per beat, 16 beats = 8.0s, 352,800 samples at 44.1 kHz).
 * Chord Progression: 4 bars (2.0s each): Am -> F -> C -> G
 * 1. Driving 8th-note Synth Bass: Am (110 Hz), F (87.31 Hz), C (130.81 Hz), G (98 Hz)
 *    Saw harmonics (0.65*sin + 0.25*sin(2) + 0.12*sin(3)), 6ms attack, exp(-9.5*t8) * 0.42
 * 2. Sparkling 16th-note Arpeggio: Am [220, 261.63, 329.63, 440], F [174.61, 220, 261.63, 349.23],
 *    C [261.63, 329.63, 392, 523.25], G [196, 246.94, 293.66, 392], 4ms attack, exp(-16*t16) * 0.22
 * 3. Four-on-the-Floor Kick Drum: every 0.5s with pitch drop 48 + 95*exp(-32*t_beat) and exp(-14*t_beat) * 0.34
 * 4. 10ms boundary de-click fade ramp on loop boundaries to ensure seamless infinite looping.
 */
export function synthesizeSynthwaveLoop(
  sampleRate: number = DEFAULT_SAMPLE_RATE,
  volume: number = 1.0
): Float32Array {
  const bpm = 120.0;
  const beatSec = 60.0 / bpm; // 0.5s
  const totalBeats = 16;
  const totalSec = beatSec * totalBeats; // 8.0s
  const n = Math.round(sampleRate * totalSec);
  const out = new Float32Array(n);

  const bassFreqs = [110.0, 87.31, 130.81, 98.0]; // Am, F, C, G
  const arpChords = [
    [220.0, 261.63, 329.63, 440.0], // Am
    [174.61, 220.0, 261.63, 349.23], // F
    [261.63, 329.63, 392.0, 523.25], // C
    [196.0, 246.94, 293.66, 392.0], // G
  ];

  let bassPhase = 0.0;
  let arpPhase = 0.0;
  let kickPhase = 0.0;

  const fadeSamples = Math.floor(sampleRate * 0.01); // 10ms de-click ramp

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const barIdx = Math.min(Math.floor(t / (beatSec * 4.0)), 3);

    // 1. Driving 8th-note Synth Bass
    const eighthDur = beatSec / 2.0; // 0.25s
    const tEighth = t % eighthDur;
    const fBass = bassFreqs[barIdx];
    bassPhase += (2.0 * Math.PI * fBass) / sampleRate;
    const bassRaw =
      0.65 * Math.sin(bassPhase) +
      0.25 * Math.sin(2.0 * bassPhase) +
      0.12 * Math.sin(3.0 * bassPhase);
    const bassEnv = Math.exp(-9.5 * tEighth) * Math.min(1.0, tEighth / 0.006);
    const bass = bassRaw * bassEnv * 0.42;

    // 2. Sparkling 16th-note Arpeggio
    const sixteenthDur = beatSec / 4.0; // 0.125s
    const stepIdx = Math.floor(t / sixteenthDur) % 4;
    const tSixteenth = t % sixteenthDur;
    const fArp = arpChords[barIdx][stepIdx];
    arpPhase += (2.0 * Math.PI * fArp) / sampleRate;
    const arpRaw = 0.70 * Math.sin(arpPhase) + 0.25 * Math.sin(2.0 * arpPhase);
    const arpEnv = Math.exp(-16.0 * tSixteenth) * Math.min(1.0, tSixteenth / 0.004);
    const arp = arpRaw * arpEnv * 0.22;

    // 3. Four-on-the-Floor Kick Drum (every beat / 0.5s)
    const tBeat = t % beatSec;
    const kickFreq = 48.0 + 95.0 * Math.exp(-32.0 * tBeat);
    kickPhase += (2.0 * Math.PI * kickFreq) / sampleRate;
    const kick = Math.sin(kickPhase) * Math.exp(-14.0 * tBeat) * 0.34;

    let sample = (bass + arp + kick) * volume;

    // 10ms Boundary De-Click Fade
    if (i < fadeSamples) {
      sample *= i / fadeSamples;
    } else if (i > n - fadeSamples) {
      sample *= (n - i) / fadeSamples;
    }

    out[i] = Math.max(-1.0, Math.min(1.0, sample));
  }

  return out;
}
