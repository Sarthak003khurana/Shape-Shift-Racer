/**
 * Test Suite: Web Audio Procedural Synthesizers & Formulas.
 * Validates sample counts, durations, boundary values, envelopes, and dynamic ranges.
 */

import {
  DEFAULT_SAMPLE_RATE,
  synthesizeMorph,
  synthesizeClear,
  synthesizeCoin,
  synthesizeStreak,
  synthesizeNearMiss,
  synthesizeBiome,
  synthesizeCrash,
  synthesizeCalibrated,
  synthesizeJump,
  synthesizeShield,
  synthesizeSynthwaveLoop,
} from '../src/audio/synth';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertInRange(val: number, min: number, max: number, name: string): void {
  if (val < min || val > max) {
    throw new Error(`Assertion failed: ${name} = ${val} not in [${min}, ${max}]`);
  }
}

function checkBufferBounds(buf: Float32Array, name: string): { min: number; max: number; peak: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i];
    if (isNaN(s)) throw new Error(`${name} contains NaN at index ${i}`);
    if (s < min) min = s;
    if (s > max) max = s;
  }
  assert(min >= -1.0, `${name} min sample ${min} < -1.0`);
  assert(max <= 1.0, `${name} max sample ${max} > 1.0`);
  const peak = Math.max(Math.abs(min), Math.abs(max));
  assert(peak > 0.01, `${name} is effectively silent (peak = ${peak})`);
  return { min, max, peak };
}

console.log('Running Procedural Audio Synthesizer Unit Tests...\n');

// 1. Morph
{
  const buf = synthesizeMorph(44100);
  assert(buf.length === 7056, `Morph length expected 7056, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeMorph');
  assert(Math.abs(buf[0]) < 1e-4, 'Morph first sample should start at 0');
  assert(Math.abs(buf[buf.length - 1]) < 0.01, 'Morph last sample should be near 0 due to linear decay');
  console.log(`✓ 1. synthesizeMorph (44.1kHz): ${buf.length} samples (0.16s), peak=${peak.toFixed(3)}`);
}

// 2. Clear
{
  const buf = synthesizeClear(44100);
  assert(buf.length === 8820, `Clear length expected 8820, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeClear');
  // Later samples should be heavily decayed
  const lateSample = Math.abs(buf[buf.length - 1]);
  assert(lateSample < 0.05, `Clear tail sample ${lateSample} not sufficiently decayed`);
  console.log(`✓ 2. synthesizeClear (44.1kHz): ${buf.length} samples (0.20s), peak=${peak.toFixed(3)}`);
}

// 3. Coin
{
  const buf = synthesizeCoin(44100);
  assert(buf.length === 7938, `Coin length expected 7938, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeCoin');
  console.log(`✓ 3. synthesizeCoin (44.1kHz): ${buf.length} samples (0.18s), peak=${peak.toFixed(3)}`);
}

// 4. Streak
{
  const buf = synthesizeStreak(44100);
  assert(buf.length === 14994, `Streak length expected 14994, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeStreak');
  console.log(`✓ 4. synthesizeStreak (44.1kHz): ${buf.length} samples (0.34s), peak=${peak.toFixed(3)}`);
}

// 5. Near Miss
{
  const buf = synthesizeNearMiss(44100);
  assert(buf.length === 8820, `NearMiss length expected 8820, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeNearMiss');
  console.log(`✓ 5. synthesizeNearMiss (44.1kHz): ${buf.length} samples (0.20s), peak=${peak.toFixed(3)}`);
}

// 6. Biome
{
  const buf = synthesizeBiome(44100);
  assert(buf.length === 19845, `Biome length expected 19845, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeBiome');
  // Half sine window starts and ends at 0
  assert(Math.abs(buf[0]) < 1e-4, 'Biome first sample should be ~0');
  assert(Math.abs(buf[buf.length - 1]) < 0.01, 'Biome last sample should be ~0');
  console.log(`✓ 6. synthesizeBiome (44.1kHz): ${buf.length} samples (0.45s), peak=${peak.toFixed(3)}`);
}

// 7. Crash
{
  // Test with deterministic pseudo-RNG
  let seed = 12345;
  const mockRng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const buf = synthesizeCrash(44100, mockRng);
  assert(buf.length === 15435, `Crash length expected 15435, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeCrash');
  console.log(`✓ 7. synthesizeCrash (44.1kHz): ${buf.length} samples (0.35s), peak=${peak.toFixed(3)}`);
}

// 8. Calibrated
{
  const buf = synthesizeCalibrated(44100);
  assert(buf.length === 13230, `Calibrated length expected 13230, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeCalibrated');
  console.log(`✓ 8. synthesizeCalibrated (44.1kHz): ${buf.length} samples (0.30s), peak=${peak.toFixed(3)}`);
}

// 8b. Jump
{
  const buf = synthesizeJump(44100);
  assert(buf.length === 9702, `Jump length expected 9702, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeJump');
  console.log(`✓ 8b. synthesizeJump (44.1kHz): ${buf.length} samples (0.22s), peak=${peak.toFixed(3)}`);
}

// 8c. Shield
{
  const buf = synthesizeShield(44100);
  assert(buf.length === 16758, `Shield length expected 16758, got ${buf.length}`);
  const { peak } = checkBufferBounds(buf, 'synthesizeShield');
  console.log(`✓ 8c. synthesizeShield (44.1kHz): ${buf.length} samples (0.38s), peak=${peak.toFixed(3)}`);
}

// 9. Synthwave Soundtrack Loop (8.0s)
{
  const buf = synthesizeSynthwaveLoop(44100);
  assert(buf.length === 352800, `Synthwave loop expected 352800 samples, got ${buf.length}`);
  const { min, max, peak } = checkBufferBounds(buf, 'synthesizeSynthwaveLoop');
  
  // Verify 10ms boundary de-click ramp:
  // First sample must be exactly 0 (i=0 -> sample * 0)
  assert(Math.abs(buf[0]) === 0, `Loop start sample should be 0 for de-click, got ${buf[0]}`);
  // Tail sample must be scaled down
  assert(Math.abs(buf[buf.length - 1]) < 0.02, `Loop tail sample should be near 0 for de-click, got ${buf[buf.length - 1]}`);
  
  console.log(`✓ 9. synthesizeSynthwaveLoop (44.1kHz): ${buf.length} samples (8.0s @ 120 BPM), peak=${peak.toFixed(3)} [${min.toFixed(3)}, ${max.toFixed(3)}]`);
}

// 10. Native 48 kHz Sample Rate Invariance Test
{
  const sr48 = 48000;
  const loop48 = synthesizeSynthwaveLoop(sr48);
  assert(loop48.length === 384000, `48kHz loop expected 384000 samples, got ${loop48.length}`);
  checkBufferBounds(loop48, 'synthesizeSynthwaveLoop@48kHz');

  const morph48 = synthesizeMorph(sr48);
  assert(morph48.length === 7680, `48kHz morph expected 7680 samples, got ${morph48.length}`);
  checkBufferBounds(morph48, 'synthesizeMorph@48kHz');
  console.log(`✓ 10. Sample rate scaling to 48 kHz verified (loop: ${loop48.length} samples, morph: ${morph48.length} samples)`);
}

console.log('\nAll Procedural Audio Synthesizer tests passed successfully!');
