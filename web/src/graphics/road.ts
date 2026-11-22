/**
 * 2.5D Retro Pseudo-3D Road & Environment Renderer.
 * Features mathematical perspective projection, dynamic curves,
 * synthwave sky gradients, parallax mountains, and 28 road segments.
 */

import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  HORIZON_Y,
  ROAD_BOTTOM_WIDTH,
  ROAD_TOP_WIDTH,
  NUM_LANES,
  MAX_Z,
} from '../config';
import { BiomeManager, toRgbString } from './biomes';

export interface ScreenCoord {
  x: number;
  y: number;
  scale: number;
}

export class RoadRenderer {
  public distance: number = 0.0;
  public distanceMeters: number = 0.0;
  public readonly segmentLength: number = 40.0;
  public readonly numSegments: number = 28;

  public currentCurve: number = 0.0;
  public targetCurve: number = 0.0;
  private curveTime: number = 0.0;

  public readonly biomeManager: BiomeManager;

  constructor() {
    this.biomeManager = new BiomeManager();
  }

  public reset(): void {
    this.distance = 0.0;
    this.distanceMeters = 0.0;
    this.currentCurve = 0.0;
    this.targetCurve = 0.0;
    this.curveTime = 0.0;
    this.biomeManager.reset();
  }

  public update(
    speed: number,
    dt: number,
    distanceMeters?: number
  ): { biomeName: string; biomeChanged: boolean } {
    this.distance += speed * dt;
    if (distanceMeters !== undefined) {
      this.distanceMeters = distanceMeters;
    } else {
      this.distanceMeters += (speed * dt) / 10.0;
    }

    const biomeResult = this.biomeManager.update(dt, this.distanceMeters);

    // Subtle sinusoidal curves with long straightaway plateaus
    this.curveTime += dt * (speed / 420.0);
    const rawWave =
      Math.sin(this.curveTime * 0.22) * 0.65 + Math.sin(this.curveTime * 0.11) * 0.35;
    if (Math.abs(rawWave) < 0.35) {
      this.targetCurve = 0.0;
    } else {
      this.targetCurve = Math.max(-0.32, Math.min(0.32, rawWave * 0.45));
    }
    this.currentCurve += (this.targetCurve - this.currentCurve) * Math.min(1.0, 1.2 * dt);

    return biomeResult;
  }

  /**
   * Perspective curve horizontal offset at normalized depth ratio p in [0, 1].
   */
  public curveDx(p: number): number {
    return this.currentCurve * Math.pow(1.0 - p, 2) * 130.0;
  }

