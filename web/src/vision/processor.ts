/**
 * Vision Processor:
 * Normalizes blendshapes, performs cross-suppression, executes hysteresis state switching,
 * calculates 3D / 2D head pose steering, and applies One-Euro filtering.
 */

import { CarShapeKey } from '../config';
import {
  OneEuroFilter,
  STEER_FILTER_CONFIG,
  SMILE_FILTER_CONFIG,
  OPEN_FILTER_CONFIG,
} from './filter';

export interface VisionState {
  steerNormX: number; // Normalized steering offset [-0.82, 0.82]
  activeShape: CarShapeKey; // NORMAL, FLAT, or NARROW
  smileRaw: number;
  openRaw: number;
  smileScore: number;
  openScore: number;
  smoothSmile: number;
  smoothOpen: number;
  browScore: number;
  smoothBrow: number;
  jumpTriggered: boolean;
  winkScore: number;
  shieldTriggered: boolean;
  yawDeg: number;
  rollDeg: number;
  rawSteer: number;
  targetSteer: number;
  smoothSteer: number;
  faceDetected: boolean;
}

export interface CalibrationBaselines {
  baseSmile: number;
  baseOpen: number;
  baseYaw: number;
  baseRoll: number;
  smileSpan: number;
  openSpan: number;
}

export const DEFAULT_BASELINES: CalibrationBaselines = {
  baseSmile: 0.03,
  baseOpen: 0.03,
  baseYaw: 0.0,
  baseRoll: 0.0,
  smileSpan: 0.24,
  openSpan: 0.20,
};

export class VisionProcessor {
  // Current active shape
  private currentShape: CarShapeKey = 'NORMAL';

  // Filters
  public readonly steerFilter: OneEuroFilter;
  public readonly smileFilter: OneEuroFilter;
  public readonly openFilter: OneEuroFilter;
  public readonly browFilter: OneEuroFilter;

  // Jump and Shield trigger states
  private browArmed: boolean = true;
  private lastJumpTime: number = 0.0;
  private winkHoldFrames: number = 0;
  private lastShieldTime: number = 0.0;

  // Calibration parameters
  public baselines: CalibrationBaselines = { ...DEFAULT_BASELINES };

  // User sensitivity scalars
  public smileSens: number = 1.0;
  public openSens: number = 1.0;
  public steerSens: number = 1.0;

  // Hysteresis constants (rapid engagement, stable hold)
  public readonly enterThresh: number = 0.42;
  public readonly exitThresh: number = 0.28;
  public readonly mutualMargin: number = 0.12;

  // Deadzone & steering limits
  public readonly deadzone: number = 0.18;
  public readonly snapThreshold: number = 0.03;
  public readonly maxSteerNormX: number = 0.82;

  constructor() {
    this.steerFilter = new OneEuroFilter(
      STEER_FILTER_CONFIG.minCutoff,
      STEER_FILTER_CONFIG.beta,
      STEER_FILTER_CONFIG.dCutoff
    );
    this.smileFilter = new OneEuroFilter(
      SMILE_FILTER_CONFIG.minCutoff,
      SMILE_FILTER_CONFIG.beta,
      SMILE_FILTER_CONFIG.dCutoff
    );
    this.openFilter = new OneEuroFilter(
      OPEN_FILTER_CONFIG.minCutoff,
      OPEN_FILTER_CONFIG.beta,
      OPEN_FILTER_CONFIG.dCutoff
    );
    this.browFilter = new OneEuroFilter(1.0, 0.05, 1.0);
  }

  public reset(): void {
    this.currentShape = 'NORMAL';
    this.steerFilter.reset();
    this.smileFilter.reset();
    this.openFilter.reset();
    this.browFilter.reset();
    this.browArmed = true;
    this.lastJumpTime = 0.0;
    this.winkHoldFrames = 0;
    this.lastShieldTime = 0.0;
  }

  public setBaselines(baselines: Partial<CalibrationBaselines>): void {
    this.baselines = { ...this.baselines, ...baselines };
  }

  public setSensitivities(smile: number, open: number, steer: number): void {
    this.smileSens = Math.max(0.2, Math.min(2.5, smile));
    this.openSens = Math.max(0.2, Math.min(2.5, open));
    this.steerSens = Math.max(0.2, Math.min(2.5, steer));
  }

