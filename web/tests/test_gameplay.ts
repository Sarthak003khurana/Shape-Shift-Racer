/**
 * Unit Test Suite for Core Gameplay, Collisions, State Machine & Storage.
 */

import {
  CAR_Z,
  LANE_X,
  getMultiplierForStreak,
} from '../src/config';
import { Car } from '../src/gameplay/car';
import { RoadRenderer } from '../src/graphics/road';
import {
  checkLowBeamCollision,
  checkPillarGateCollision,
  checkRoadBlockCollision,
  checkLaserStripCollision,
  checkCoinCollection,
} from '../src/gameplay/collision';
import { LaserStrip, ObstacleManager } from '../src/gameplay/obstacles';
import { createStateMachine } from '../src/core/state';
import {
  loadHighScores,
  saveHighScore,
  loadSettings,
  saveSettings,
} from '../src/core/storage';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock window.localStorage in Node environment
const store: Record<string, string> = {};
(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window || {};
((globalThis as unknown as { window: Record<string, unknown> }).window as Record<string, unknown>).localStorage = {
  getItem: (key: string) => (key in store ? store[key] : null),
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

console.log('Running Core Gameplay, Collision, State Machine & Storage Unit Tests...\n');

// 1. Car morphing, steering clamping & smooth tween
{
  const road = new RoadRenderer();
  const car = new Car();
  assert(car.currentShapeKey === 'NORMAL', 'Car starts in NORMAL shape');
  assert(car.w === 84 && car.h === 50, 'NORMAL dimensions should be 84x50');

  assert(car.setShape('FLAT') === true, 'Morphing NORMAL -> FLAT returns true');
  assert(car.setShape('FLAT') === false, 'Morphing FLAT -> FLAT returns false');
  car.setTargetSteer(1.5);
  assert(car.targetNormX === 0.82, 'Steering clamps to max 0.82');

  for (let i = 0; i < 60; i++) {
    car.update(road, 1 / 60);
  }
  assert(Math.abs(car.w - 136) < 2 && Math.abs(car.h - 22) < 2, 'FLAT morph converges to 136x22');
  assert(Math.abs(car.normX - 0.82) < 0.02, 'Steer converges smoothly to 0.82');

  car.setShape('NARROW');
  for (let i = 0; i < 60; i++) {
    car.update(road, 1 / 60);
  }
  assert(Math.abs(car.w - 32) < 2 && Math.abs(car.h - 100) < 2, 'NARROW morph converges to 32x100');

  // Jump physics test
  assert(car.triggerJump() === true, 'triggerJump launches car when grounded');
  assert(car.isAirborne === false, 'Car not airborne immediately at jump launch');
  for (let i = 0; i < 15; i++) {
    car.update(road, 1 / 60);
  }
  assert(car.isAirborne === true && car.jumpY > 18.0, 'Car becomes airborne during jump peak');

  // Shield & Nitro test
  assert(car.activateShield(3.0) === true, 'activateShield succeeds when off cooldown');
  assert(car.isShielded === true, 'Car is shielded after activation');

  car.reset();
  assert(car.currentShapeKey === 'NORMAL' && car.normX === 0, 'Car reset restores NORMAL and center');
  assert(car.jumpY === 0 && car.isShielded === false, 'Car reset restores grounded and unshielded state');
  console.log('✓ 1. Car morphing, jump physics, shield activation, steering clamp, tween convergence, and reset verified.');
}

// 2. Collision clearance physics (LowBeam, PillarGate, RoadBlock, Coin)
{
  const normalCar = { normX: 0.0, w: 84, h: 50 };
  const flatCar = { normX: 0.0, w: 136, h: 22 };
  const narrowCar = { normX: 0.0, w: 32, h: 100 };

  // LowBeam (gap height 30): only FLAT clears
  assert(checkLowBeamCollision(CAR_Z, normalCar).collided === true, 'NORMAL crashes into LowBeam');
  assert(checkLowBeamCollision(CAR_Z, narrowCar).collided === true, 'NARROW crashes into LowBeam');
  assert(checkLowBeamCollision(CAR_Z, flatCar).collided === false, 'FLAT clears LowBeam cleanly');

  // PillarGate (gap width 48): only NARROW aligned to gate clears
  assert(checkPillarGateCollision(CAR_Z, 0.0, normalCar).collided === true, 'NORMAL crashes into PillarGate');
  assert(checkPillarGateCollision(CAR_Z, 0.0, flatCar).collided === true, 'FLAT crashes into PillarGate');
  assert(checkPillarGateCollision(CAR_Z, 0.0, narrowCar).collided === false, 'Aligned NARROW clears PillarGate');
  assert(
    checkPillarGateCollision(CAR_Z, LANE_X[2], narrowCar).collided === true,
    'Misaligned NARROW crashes into PillarGate'
  );

  // RoadBlock
  assert(checkRoadBlockCollision(CAR_Z, [1], normalCar).collided === true, 'Center car hits center RoadBlock');
  assert(checkRoadBlockCollision(CAR_Z, [0, 2], normalCar).collided === false, 'Center car clears outer RoadBlocks');

  // Jump over RoadBlock test
  const jumpingCar = { normX: 0.0, w: 84, h: 50, isAirborne: true, jumpY: 35.0 };
  assert(checkRoadBlockCollision(CAR_Z, [1], jumpingCar).collided === false, 'Airborne car jumps over center RoadBlock');

  // Shield protection test
  const shieldedCar = { normX: 0.0, w: 84, h: 50, isShielded: true };
  assert(checkRoadBlockCollision(CAR_Z, [1], shieldedCar).collided === false, 'Shielded car blocks RoadBlock damage');
  assert(checkLowBeamCollision(CAR_Z, shieldedCar).collided === false, 'Shielded car blocks LowBeam damage');

  // LaserStrip (jumping ground obstacle)
  assert(checkLaserStripCollision(CAR_Z, normalCar).collided === true, 'Grounded car crashes into LaserStrip');
  assert(checkLaserStripCollision(CAR_Z, jumpingCar).collided === false, 'Airborne car clears LaserStrip cleanly');
  assert(checkLaserStripCollision(CAR_Z, shieldedCar).collided === false, 'Shielded car blocks LaserStrip damage');

  // ObstacleManager LaserStrip spawning
  const obsMgr = new ObstacleManager();
  // @ts-expect-error accessing private method for test
  obsMgr.spawnFromSpec({ kind: 'LASER_STRIP' });
  assert(obsMgr.obstacles.length === 1, 'LaserStrip spawned in ObstacleManager');
  assert(obsMgr.obstacles[0] instanceof LaserStrip, 'Spawned obstacle is LaserStrip instance');
  assert(obsMgr.coins.length === 1 && obsMgr.coins[0].elevation === 64.0, 'High floating coin spawned above LaserStrip');

  // Coin collection
  assert(checkCoinCollection(CAR_Z, 0.0, normalCar) === true, 'Coin in car path collected');
  assert(checkCoinCollection(CAR_Z, LANE_X[2], normalCar) === false, 'Coin in other lane not collected');
  console.log('✓ 2. Collision & clearance rules for LowBeam, PillarGate, RoadBlock, LaserStrip, and Coins verified.');
}

// 3. Streak multiplier tiers & state machine
{
  assert(getMultiplierForStreak(0) === 1, 'Streak 0 -> 1x');
  assert(getMultiplierForStreak(3) === 2, 'Streak 3 -> 2x');
  assert(getMultiplierForStreak(6) === 3, 'Streak 6 -> 3x');
  assert(getMultiplierForStreak(10) === 5, 'Streak 10 -> 5x');

  const sm = createStateMachine('START');
  assert(sm.current === 'START', 'Initial state is START');
  sm.transition('PLAYING');
  assert(sm.current === 'PLAYING', 'START -> PLAYING');
  sm.transition('PAUSED');
  assert(sm.current === 'PAUSED', 'PLAYING -> PAUSED');
  sm.transition('PLAYING');
  assert(sm.current === 'PLAYING', 'PAUSED -> PLAYING');
  sm.transition('GAMEOVER');
  assert(sm.current === 'GAMEOVER', 'PLAYING -> GAMEOVER');
  console.log('✓ 3. Streak multiplier tiers and GameStateMachine transitions verified.');
}

// 4. Persistent highscores (Top-5 sorting) & settings roundtrip
{
  for (const s of [250, 900, 400, 1200, 150, 750]) {
    saveHighScore(s, 300, 5, 10);
  }
  const scores = loadHighScores();
  assert(scores.length === 5, `Top-5 cap enforced, got ${scores.length}`);
  assert(scores[0].score === 1200 && scores[4].score === 250, 'Scores sorted descending');

  saveSettings({
    smile_sensitivity: 1.35,
    open_sensitivity: 0.9,
    steer_sensitivity: 1.15,
    music_enabled: false,
  });
  const loaded = loadSettings();
  assert(loaded.smile_sensitivity === 1.35 && loaded.music_enabled === false, 'Settings persisted accurately');
  console.log('✓ 4. Top-5 high score sorting and settings persistence verified.');
}

console.log('\nAll Core Gameplay unit tests passed successfully!');