  /**
   * Converts normalized road coordinates (X in [-1.0, 1.0], Z in [0, MAX_Z])
   * to 2D curved perspective screen coordinates.
   */
  public getScreenCoords(normalizedX: number, worldZ: number): ScreenCoord {
    const depth = Math.max(worldZ + 100.0, 1.0);
    const scale = 140.0 / depth;
    const rawP = Math.max(0.0, Math.min(1.0, 1.0 - worldZ / MAX_Z));
    const p = Math.pow(rawP, 2.2);

    const roadH = SCREEN_HEIGHT - HORIZON_Y;
    const screenY = HORIZON_Y + p * roadH;

    const roadW = ROAD_TOP_WIDTH + (ROAD_BOTTOM_WIDTH - ROAD_TOP_WIDTH) * p;
    const roadCenterX = SCREEN_WIDTH / 2.0 + this.curveDx(p);
    const screenX = roadCenterX + normalizedX * (roadW / 2.0);

    return { x: screenX, y: screenY, scale };
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const p = this.biomeManager.palette;
    const skyTopStr = toRgbString(p.sky_top);
    const skyBotStr = toRgbString(p.sky_bottom);
    const sunStr = toRgbString(p.sun);
    const sunGlowRgb = p.sun_glow;
    const mountainStr = toRgbString(p.mountain);
    const groundStr = toRgbString(p.ground);
    const asphaltAStr = toRgbString(p.asphalt_a);
    const asphaltBStr = toRgbString(p.asphalt_b);
    const curbLightStr = toRgbString(p.curb_light);
    const curbDarkStr = toRgbString(p.curb_dark);

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, skyTopStr);
    skyGrad.addColorStop(1, skyBotStr);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, SCREEN_WIDTH, HORIZON_Y);

    // 2. Parallax Synthwave Sun
    const horizonParallax = Math.floor(this.currentCurve * 55);
    const sunCenterX = Math.floor(SCREEN_WIDTH / 2.0) + horizonParallax;
    const sunCenterY = HORIZON_Y - 30;
    const sunRadius = 85;

    // Glowing halos
    for (let rOffset = 12; rOffset > 0; rOffset -= 3) {
      const alpha = 0.18 * (1.0 - rOffset / 12.0);
      ctx.fillStyle = toRgbString(sunGlowRgb, alpha);
      ctx.beginPath();
      ctx.arc(sunCenterX, sunCenterY, sunRadius + rOffset, 0, Math.PI * 2);
      ctx.fill();
    }

    // Solid sun circle
    ctx.fillStyle = sunStr;
    ctx.beginPath();
    ctx.arc(sunCenterX, sunCenterY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal cutout lines across lower portion of sun
    ctx.fillStyle = skyBotStr;
    for (let stripeY = sunCenterY - 10; stripeY < sunCenterY + sunRadius; stripeY += 14) {
      const thickness = Math.max(2, Math.floor((stripeY - (sunCenterY - 10)) / 10));
      ctx.fillRect(sunCenterX - sunRadius - 5, stripeY, sunRadius * 2 + 10, thickness);
    }

    // 3. Parallax Mountain Silhouettes (zero object allocation)
    const mShift = Math.floor(this.currentCurve * 35);
    ctx.fillStyle = mountainStr;
    ctx.beginPath();
    ctx.moveTo(-80, HORIZON_Y);
    ctx.lineTo(120 + mShift, HORIZON_Y - 48);
    ctx.lineTo(260 + mShift, HORIZON_Y - 22);
    ctx.lineTo(380 + mShift, HORIZON_Y - 64);
    ctx.lineTo(520 + mShift, HORIZON_Y - 18);
    ctx.lineTo(680 + mShift, HORIZON_Y - 74);
    ctx.lineTo(820 + mShift, HORIZON_Y - 32);
    ctx.lineTo(980 + mShift, HORIZON_Y - 68);
    ctx.lineTo(1140 + mShift, HORIZON_Y - 28);
    ctx.lineTo(SCREEN_WIDTH + 80, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // 4. Ground Background below horizon
    const roadHeight = SCREEN_HEIGHT - HORIZON_Y;
    ctx.fillStyle = groundStr;
    ctx.fillRect(0, HORIZON_Y, SCREEN_WIDTH, roadHeight);

    // 5. Curved Perspective Road Segments (drawn far-to-near: 28 down to 0)
    for (let i = this.numSegments; i >= 0; i--) {
      const p1 = Math.pow(i / this.numSegments, 2.2);
      const p2 = Math.pow((i + 1) / this.numSegments, 2.2);

      const y1 = Math.floor(HORIZON_Y + p1 * roadHeight);
      const y2 = Math.floor(HORIZON_Y + p2 * roadHeight);

      if (y2 <= y1 || y1 >= SCREEN_HEIGHT) {
        continue;
      }

      const w1 = ROAD_TOP_WIDTH + (ROAD_BOTTOM_WIDTH - ROAD_TOP_WIDTH) * p1;
      const w2 = ROAD_TOP_WIDTH + (ROAD_BOTTOM_WIDTH - ROAD_TOP_WIDTH) * p2;

      const cx1 = SCREEN_WIDTH / 2.0 + this.curveDx(p1);
      const cx2 = SCREEN_WIDTH / 2.0 + this.curveDx(p2);

      const x1L = Math.floor(cx1 - w1 / 2.0);
      const x1R = Math.floor(cx1 + w1 / 2.0);
      const x2L = Math.floor(cx2 - w2 / 2.0);
      const x2R = Math.floor(cx2 + w2 / 2.0);

      const worldZ = i * this.segmentLength + (this.distance % this.segmentLength);
      const isOdd = Math.floor(worldZ / this.segmentLength) % 2 === 1;

      // Asphalt polygon
      ctx.fillStyle = isOdd ? asphaltAStr : asphaltBStr;
      ctx.beginPath();
      ctx.moveTo(x1L, y1);
      ctx.lineTo(x1R, y1);
      ctx.lineTo(x2R, y2);
      ctx.lineTo(x2L, y2);
      ctx.closePath();
      ctx.fill();

      // Curbs (left and right)
      const curbW1 = Math.max(w1 * 0.05, 4);
      const curbW2 = Math.max(w2 * 0.05, 4);
      ctx.fillStyle = isOdd ? curbLightStr : curbDarkStr;

      // Left curb
      ctx.beginPath();
      ctx.moveTo(x1L - curbW1, y1);
      ctx.lineTo(x1L, y1);
      ctx.lineTo(x2L, y2);
      ctx.lineTo(x2L - curbW2, y2);
      ctx.closePath();
      ctx.fill();

      // Right curb
      ctx.beginPath();
      ctx.moveTo(x1R, y1);
      ctx.lineTo(x1R + curbW1, y1);
      ctx.lineTo(x2R + curbW2, y2);
      ctx.lineTo(x2R, y2);
      ctx.closePath();
      ctx.fill();

      // Dashed Lane Dividers (drawn on odd segments at 1/3 and 2/3 road width)
      if (isOdd) {
        const laneMarkW = Math.max(w1 * 0.012, 2);
        ctx.fillStyle = '#ffffff';

        for (let laneIdx = 1; laneIdx < NUM_LANES; laneIdx++) {
          const ratio = laneIdx / NUM_LANES;
          const lx1 = x1L + w1 * ratio;
          const lx2 = x2L + w2 * ratio;

          ctx.beginPath();
          ctx.moveTo(lx1 - laneMarkW, y1);
          ctx.lineTo(lx1 + laneMarkW, y1);
          ctx.lineTo(lx2 + laneMarkW, y2);
          ctx.lineTo(lx2 - laneMarkW, y2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}
