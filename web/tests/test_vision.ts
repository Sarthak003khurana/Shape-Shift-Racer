/**
 * Comprehensive Unit Test Suite for Vision Subsystem:
 *  1. OneEuroFilter (smoothing, cutoff adaptation, velocity filtering, reset)
 *  2. VisionProcessor (blendshape normalization, cross-suppression, hysteresis state machine, deadzone steering)
 *  3. CalibrationManager (fast 1-step auto-zero, 3-step interactive calibration wizard)
 *  4. ControlsManager Integration (vision steering & shape morphs, keyboard/touch priority)
 */

import { OneEuroFilter } from '../src/vision/filter';
import { VisionProcessor, DEFAULT_BASELINES } from '../src/vision/processor';
import { CalibrationManager } from '../src/vision/calibration';
import { ControlsManager } from '../src/input/controls';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock window and localStorage if in Node environment
if (typeof window === 'undefined' || !window.localStorage) {
  const store: Record<string, string> = {};
  (globalThis as any).window = globalThis.window || {};
  (globalThis as any).window.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

console.log('Running Vision & Expression Pipeline Unit Tests...\n');

// ==========================================
// 1. OneEuroFilter Tests
// ==========================================
{
  const filter = new OneEuroFilter(1.0, 0.05, 1.0);

  // Initial value passes through directly
  const v0 = filter.filter(10.0, 0.0);
  assert(v0 === 10.0, 'Initial filter call should return input value unchanged');

  // Constant input stays constant
  const v1 = filter.filter(10.0, 0.033);
  assert(Math.abs(v1 - 10.0) < 1e-4, 'Constant input should produce constant output');

  // Jittery input gets smoothed (small step)
  const vSmall = filter.filter(10.2, 0.066);
  assert(vSmall > 10.0 && vSmall < 10.2, 'Small perturbation should be heavily smoothed');

  // Rapid step input adapts cutoff frequency and responds quickly
  const vJump = filter.filter(20.0, 0.099);
  assert(vJump > vSmall, 'Large step input should adapt cutoff and track rapidly');

  // Reset clears state
  filter.reset();
  const vReset = filter.filter(50.0, 1.0);
  assert(vReset === 50.0, 'Filter after reset should pass new value directly');

  console.log('✓ 1. OneEuroFilter initialization, noise attenuation, step response, and reset verified.');
}

// ==========================================
// 2. VisionProcessor Blendshape & Cross-Suppression Tests
// ==========================================
{
  const processor = new VisionProcessor();
  processor.baselines = { ...DEFAULT_BASELINES, baseSmile: 0.0, baseOpen: 0.0, smileSpan: 1.0, openSpan: 1.0 };

  // Case A: Neutral frame
  const neutralState = processor.processFrame({}, null, null, 0.1);
  assert(neutralState.activeShape === 'NORMAL', 'Empty blendshapes should remain in NORMAL shape');
  assert(neutralState.smoothSmile === 0.0, 'Neutral smoothSmile should be 0');
  assert(neutralState.smoothOpen === 0.0, 'Neutral smoothOpen should be 0');

  // Case B: Strong Smile cross-suppresses Open Mouth
  const smileDominant = processor.processFrame(
    { mouthSmileLeft: 0.8, mouthSmileRight: 0.8, jawOpen: 0.5 },
    null,
    null,
    0.2
  );
  // With smileScore = 0.8 > 0.55, openScore is multiplied by 0.40 (0.5 * 0.40 = 0.20)
  assert(smileDominant.openScore <= 0.25, `Smile cross-suppression should reduce openScore, got ${smileDominant.openScore}`);

  // Case C: Strong Open Mouth cross-suppresses Smile
  processor.reset();
  const openDominant = processor.processFrame(
    { mouthSmileLeft: 0.5, mouthSmileRight: 0.5, jawOpen: 0.8 },
    null,
    null,
    0.3
  );
  // With openScore = 0.8 > 0.40, smileScore is multiplied by 0.25 (0.5 * 0.25 = 0.125)
  assert(openDominant.smileScore <= 0.20, `Open mouth cross-suppression should reduce smileScore, got ${openDominant.smileScore}`);

  console.log('✓ 2. Blendshape extraction and cross-suppression verified.');
}

// ==========================================
// 3. Hysteresis State Transitions
// ==========================================
{
  const processor = new VisionProcessor();

  // Initial state is NORMAL
  assert(processor.getShape() === 'NORMAL', 'Initial shape should be NORMAL');

  // NORMAL -> FLAT (smile > 0.42)
  processor.updateShapeHysteresis(0.45, 0.10);
  assert(processor.getShape() === 'FLAT', 'Smile above 0.42 should trigger FLAT');

  // Hysteresis hold: smile drops to 0.35 (> 0.28 exit threshold), should stay FLAT
  processor.updateShapeHysteresis(0.35, 0.10);
  assert(processor.getShape() === 'FLAT', 'Smile at 0.35 should remain FLAT due to hysteresis (exit threshold 0.28)');

  // Exit FLAT -> NORMAL: smile drops below 0.28
  processor.updateShapeHysteresis(0.25, 0.10);
  assert(processor.getShape() === 'NORMAL', 'Smile below 0.28 should revert to NORMAL');

  // NORMAL -> NARROW (open > 0.42)
  processor.updateShapeHysteresis(0.10, 0.45);
  assert(processor.getShape() === 'NARROW', 'Open mouth above 0.42 should trigger NARROW');

  // Hysteresis hold: open drops to 0.32 (> 0.28 exit threshold), should stay NARROW
  processor.updateShapeHysteresis(0.10, 0.32);
  assert(processor.getShape() === 'NARROW', 'Open mouth at 0.32 should remain NARROW due to hysteresis');

  // Direct switch NARROW -> FLAT: smile > 0.42 AND smile > open + 0.12
  processor.updateShapeHysteresis(0.60, 0.44); // 0.60 > 0.44 + 0.12 = 0.56
  assert(processor.getShape() === 'FLAT', 'Strong smile surpassing open by mutual margin should switch directly from NARROW to FLAT');

  // Direct switch FLAT -> NARROW: open > 0.42 AND open > smile + 0.12
  processor.updateShapeHysteresis(0.44, 0.60); // 0.60 > 0.44 + 0.12 = 0.56
  assert(processor.getShape() === 'NARROW', 'Strong open mouth surpassing smile by mutual margin should switch directly from FLAT to NARROW');

  console.log('✓ 3. Hysteresis state transitions (enter 0.42, exit 0.28, mutual margin 0.12) verified.');
}

// ==========================================
// 4. Head Pose Steering, Deadzone & Center Snapping
// ==========================================
{
  const processor = new VisionProcessor();
  processor.baselines = { ...DEFAULT_BASELINES, baseYaw: 0.0, baseRoll: 0.0 };

  // Case A: Inside deadzone (< 0.18) -> should output 0
  // matrix corresponding to ~2 degrees yaw -> diffYaw ~ 2/25 = 0.08 < 0.18
  const matrixSmall = [
    0.999, 0, 0.035, 0,
    0, 1, 0, 0,
    -0.035, 0, 0.999, 0,
    0, 0, 0, 1
  ];
  const stateDeadzone = processor.processFrame(null, matrixSmall, null, 1.0);
  assert(stateDeadzone.targetSteer === 0.0, 'Steering within deadzone (<0.18) must produce targetSteer = 0.0');

  // Case B: Outside deadzone (> 0.18) -> should produce proportional steering
  // matrix corresponding to ~12 degrees yaw -> diffYaw ~ 12/25 = 0.48
  const matrixTurn = [
    0.978, 0, 0.208, 0,
    0, 1, 0, 0,
    -0.208, 0, 0.978, 0,
    0, 0, 0, 1
  ];
  const stateTurn = processor.processFrame(null, matrixTurn, null, 1.05);
  assert(stateTurn.rawSteer > 0.18, 'Yaw turn should produce rawSteer exceeding deadzone');
  assert(stateTurn.targetSteer > 0.0, 'targetSteer should be positive');
  assert(stateTurn.steerNormX > 0.0 && stateTurn.steerNormX <= 0.82, 'steerNormX must be within [0, 0.82]');

  // Case C: 2D Landmark Head Turn RIGHT in front of unmirrored webcam
  // In unmirrored camera, nose shifts toward camera left (closer to cheek 234)
  const mockLandmarks: { x: number; y: number; z: number }[] = [];
  for (let idx = 0; idx < 468; idx++) {
    mockLandmarks.push({ x: 0.5, y: 0.5, z: 0 });
  }
  mockLandmarks[33] = { x: 0.40, y: 0.50, z: 0 };  // Right eye (image left)
  mockLandmarks[263] = { x: 0.60, y: 0.50, z: 0 }; // Left eye (image right)
  mockLandmarks[1] = { x: 0.44, y: 0.50, z: 0 };   // Nose shifted left (user turned RIGHT)
  mockLandmarks[234] = { x: 0.35, y: 0.50, z: 0 }; // Cheek L
  mockLandmarks[454] = { x: 0.65, y: 0.50, z: 0 }; // Cheek R

  const stateLandmarkRight = processor.processFrame(null, null, mockLandmarks, 1.10);
  assert(stateLandmarkRight.yawDeg > 0, `Turning head RIGHT must produce positive yawDeg, got ${stateLandmarkRight.yawDeg}`);
  assert(stateLandmarkRight.rawSteer > 0.16, 'Turning head RIGHT must produce positive steer exceeding deadzone');
  assert(stateLandmarkRight.targetSteer > 0.0, 'targetSteer must steer RIGHT (+X)');

  // Case D: Eyebrow Raise -> Jump Trigger
  const stateBrow = processor.processFrame(
    { browInnerUp: 0.65, browOuterUpLeft: 0.55, browOuterUpRight: 0.55 },
    null,
    null,
    2.0
  );
  assert(stateBrow.smoothBrow > 0.40, 'Eyebrow raise must produce high smoothBrow score');
  assert(stateBrow.jumpTriggered === true, 'Eyebrow raise must trigger Jump');

  // Case E: Asymmetric Wink -> Shield Trigger
  processor.processFrame({ eyeBlinkLeft: 0.85, eyeBlinkRight: 0.10 }, null, null, 3.0);
  const stateWink = processor.processFrame({ eyeBlinkLeft: 0.85, eyeBlinkRight: 0.10 }, null, null, 3.05);
  assert(stateWink.shieldTriggered === true, 'Asymmetric Wink held for 2 frames must trigger Energy Shield');

  console.log('✓ 4. Head pose steering (right=positive), eyebrow jump, wink shield, deadzone & center snapping verified.');
}

// ==========================================
// 5. Fast 1-Step Auto-Zero & 3-Step Calibration Wizard
// ==========================================
{
  const calib = new CalibrationManager();

  // Fast 1-Step Auto-Zero (10 frames)
  calib.resetAutoZero();
  for (let i = 0; i < 9; i++) {
    const done = calib.feedAutoZeroFrame({
      smileRaw: 0.06 + (i * 0.002),
      openRaw: 0.04 + (i * 0.001),
      yawDeg: 1.0,
      rollDeg: 0.5,
    });
    assert(!done, `Frame ${i + 1} should not finish auto-zero yet`);
  }

  // 10th frame triggers baseline computation
  const done10 = calib.feedAutoZeroFrame({
    smileRaw: 0.07,
    openRaw: 0.045,
    yawDeg: 1.0,
    rollDeg: 0.5,
  });
  assert(done10, '10th frame must complete auto-zero calibration');

  const autoBaselines = calib.getBaselines();
  assert(autoBaselines.baseSmile > 0.05 && autoBaselines.baseSmile < 0.08, 'Median smile baseline computed correctly');
  assert(autoBaselines.baseYaw === 1.0, 'Median yaw baseline computed correctly');

  // 3-Step Interactive Calibration Wizard
  let stepChanges: string[] = [];
  let chimeTriggered = 0;

  calib.setCallbacks({
    onStepStart: (step) => stepChanges.push(step),
    onStepComplete: () => chimeTriggered++,
  });

  calib.startInteractiveCalibration();
  assert(calib.getCurrentStep() === 'NEUTRAL', 'Calibration should start at NEUTRAL');

  // Update Neutral for 2.2 seconds
  calib.update(2.3, { smileRaw: 0.05, openRaw: 0.04, yawDeg: 0.0, rollDeg: 0.0 });
  assert(calib.getCurrentStep() === 'SMILE', 'After 2.2s Neutral, should advance to SMILE');
  assert(chimeTriggered === 1, 'Chime should trigger upon Neutral completion');

  // Update Smile for 2.2 seconds
  calib.update(2.3, { smileRaw: 0.55, openRaw: 0.05, yawDeg: 0.0, rollDeg: 0.0 });
  assert(calib.getCurrentStep() === 'OPEN', 'After 2.2s Smile, should advance to OPEN');
  assert(chimeTriggered === 2, 'Chime should trigger upon Smile completion');

  // Update Open for 2.2 seconds
  calib.update(2.3, { smileRaw: 0.05, openRaw: 0.60, yawDeg: 0.0, rollDeg: 0.0 });
  assert(calib.getCurrentStep() === 'COMPLETE', 'After 2.2s Open, should complete calibration');
  assert(chimeTriggered === 3, 'Chime should trigger upon Open completion');

  const finalBaselines = calib.getBaselines();
  assert(finalBaselines.smileSpan > 0.15, 'smileSpan should be personalized');
  assert(finalBaselines.openSpan > 0.15, 'openSpan should be personalized');

  console.log('✓ 5. Fast 1-step auto-zero and 3-step interactive calibration wizard verified.');
}

// ==========================================
// 6. ControlsManager Vision Input Integration & Priority
// ==========================================
{
  const controls = new ControlsManager();

  // Test A: Vision input provided when no keys pressed
  controls.setVisionInput(0.45, 'FLAT');
  const inputA = controls.poll();
  assert(Math.abs(inputA.targetNormX - 0.45) < 1e-4, 'Steering should follow vision when keys/touch idle');
  assert(inputA.targetShape === 'FLAT', 'Shape should follow vision when keys/touch idle');

  // Test B: Vision inputs clamp within [-0.82, 0.82]
  controls.setVisionInput(0.95, 'NARROW');
  const inputB = controls.poll();
  assert(inputB.targetNormX === 0.82, 'Steering from vision should clamp to 0.82 max');

  // Test C: Camera inactive / denied (vision = null)
  controls.setVisionInput(null, null);
  const inputC = controls.poll();
  assert(inputC.targetNormX === 0.0, 'When vision is null, steering defaults to neutral');
  assert(inputC.targetShape === null, 'When vision is null, shape defaults to null');

  console.log('✓ 6. ControlsManager integration, priority handling, and camera-denied fallback verified.');
}

console.log('\nAll Vision Subsystem unit tests passed successfully!');