  public processFrame(
    blendshapes: Record<string, number> | null,
    matrix: number[] | null,
    landmarks: { x: number; y: number; z: number }[] | null,
    timestampSec?: number
  ): VisionState {
    const now = timestampSec !== undefined ? timestampSec : performance.now() / 1000.0;

    if (!blendshapes && !matrix && (!landmarks || landmarks.length === 0)) {
      // No face detected in this frame
      const smoothSteer = this.steerFilter.filter(0.0, now);
      return {
        steerNormX: 0.0,
        activeShape: this.currentShape,
        smileRaw: 0.0,
        openRaw: 0.0,
        smileScore: 0.0,
        openScore: 0.0,
        smoothSmile: 0.0,
        smoothOpen: 0.0,
        browScore: 0.0,
        smoothBrow: 0.0,
        jumpTriggered: false,
        winkScore: 0.0,
        shieldTriggered: false,
        yawDeg: 0.0,
        rollDeg: 0.0,
        rawSteer: 0.0,
        targetSteer: 0.0,
        smoothSteer,
        faceDetected: false,
      };
    }

    const b = blendshapes || {};

    // 1. Raw blendshape extraction
    const smileLeft = b['mouthSmileLeft'] || 0.0;
    const smileRight = b['mouthSmileRight'] || 0.0;
    const smileRaw = (smileLeft + smileRight) * 0.5;

    const jawOpen = b['jawOpen'] || 0.0;
    const mouthFunnel = b['mouthFunnel'] || 0.0;
    const mouthPucker = b['mouthPucker'] || 0.0;
    const openRaw = Math.max(
      jawOpen,
      mouthFunnel * 0.95,
      0.60 * jawOpen + 0.40 * mouthFunnel,
      0.50 * mouthFunnel + 0.50 * mouthPucker
    );

    // Eyebrow raise extraction (Jump ability)
    const browInnerUp = b['browInnerUp'] || 0.0;
    const browOuterUpLeft = b['browOuterUpLeft'] || 0.0;
    const browOuterUpRight = b['browOuterUpRight'] || 0.0;
    const browRaw = Math.max(
      browInnerUp,
      (browOuterUpLeft + browOuterUpRight) * 0.5,
      browInnerUp * 0.65 + (browOuterUpLeft + browOuterUpRight) * 0.35
    );
    const browScore = Math.min(1.0, Math.max(0.0, browRaw / 0.38));
    const smoothBrow = this.browFilter.filter(browScore, now);

    let jumpTriggered = false;
    if (smoothBrow > 0.46 && this.browArmed && (now - this.lastJumpTime) > 0.85) {
      this.browArmed = false;
      this.lastJumpTime = now;
      jumpTriggered = true;
    } else if (smoothBrow < 0.28) {
      this.browArmed = true;
    }

    // Asymmetric Wink extraction (Shield + Nitro ability)
    const blinkL = b['eyeBlinkLeft'] || 0.0;
    const blinkR = b['eyeBlinkRight'] || 0.0;
    const isLeftWink = blinkL > 0.58 && blinkR < 0.30;
    const isRightWink = blinkR > 0.58 && blinkL < 0.30;
    let winkScore = 0.0;
    let shieldTriggered = false;
    if (isLeftWink || isRightWink) {
      winkScore = isLeftWink ? blinkL : blinkR;
      this.winkHoldFrames++;
      if (this.winkHoldFrames >= 2 && (now - this.lastShieldTime) > 2.5) {
        this.lastShieldTime = now;
        this.winkHoldFrames = 0;
        shieldTriggered = true;
      }
    } else {
      this.winkHoldFrames = 0;
    }

    // 2. Dynamic span normalization against calibration baselines
    const smileRange = Math.max(this.baselines.smileSpan, 0.12);
    const openRange = Math.max(this.baselines.openSpan, 0.12);

    let smileScore = Math.max(
      0.0,
      Math.min(1.0, (smileRaw - this.baselines.baseSmile) / smileRange)
    ) * this.smileSens;

    let openScore = Math.max(
      0.0,
      Math.min(1.0, (openRaw - this.baselines.baseOpen) / openRange)
    ) * this.openSens;

    // 3. Cross-suppression
    if (smileScore > 0.55) {
      openScore *= 0.40;
    } else if (openScore > 0.40) {
      smileScore *= 0.25;
    }

    // 4. One-Euro filter smoothing on expression scores
    const smoothSmile = this.smileFilter.filter(smileScore, now);
    const smoothOpen = this.openFilter.filter(openScore, now);

    // 5. Hysteresis shape switching state machine
    this.updateShapeHysteresis(smoothSmile, smoothOpen);

    // 6. Rock-Steady Roll-Compensated 2D Landmark Head Pose (Python Proven Parity)
    // In an unmirrored webcam feed:
    // When the user turns their head to their RIGHT, their nose moves toward camera LEFT (closer to cheek 234).
    // So distL decreases and distR increases.
    // (distR - distL) is POSITIVE, producing positive yawDeg that steers RIGHT (+X) matching user intent!
    let yawDeg = 0.0;
    let rollDeg = 0.0;

    if (landmarks && landmarks.length >= 455) {
      // 33: User's right eye (viewer's left in mirror)
      // 263: User's left eye (viewer's right in mirror)
      // 1: Nose tip
      // 234: User's right cheek (viewer's left)
      // 454: User's left cheek (viewer's right)
      const pLe = landmarks[33];
      const pRe = landmarks[263];
      const eyeDx = pRe.x - pLe.x;
      // In unmirrored camera, when tilting head to RIGHT shoulder, pLe drops (+Y) and pRe rises (-Y)
      const rollRad = Math.atan2(pLe.y - pRe.y, eyeDx);
      rollDeg = rollRad * (180.0 / Math.PI);

      const cosR = Math.cos(rollRad);
      const sinR = Math.sin(rollRad);
      const nose = landmarks[1];
      const cheekL = landmarks[234];
      const cheekR = landmarks[454];

      // Roll-compensated horizontal coordinates relative to nose
      const rxL = (cheekL.x - nose.x) * cosR - (cheekL.y - nose.y) * sinR;
      const rxR = (cheekR.x - nose.x) * cosR - (cheekR.y - nose.y) * sinR;

      const distL = Math.max(Math.abs(rxL), 0.005);
      const distR = Math.max(Math.abs(rxR), 0.005);

      // Positive yawDeg when turning head RIGHT:
      const yawRatio = (distR - distL) / (distL + distR);
      yawDeg = yawRatio * 38.0;
    } else if (matrix && matrix.length === 16) {
      // 3D Matrix Fallback with 180-degree wrap normalization
      yawDeg = Math.atan2(-matrix[8], Math.hypot(matrix[0], matrix[4])) * (180.0 / Math.PI);
      rollDeg = Math.atan2(matrix[4], matrix[0]) * (180.0 / Math.PI);
      if (rollDeg > 90.0) {
        rollDeg -= 180.0;
      } else if (rollDeg < -90.0) {
        rollDeg += 180.0;
      }
    }

    const diffYaw = (yawDeg - this.baselines.baseYaw) / 25.0;
    const diffRoll = (rollDeg - this.baselines.baseRoll) / 30.0;
    const rawSteer = (diffYaw * 0.70 + diffRoll * 0.30) * this.steerSens;

    const absSteer = Math.abs(rawSteer);

    // Adaptive center auto-trim: when head is resting near center, smoothly eliminate any micro-bias
    // This guarantees the car settles 100% DEAD CENTER when looking straight!
    if (absSteer <= this.deadzone) {
      this.baselines.baseYaw += (yawDeg - this.baselines.baseYaw) * 0.035;
      this.baselines.baseRoll += (rollDeg - this.baselines.baseRoll) * 0.035;
    }

    // 7. Deadzone application
    let targetSteer = 0.0;
    if (absSteer > this.deadzone) {
      const sign = rawSteer > 0 ? 1.0 : -1.0;
      targetSteer = sign * Math.min(1.0, (absSteer - this.deadzone) / (1.0 - this.deadzone));
    }

    // 8. One-Euro filter smoothing on steering
    let smoothSteer = this.steerFilter.filter(targetSteer, now);

    // 9. Center snapping & Deadzone zero-clamp
    // When targetSteer is 0 (head straight within deadzone), clamp to exact 0.0 and reset filter momentum
    if (targetSteer === 0.0) {
      smoothSteer = 0.0;
      this.steerFilter.reset();
    } else if (Math.abs(smoothSteer) < this.snapThreshold) {
      smoothSteer = 0.0;
    }

    // Output normalized steering scaled to [-0.82, 0.82]
    const steerNormX = Math.max(
      -this.maxSteerNormX,
      Math.min(this.maxSteerNormX, smoothSteer * this.maxSteerNormX)
    );

    return {
      steerNormX,
      activeShape: this.currentShape,
      smileRaw,
      openRaw,
      smileScore,
      openScore,
      smoothSmile,
      smoothOpen,
      browScore,
      smoothBrow,
      jumpTriggered,
      winkScore,
      shieldTriggered,
      yawDeg,
      rollDeg,
      rawSteer,
      targetSteer,
      smoothSteer,
      faceDetected: true,
    };
  }

  public updateShapeHysteresis(smile: number, openM: number): void {
    const enter = this.enterThresh;
    const exit = this.exitThresh;
    const margin = this.mutualMargin;

    if (this.currentShape === 'FLAT') {
      if (openM > enter && openM > smile + margin) {
        this.currentShape = 'NARROW';
      } else if (smile < exit) {
        this.currentShape = openM > enter ? 'NARROW' : 'NORMAL';
      }
    } else if (this.currentShape === 'NARROW') {
      if (smile > enter && smile > openM + margin) {
        this.currentShape = 'FLAT';
      } else if (openM < exit) {
        this.currentShape = smile > enter ? 'FLAT' : 'NORMAL';
      }
    } else {
      // NORMAL
      if (smile > enter && smile >= openM) {
        this.currentShape = 'FLAT';
      } else if (openM > enter) {
        this.currentShape = 'NARROW';
      }
    }
  }

  public getShape(): CarShapeKey {
    return this.currentShape;
  }

  public setShape(shape: CarShapeKey): void {
    this.currentShape = shape;
  }
}
