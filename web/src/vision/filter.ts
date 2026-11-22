/**
 * One-Euro Filter Implementation for High-Precision, Low-Latency Noise Reduction.
 * Ported with exact mathematical parity from Casiez et al. (CHI 2012) and Python reference.
 */

export interface FilterParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export const STEER_FILTER_CONFIG: FilterParams = {
  minCutoff: 0.8,
  beta: 0.04,
  dCutoff: 1.0,
};

export const SMILE_FILTER_CONFIG: FilterParams = {
  minCutoff: 1.8,
  beta: 0.25,
  dCutoff: 1.0,
};

export const OPEN_FILTER_CONFIG: FilterParams = {
  minCutoff: 1.8,
  beta: 0.25,
  dCutoff: 1.0,
};

export const POSE_FILTER_CONFIG: FilterParams = {
  minCutoff: 1.0,
  beta: 0.05,
  dCutoff: 1.0,
};

export class OneEuroFilter {
  public minCutoff: number;
  public beta: number;
  public dCutoff: number;

  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff: number = 1.0, beta: number = 0.05, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2.0 * Math.PI * Math.max(cutoff, 1e-5));
    return 1.0 / (1.0 + tau / Math.max(dt, 1e-5));
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  public filter(x: number, timestampSec?: number): number {
    const t = timestampSec !== undefined ? timestampSec : performance.now() / 1000.0;

    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = t;
      return x;
    }

    const dt = Math.max(t - this.tPrev, 1e-4);
    this.tPrev = t;

    // Filter derivative (velocity)
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1.0 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    // Dynamic cutoff frequency adaptation based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * x + (1.0 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  public getCurrentValue(): number | null {
    return this.xPrev;
  }
}
