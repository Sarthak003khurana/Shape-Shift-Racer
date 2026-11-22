/**
 * Facial Expression & Head Pose Calibration System.
 * Supports:
 *  1. Fast 1-Step Auto-Zero on camera startup (10 frames median baseline).
 *  2. Full 3-Step Interactive Wizard in Pause Menu (Neutral 2.2s -> Smile 2.2s -> Open 2.2s).
 */

import { CalibrationBaselines, DEFAULT_BASELINES } from './processor';

const CALIBRATION_STORAGE_KEY = 'ssr_vision_calibration';

export type CalibrationStep = 'IDLE' | 'NEUTRAL' | 'SMILE' | 'OPEN' | 'COMPLETE';

export interface CalibrationCallbacks {
  onStepStart?: (step: CalibrationStep, prompt: string) => void;
  onStepProgress?: (step: CalibrationStep, remainingSec: number) => void;
  onStepComplete?: (step: CalibrationStep) => void;
  onFinished?: (baselines: CalibrationBaselines) => void;
  onCancel?: () => void;
}

export interface FrameSample {
  smileRaw: number;
  openRaw: number;
  yawDeg: number;
  rollDeg: number;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;
}

function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    Math.max(0, Math.floor((percentile / 100.0) * (sorted.length - 1))),
    sorted.length - 1
  );
  return sorted[index];
}

export class CalibrationManager {
  private currentStep: CalibrationStep = 'IDLE';
  private stepTimer: number = 0;
  private readonly stepDuration: number = 2.2; // 2.2 seconds per step

  // Sample collection
  private neutralSamples: FrameSample[] = [];
  private smileSamples: number[] = [];
  private openSamples: number[] = [];

  // Fast auto-zero tracking
  private fastAutoZeroCount: number = 0;
  private fastAutoZeroTarget: number = 10;
  private fastAutoZeroSamples: FrameSample[] = [];
  private isAutoZeroDone: boolean = false;

  private callbacks: CalibrationCallbacks = {};
  private baselines: CalibrationBaselines = { ...DEFAULT_BASELINES };

  constructor() {
    this.loadSavedCalibration();
  }

  public setCallbacks(callbacks: CalibrationCallbacks): void {
    this.callbacks = callbacks;
  }

  public getBaselines(): CalibrationBaselines {
    return { ...this.baselines };
  }

  public isCalibrating(): boolean {
    return this.currentStep !== 'IDLE' && this.currentStep !== 'COMPLETE';
  }

  public getCurrentStep(): CalibrationStep {
    return this.currentStep;
  }

  public getRemainingTime(): number {
    return Math.max(0.0, this.stepTimer);
  }

  /**
   * Fast 1-step auto-zero calibration on camera start.
   * Feeds the first 10 frames to compute neutral resting baseline.
   */
  public feedAutoZeroFrame(sample: FrameSample): boolean {
    if (this.isAutoZeroDone) return true;

    this.fastAutoZeroSamples.push(sample);
    this.fastAutoZeroCount++;

    if (this.fastAutoZeroCount >= this.fastAutoZeroTarget) {
      const smiles = this.fastAutoZeroSamples.map((s) => s.smileRaw);
      const opens = this.fastAutoZeroSamples.map((s) => s.openRaw);
      const yaws = this.fastAutoZeroSamples.map((s) => s.yawDeg);
      const rolls = this.fastAutoZeroSamples.map((s) => s.rollDeg);

      this.baselines.baseSmile = Math.max(0.02, computeMedian(smiles));
      this.baselines.baseOpen = Math.max(0.02, computeMedian(opens));
      this.baselines.baseYaw = computeMedian(yaws);
      this.baselines.baseRoll = computeMedian(rolls);
      this.isAutoZeroDone = true;

      this.saveCalibration();
      if (this.callbacks.onFinished) {
        this.callbacks.onFinished(this.baselines);
      }
      return true;
    }
    return false;
  }

  public resetAutoZero(): void {
    this.isAutoZeroDone = false;
    this.fastAutoZeroCount = 0;
    this.fastAutoZeroSamples = [];
  }

