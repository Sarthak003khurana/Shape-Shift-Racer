/**
 * Particle & Floating Popup Systems:
 * Exhaust flames, collision debris, golden coin sparkles, and rising notifications.
 */

import { RGBTuple } from '../config';
import { toRgbString } from './biomes';

export class ExhaustParticle {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public color: RGBTuple;
  public life: number = 1.0;
  public decay: number;
  public size: number;

  constructor(x: number, y: number, color: RGBTuple) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 1.6;
    this.vy = 3.0 + Math.random() * 3.5;
    this.color = color;
    this.decay = 0.06 + Math.random() * 0.05;
    this.size = 2.5 + Math.random() * 3.0;
  }

  public update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.size = Math.max(0.5, this.size - 0.15);
    return this.life > 0;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.0, this.life) * 0.86;
    const r = Math.max(1, this.size);
    ctx.fillStyle = toRgbString(this.color, alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class SparkParticle {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public color: RGBTuple;
  public life: number = 1.0;
  public size: number;

  constructor(x: number, y: number, palette?: RGBTuple[], upward: boolean = false) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 11.0;
    this.vy = upward ? -(1.5 + Math.random() * 6.0) : -(3.0 + Math.random() * 5.0) + Math.random() * 3.0;

    const colors: RGBTuple[] = palette || [
      [255, 230, 0],
      [255, 60, 40],
      [255, 255, 255],
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.size = 3.0 + Math.random() * 3.5;
  }

  public update(dt: number): boolean {
    this.x += this.vx * 60.0 * dt;
    this.y += this.vy * 60.0 * dt;
    this.vy += 12.0 * dt;
    this.life -= 1.8 * dt;
    return this.life > 0;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.0, this.life);
    const r = Math.max(1, this.size);
    ctx.fillStyle = toRgbString(this.color, alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class FloatingPopup {
  public text: string;
  public x: number;
  public y: number;
  public color: string;
  public size: number;
  public life: number;
  public maxLife: number;

  constructor(
    text: string,
    x: number,
    y: number,
    color: string = '#ffe600',
    size: number = 26,
    duration: number = 1.2
  ) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.life = duration;
    this.maxLife = duration;
  }

  public update(dt: number): boolean {
    this.y -= 48.0 * dt;
    this.life -= dt;
    return this.life > 0;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0.0, Math.min(1.0, this.life / Math.max(this.maxLife * 0.5, 0.01)));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${this.size}px Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Drop shadow
    ctx.fillStyle = '#0a0814';
    ctx.fillText(this.text, this.x + 2, this.y + 2);

    // Text foreground
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
