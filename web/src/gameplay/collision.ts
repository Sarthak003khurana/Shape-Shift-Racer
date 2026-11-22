/**
 * Collision & Clearance Verification Engine.
 * Mathematical checking of vehicle dimensions vs. obstacle gaps and near-misses.
 */

import {
  LOW_BEAM_GAP_HEIGHT,
  PILLAR_GAP_WIDTH,
  CAR_Z,
  LANE_X,
  NEAR_MISS_BONUS,
} from '../config';

export interface CollisionCheckCar {
  normX: number;
  w: number;
  h: number;
  isShielded?: boolean;
  isAirborne?: boolean;
  jumpY?: number;
}

export interface CollisionResult {
  hasCollided: boolean;
  isNearMiss: boolean;
  obstacleId: number;
  bonusPoints: number;
}

/**
 * Checks LowBeam collision:
 * Active window: abs(z - CAR_Z) < 22.0.
 * Crash condition: car.h > LOW_BEAM_GAP_HEIGHT + 3.0 (i.e. > 33.0).
 * NORMAL (h=50) and NARROW (h=100) crash.
 * FLAT (h=22) clears cleanly.
 * If shielded, collision damage is blocked.
 */
export function checkLowBeamCollision(
  z: number,
  car: CollisionCheckCar
): { collided: boolean; nearMiss: boolean } {
  if (Math.abs(z - CAR_Z) < 22.0) {
    if (car.h > LOW_BEAM_GAP_HEIGHT + 3.0) {
      if (car.isShielded) {
        return { collided: false, nearMiss: true };
      }
      return { collided: true, nearMiss: false };
    }
  }

  // Near-miss check when obstacle has just passed the car
  const nearMiss =
    z < CAR_Z - 14.0 &&
    car.h >= LOW_BEAM_GAP_HEIGHT - 4.0 &&
    car.h <= LOW_BEAM_GAP_HEIGHT + 3.0;

  return { collided: false, nearMiss };
}

/**
 * Checks PillarGate collision:
 * Active window: abs(z - CAR_Z) < 22.0.
 * Crash condition: car.w > PILLAR_GAP_WIDTH + 4.0 (i.e. > 52.0) OR abs(car.normX - gateX) > 0.30.
 * NORMAL (w=84) and FLAT (w=136) crash.
 * NARROW (w=32) clears if aligned within 0.30 of gate center.
 * If shielded, collision damage is blocked.
 */
export function checkPillarGateCollision(
  z: number,
  gateX: number,
  car: CollisionCheckCar
): { collided: boolean; nearMiss: boolean } {
  if (Math.abs(z - CAR_Z) < 22.0) {
    if (car.w > PILLAR_GAP_WIDTH + 4.0 || Math.abs(car.normX - gateX) > 0.30) {
      if (car.isShielded) {
        return { collided: false, nearMiss: true };
      }
      return { collided: true, nearMiss: false };
    }
  }

  // Near-miss check when car squeezed through close to the pillar edges
  const lateralDist = Math.abs(car.normX - gateX);
  const nearMiss = z < CAR_Z - 14.0 && lateralDist >= 0.20 && lateralDist <= 0.30;

  return { collided: false, nearMiss };
}

/**
 * Checks RoadBlock collision:
 * Active window: abs(z - CAR_Z) < 22.0.
 * Crash condition: abs(car.normX - LANE_X[lane]) < 0.34 for any blocked lane.
 * If airborne (jumpY > 20) or shielded, roadblock is passed cleanly.
 */
export function checkRoadBlockCollision(
  z: number,
  lanes: number[],
  car: CollisionCheckCar
): { collided: boolean; nearMiss: boolean } {
  if (Math.abs(z - CAR_Z) < 22.0) {
    for (const lane of lanes) {
      const laneX = LANE_X[lane] ?? 0.0;
      if (Math.abs(car.normX - laneX) < 0.34) {
        if (car.isShielded || (car.isAirborne && (car.jumpY || 0) > 20.0)) {
          return { collided: false, nearMiss: true };
        }
        return { collided: true, nearMiss: false };
      }
    }
  }

  // Near-miss check when passing very close to a blockade
  let nearMiss = false;
  if (z < CAR_Z - 14.0 && lanes.length > 0) {
    const minDist = Math.min(...lanes.map((l) => Math.abs(car.normX - (LANE_X[l] ?? 0.0))));
    if (minDist >= 0.34 && minDist <= 0.48) {
      nearMiss = true;
    }
  }

  return { collided: false, nearMiss };
}

/**
 * Checks LaserStrip collision:
 * Active window: abs(z - CAR_Z) < 22.0.
 * Crash condition: car is not airborne (jumpY <= 18.0) and car is not shielded.
 * If car is airborne (jumpY > 18.0) or shielded, car leaps cleanly over the ground laser strip.
 */
export function checkLaserStripCollision(
  z: number,
  car: CollisionCheckCar
): { collided: boolean; nearMiss: boolean } {
  if (Math.abs(z - CAR_Z) < 22.0) {
    if (!car.isShielded && (!car.isAirborne || (car.jumpY || 0) <= 18.0)) {
      return { collided: true, nearMiss: false };
    }
  }

  // Near-miss check when car leaped over close to the laser strip
  const nearMiss =
    z < CAR_Z - 14.0 &&
    (car.jumpY || 0) > 18.0 &&
    (car.jumpY || 0) <= 42.0;

  return { collided: false, nearMiss };
}

/**
 * Checks energy coin collection:
 * Collection window: abs(coinZ - CAR_Z) < 28.0 and abs(car.normX - coinX) < 0.34.
 */
export function checkCoinCollection(
  coinZ: number,
  coinX: number,
  car: CollisionCheckCar
): boolean {
  return Math.abs(coinZ - CAR_Z) < 28.0 && Math.abs(car.normX - coinX) < 0.34;
}

export function calculateNearMissBonus(multiplier: number = 1): number {
  return NEAR_MISS_BONUS * multiplier;
}