  /**
   * Start 3-step interactive calibration wizard.
   */
  public startInteractiveCalibration(): void {
    this.neutralSamples = [];
    this.smileSamples = [];
    this.openSamples = [];
    this.goToStep('NEUTRAL');
  }

  public cancelInteractiveCalibration(): void {
    this.currentStep = 'IDLE';
    this.stepTimer = 0;
    this.neutralSamples = [];
    this.smileSamples = [];
    this.openSamples = [];
    if (this.callbacks.onCancel) {
      this.callbacks.onCancel();
    }
  }

  private goToStep(step: CalibrationStep): void {
    this.currentStep = step;
    this.stepTimer = this.stepDuration;

    let prompt = '';
    if (step === 'NEUTRAL') {
      prompt = 'Look straight at the screen with a relaxed neutral face.';
    } else if (step === 'SMILE') {
      prompt = 'Show a wide natural smile (activates LOW-RIDER Flat mode)!';
    } else if (step === 'OPEN') {
      prompt = 'Open your mouth slightly (activates SLIM-BLADE Narrow mode)!';
    }

    if (this.callbacks.onStepStart) {
      this.callbacks.onStepStart(step, prompt);
    }
  }

  public update(dt: number, currentSample: FrameSample | null): void {
    if (!this.isCalibrating()) return;

    if (currentSample) {
      if (this.currentStep === 'NEUTRAL') {
        this.neutralSamples.push(currentSample);
      } else if (this.currentStep === 'SMILE') {
        this.smileSamples.push(currentSample.smileRaw);
      } else if (this.currentStep === 'OPEN') {
        this.openSamples.push(currentSample.openRaw);
      }
    }

    this.stepTimer -= dt;

    if (this.callbacks.onStepProgress) {
      this.callbacks.onStepProgress(this.currentStep, Math.max(0.0, this.stepTimer));
    }

    if (this.stepTimer <= 0) {
      // Step completed
      const finishedStep = this.currentStep;
      if (this.callbacks.onStepComplete) {
        this.callbacks.onStepComplete(finishedStep);
      }

      if (finishedStep === 'NEUTRAL') {
        if (this.neutralSamples.length > 0) {
          this.baselines.baseSmile = Math.max(
            0.02,
            computeMedian(this.neutralSamples.map((s) => s.smileRaw))
          );
          this.baselines.baseOpen = Math.max(
            0.02,
            computeMedian(this.neutralSamples.map((s) => s.openRaw))
          );
          this.baselines.baseYaw = computeMedian(this.neutralSamples.map((s) => s.yawDeg));
          this.baselines.baseRoll = computeMedian(this.neutralSamples.map((s) => s.rollDeg));
        }
        this.goToStep('SMILE');
      } else if (finishedStep === 'SMILE') {
        if (this.smileSamples.length > 0) {
          const peakSmile = computePercentile(this.smileSamples, 85);
          const rawSpan = (peakSmile - this.baselines.baseSmile) * 0.85;
          this.baselines.smileSpan = Math.max(0.12, Math.min(0.45, rawSpan));
        }
        this.goToStep('OPEN');
      } else if (finishedStep === 'OPEN') {
        if (this.openSamples.length > 0) {
          const peakOpen = computePercentile(this.openSamples, 85);
          const rawSpan = (peakOpen - this.baselines.baseOpen) * 0.78;
          this.baselines.openSpan = Math.max(0.12, Math.min(0.45, rawSpan));
        }
        this.currentStep = 'COMPLETE';
        this.saveCalibration();

        if (this.callbacks.onFinished) {
          this.callbacks.onFinished(this.baselines);
        }
      }
    }
  }

  private saveCalibration(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(this.baselines));
      }
    } catch (e) {
      console.warn('[Calibration] Failed to persist baselines:', e);
    }
  }

  private loadSavedCalibration(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'object' && parsed !== null) {
            this.baselines = { ...DEFAULT_BASELINES, ...parsed };
            // Sanitize against corrupted legacy 180-degree matrix roll
            if (Math.abs(this.baselines.baseRoll) > 45.0) {
              this.baselines.baseRoll = 0.0;
            }
            if (Math.abs(this.baselines.baseYaw) > 45.0) {
              this.baselines.baseYaw = 0.0;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Calibration] Failed to load saved baselines:', e);
    }
  }
}
