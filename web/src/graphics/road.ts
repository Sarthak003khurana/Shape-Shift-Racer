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

  public screenWidth: number = SCREEN_WIDTH;
  public screenHeight: number = SCREEN_HEIGHT;
  public horizonY: number = HORIZON_Y;
  public roadHeight: number = SCREEN_HEIGHT - HORIZON_Y;
  public roadBottomWidth: number = ROAD_BOTTOM_WIDTH;
  public roadTopWidth: number = ROAD_TOP_WIDTH;

  public readonly biomeManager: BiomeManager;

  constructor() {
    this.biomeManager = new BiomeManager();
  }

  public setDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (width < height) {
      // Mobile vertical portrait mode (e.g. 720 x 1280)
      this.horizonY = Math.floor(height * 0.36); // ~460px
      this.roadHeight = Math.floor(height * 0.58); // ~742px (reaches down to ~1202px)
      this.roadBottomWidth = Math.floor(width * 0.88); // ~634px
      this.roadTopWidth = Math.floor(width * 0.16); // ~115px
    } else {
      // Desktop / landscape mode (1280 x 720)
      this.horizonY = HORIZON_Y;
      this.roadHeight = SCREEN_HEIGHT - HORIZON_Y;
      this.roadBottomWidth = ROAD_BOTTOM_WIDTH;
      this.roadTopWidth = ROAD_TOP_WIDTH;
    }
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

    const screenY = this.horizonY + p * this.roadHeight;

    const roadW = this.roadTopWidth + (this.roadBottomWidth - this.roadTopWidth) * p;
    const roadCenterX = this.screenWidth / 2.0 + this.curveDx(p);
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
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.horizonY);
    skyGrad.addColorStop(0, skyTopStr);
    skyGrad.addColorStop(1, skyBotStr);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.screenWidth, this.horizonY);

    // 2. Parallax Synthwave Sun
    const horizonParallax = Math.floor(this.currentCurve * 55);
    const sunCenterX = Math.floor(this.screenWidth / 2.0) + horizonParallax;
    const sunCenterY = this.horizonY - 30;
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
    const w = this.screenWidth;
    const hy = this.horizonY;
    ctx.fillStyle = mountainStr;
    ctx.beginPath();
    ctx.moveTo(-80, hy);
    ctx.lineTo(w * 0.10 + mShift, hy - 48);
    ctx.lineTo(w * 0.22 + mShift, hy - 22);
    ctx.lineTo(w * 0.32 + mShift, hy - 64);
    ctx.lineTo(w * 0.44 + mShift, hy - 18);
    ctx.lineTo(w * 0.58 + mShift, hy - 74);
    ctx.lineTo(w * 0.70 + mShift, hy - 32);
    ctx.lineTo(w * 0.82 + mShift, hy - 68);
    ctx.lineTo(w * 0.94 + mShift, hy - 28);
    ctx.lineTo(w + 80, hy);
    ctx.closePath();
    ctx.fill();

    // 4. Ground Background below horizon
    ctx.fillStyle = groundStr;
    ctx.fillRect(0, hy, this.screenWidth, this.screenHeight - hy);

    // 5. Curved Perspective Road Segments (drawn far-to-near: 28 down to 0)
    for (let i = this.numSegments; i >= 0; i--) {
      const p1 = Math.pow(i / this.numSegments, 2.2);
      const p2 = Math.pow((i + 1) / this.numSegments, 2.2);

      const y1 = Math.floor(hy + p1 * this.roadHeight);
      const y2 = Math.floor(hy + p2 * this.roadHeight);

      if (y2 <= y1 || y1 >= this.screenHeight) {
        continue;
      }

      const w1 = this.roadTopWidth + (this.roadBottomWidth - this.roadTopWidth) * p1;
      const w2 = this.roadTopWidth + (this.roadBottomWidth - this.roadTopWidth) * p2;

      const cx1 = this.screenWidth / 2.0 + this.curveDx(p1);
      const cx2 = this.screenWidth / 2.0 + this.curveDx(p2);

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
