/**
 * Player Car Physics, Shape Morphing Tween, and State.
 */

import {
  CAR_SHAPES,
  CarShapeKey,
  RGBTuple,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  CAR_Z,
} from '../config';
import { RoadRenderer } from '../graphics/road';
import { ExhaustParticle } from '../graphics/particles';
import { renderCar, RenderableCar } from '../graphics/car_renderer';

export interface CarHitbox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class Car implements RenderableCar {
  public normX: number = 0.0;
  public targetNormX: number = 0.0;
  public steerVelocity: number = 0.0;

  public currentShapeKey: CarShapeKey = 'NORMAL';
  public w: number;
  public h: number;
  public targetW: number;
  public targetH: number;

  public screenX: number = SCREEN_WIDTH / 2.0;
  public screenY: number = SCREEN_HEIGHT - 65;
  public groundY: number = SCREEN_HEIGHT - 65;

  // Jump physics (Eyebrow Raise or Space / J)
  public jumpY: number = 0.0;
  public jumpVy: number = 0.0;
  public readonly jumpGravity: number = 1350.0;

  // Energy Shield & Nitro Boost (Wink or Shift / E)
  public shieldTimer: number = 0.0;
  public shieldCooldown: number = 0.0;
  public shieldPulse: number = 0.0;

  public colorPrimary: RGBTuple;
  public particles: ExhaustParticle[] = [];
  public wheelPhase: number = 0.0;
  public invulnerableTimer: number = 0.0;

  constructor(baseY?: number) {
    const cfg = CAR_SHAPES[this.currentShapeKey];
    this.w = cfg.width;
    this.h = cfg.height;
    this.targetW = this.w;
    this.targetH = this.h;
    if (baseY !== undefined) {
      this.screenY = baseY;
      this.groundY = baseY;
    }
    this.colorPrimary = [...cfg.color_primary];
  }

  public get lean(): number {
    return Math.max(-6.0, Math.min(6.0, this.steerVelocity * 1.8));
  }

  public get isAirborne(): boolean {
    return this.jumpY > 18.0;
  }

  public get isShielded(): boolean {
    return this.shieldTimer > 0.0;
  }

  public triggerJump(): boolean {
    if (this.jumpY <= 1.0) {
      this.jumpVy = 540.0;
      return true;
    }
    return false;
  }

  public activateShield(duration: number = 3.5, cooldown: number = 8.0): boolean {
    if (this.shieldTimer <= 0.0 && this.shieldCooldown <= 0.0) {
      this.shieldTimer = duration;
      this.shieldCooldown = cooldown;
      return true;
    }
    return false;
  }

  public reset(baseY?: number): void {
    this.normX = 0.0;
    this.targetNormX = 0.0;
    this.steerVelocity = 0.0;
    this.currentShapeKey = 'NORMAL';
    const cfg = CAR_SHAPES[this.currentShapeKey];
    this.w = cfg.width;
    this.h = cfg.height;
    this.targetW = this.w;
    this.targetH = this.h;
    this.screenX = SCREEN_WIDTH / 2.0;
    this.screenY = baseY !== undefined ? baseY : SCREEN_HEIGHT - 65;
    this.groundY = this.screenY;
    this.jumpY = 0.0;
    this.jumpVy = 0.0;
    this.shieldTimer = 0.0;
    this.shieldCooldown = 0.0;
    this.shieldPulse = 0.0;
    this.colorPrimary = [...cfg.color_primary];
    this.particles = [];
    this.wheelPhase = 0.0;
    this.invulnerableTimer = 0.0;
  }

  public setTargetSteer(targetNormX: number): void {
    this.targetNormX = Math.max(-0.82, Math.min(0.82, targetNormX));
  }

  public setShape(shapeKey: CarShapeKey): boolean {
    if (shapeKey in CAR_SHAPES && shapeKey !== this.currentShapeKey) {
      this.currentShapeKey = shapeKey;
      const cfg = CAR_SHAPES[shapeKey];
      this.targetW = cfg.width;
      this.targetH = cfg.height;
      return true;
    }
    return false;
  }

  public update(roadRenderer: RoadRenderer, dt: number): void {
    const prevX = this.normX;
    this.normX += (this.targetNormX - this.normX) * Math.min(1.0, 14.0 * dt);
    this.steerVelocity = (this.normX - prevX) / Math.max(dt, 0.0001);

    // Jump physics integration
    if (this.jumpY > 0.0 || this.jumpVy > 0.0) {
      this.jumpY += this.jumpVy * dt;
      this.jumpVy -= this.jumpGravity * dt;
      if (this.jumpY <= 0.0) {
        this.jumpY = 0.0;
        this.jumpVy = 0.0;
      }
    }

    // Shield & Nitro Boost timers
    if (this.shieldTimer > 0.0) {
      this.shieldTimer = Math.max(0.0, this.shieldTimer - dt);
      this.shieldPulse += 10.0 * dt;
    } else if (this.shieldCooldown > 0.0) {
      this.shieldCooldown = Math.max(0.0, this.shieldCooldown - dt);
    }

    const coords = roadRenderer.getScreenCoords(this.normX, CAR_Z);
    this.groundY = coords.y;
    this.screenX = coords.x;
    this.screenY = coords.y - this.jumpY;

    // Smooth shape tweening
    const morphSpeed = 18.0 * dt;
    this.w += (this.targetW - this.w) * Math.min(1.0, morphSpeed);
    this.h += (this.targetH - this.h) * Math.min(1.0, morphSpeed);

    // Smooth paint color transition
    const targetCol = CAR_SHAPES[this.currentShapeKey].color_primary;
    for (let c = 0; c < 3; c++) {
      this.colorPrimary[c] += (targetCol[c] - this.colorPrimary[c]) * Math.min(1.0, 10.0 * dt);
    }

    // Wheel tread animation
    this.wheelPhase = (this.wheelPhase + 25.0 * dt) % 8.0;

    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    // Twin exhaust flames (intense cyan/gold nitro flames when shielded!)
    const spawnProb = this.isShielded ? 0.95 : 0.70;
    if (Math.random() < spawnProb) {
      const pipeOffset = this.w * 0.24;
      const rearY = this.screenY - Math.max(4, this.h * 0.12);
      const flameColors: RGBTuple[] = this.isShielded
        ? [
            [0, 240, 255],
            [120, 255, 255],
            [255, 230, 80],
          ]
        : [
            [255, 160, 30],
            [80, 200, 255],
            [255, 90, 20],
          ];
      const flameCol = flameColors[Math.floor(Math.random() * flameColors.length)];
      this.particles.push(new ExhaustParticle(this.screenX - pipeOffset, rearY, flameCol));
      this.particles.push(new ExhaustParticle(this.screenX + pipeOffset, rearY, flameCol));
    }

    // In-place compaction eliminates GC spikes from particles at 60 FPS
    if (this.particles.length > 0) {
      let writeParticles = 0;
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].update()) {
          this.particles[writeParticles++] = this.particles[i];
        }
      }
      this.particles.length = writeParticles;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Invulnerability flashing strobe: 10 Hz
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 10) % 2 === 1) {
      return;
    }
    renderCar(ctx, this);
  }

  public getHitbox(): CarHitbox {
    return {
      left: Math.floor(this.screenX - this.w / 2.0),
      top: Math.floor(this.screenY - this.h),
      width: Math.floor(this.w),
      height: Math.floor(this.h),
    };
  }
}
