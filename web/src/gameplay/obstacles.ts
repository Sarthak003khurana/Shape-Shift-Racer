/**
 * Obstacle Classes, Collectible Coins, Combo Gauntlets & Obstacle Manager.
 * Ported with exact mathematical parity from Python reference implementation.
 */

import {
  MAX_Z,
  CAR_Z,
  LOW_BEAM_GAP_HEIGHT,
  PILLAR_GAP_WIDTH,
  LANE_X,
} from '../config';
import { RoadRenderer } from '../graphics/road';
import { Car } from './car';
import {
  checkLowBeamCollision,
  checkPillarGateCollision,
  checkRoadBlockCollision,
  checkLaserStripCollision,
  checkCoinCollection,
} from './collision';

let obstacleIdCounter = 1;

export class Coin {
  public id: number;
  public z: number;
  public normX: number;
  public elevation: number;
  public collected: boolean = false;
  public spinPhase: number;

  constructor(z: number, normX: number = 0.0, elevation: number = 14.0) {
    this.id = obstacleIdCounter++;
    this.z = z;
    this.normX = normX;
    this.elevation = elevation;
    this.spinPhase = Math.random() * Math.PI * 2.0;
  }

  public update(speed: number, dt: number): boolean {
    this.z -= speed * dt;
    this.spinPhase += 8.0 * dt;
    return this.z > -20.0 && !this.collected;
  }

  public checkCollect(car: Car): boolean {
    if (this.collected) return false;
    if (checkCoinCollection(this.z, this.normX, car)) {
      this.collected = true;
      return true;
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    if (this.z <= 0 || this.collected) return;

    const coords = roadRenderer.getScreenCoords(this.normX, this.z);
    const scale = coords.scale;
    const radius = Math.max(4, Math.floor(18 * scale));
    const spinW = Math.max(2, Math.floor(Math.abs(Math.cos(this.spinPhase)) * radius));
    const bob = Math.sin(this.spinPhase * 1.3) * 4.0 * scale;
    const coinY = Math.floor(coords.y - this.elevation * scale - radius + bob);
    const cx = Math.floor(coords.x);

    // Soft outer golden glow
    const glowR = radius + Math.max(2, Math.floor(6 * scale));
    ctx.fillStyle = 'rgba(255, 220, 40, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, coinY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Spinning coin ellipse
    ctx.fillStyle = 'rgb(255, 215, 0)';
    ctx.beginPath();
    ctx.ellipse(cx, coinY, spinW, radius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgb(255, 250, 180)';
    ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
    ctx.beginPath();
    ctx.ellipse(cx, coinY, spinW, radius, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (spinW > 4) {
      const innerW = Math.max(1, spinW - Math.max(2, Math.floor(spinW / 2)));
      const innerH = Math.max(1, radius - Math.max(3, Math.floor(radius / 2)));
      ctx.fillStyle = 'rgb(255, 165, 0)';
      ctx.beginPath();
      ctx.ellipse(cx, coinY, innerW, innerH, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export abstract class Obstacle {
  public id: number;
  public z: number;
  public normX: number;
  public passed: boolean = false;
  public collided: boolean = false;
  public nearMissAwarded: boolean = false;
  public abstract typeName: 'LowBeam' | 'PillarGate' | 'RoadBlock' | 'LaserStrip';

  constructor(z: number = MAX_Z, normX: number = 0.0) {
    this.id = obstacleIdCounter++;
    this.z = z;
    this.normX = normX;
  }

  public update(speed: number, dt: number): boolean {
    this.z -= speed * dt;
    return this.z > -25.0;
  }

  public abstract checkCollision(car: Car): boolean;
  public abstract checkNearMiss(car: Car): boolean;
  public abstract draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void;
}

export class LowBeam extends Obstacle {
  public typeName: 'LowBeam' = 'LowBeam';
  public readonly promptText = 'SLIDE FLAT (SMILE)';

  constructor(z: number = MAX_Z) {
    super(z, 0.0);
  }

  public checkCollision(car: Car): boolean {
    if (this.collided || this.passed) return false;
    const res = checkLowBeamCollision(this.z, car);
    if (res.collided) {
      this.collided = true;
      return true;
    }
    return false;
  }

  public checkNearMiss(car: Car): boolean {
    if (this.collided || this.nearMissAwarded) return false;
    const res = checkLowBeamCollision(this.z, car);
    if (res.nearMiss) {
      this.nearMissAwarded = true;
      return true;
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    if (this.z <= 0) return;

    const left = roadRenderer.getScreenCoords(-0.95, this.z);
    const right = roadRenderer.getScreenCoords(0.95, this.z);
    const center = roadRenderer.getScreenCoords(0.0, this.z);
    const scale = left.scale;

    const beamW = right.x - left.x;
    const beamH = Math.max(Math.floor(65 * scale), 8);
    const gapH = Math.max(Math.floor(LOW_BEAM_GAP_HEIGHT * 1.5 * scale), 4);

    const beamTop = Math.floor(left.y - gapH - beamH);
    const beamBottom = Math.floor(left.y - gapH);

    // Solid Horizontal Beam Bar
    ctx.fillStyle = 'rgb(220, 20, 60)';
    ctx.beginPath();
    ctx.roundRect(Math.floor(left.x), beamTop, Math.floor(beamW), beamH, 3);
    ctx.fill();

    ctx.strokeStyle = 'rgb(255, 230, 0)';
    ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
    ctx.beginPath();
    ctx.roundRect(Math.floor(left.x), beamTop, Math.floor(beamW), beamH, 3);
    ctx.stroke();

    // Diagonal hazard stripes
    const stripeStep = Math.max(Math.floor(24 * scale), 6);
    ctx.strokeStyle = 'rgb(40, 20, 30)';
    ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
    for (let sx = Math.floor(left.x); sx < Math.floor(right.x); sx += stripeStep) {
      ctx.beginPath();
      ctx.moveTo(sx, beamBottom);
      ctx.lineTo(Math.min(sx + Math.floor(stripeStep / 2), Math.floor(right.x)), beamTop);
      ctx.stroke();
    }

    // Side support pillars
    const pillarW = Math.max(Math.floor(16 * scale), 3);
    ctx.fillStyle = 'rgb(100, 100, 120)';
    ctx.fillRect(Math.floor(left.x) - pillarW, beamTop, pillarW, Math.floor(left.y - beamTop));
    ctx.fillRect(Math.floor(right.x), beamTop, pillarW, Math.floor(right.y - beamTop));

    // Prompt text
    if (scale > 0.45) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, Math.floor(18 * scale))}px Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.promptText, center.x, beamTop + beamH / 2);
    }
  }
}

export class PillarGate extends Obstacle {
  public typeName: 'PillarGate' = 'PillarGate';
  public promptText: string;

  constructor(z: number = MAX_Z, normX: number = 0.0) {
    super(z, normX);
    if (normX < -0.2) {
      this.promptText = 'LEFT SLIT (O-MOUTH)';
    } else if (normX > 0.2) {
      this.promptText = 'RIGHT SLIT (O-MOUTH)';
    } else {
      this.promptText = 'SQUEEZE (O-MOUTH)';
    }
  }

  public checkCollision(car: Car): boolean {
    if (this.collided || this.passed) return false;
    const res = checkPillarGateCollision(this.z, this.normX, car);
    if (res.collided) {
      this.collided = true;
      return true;
    }
    return false;
  }

  public checkNearMiss(car: Car): boolean {
    if (this.collided || this.nearMissAwarded) return false;
    const res = checkPillarGateCollision(this.z, this.normX, car);
    if (res.nearMiss) {
      this.nearMissAwarded = true;
      return true;
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    if (this.z <= 0) return;

    const center = roadRenderer.getScreenCoords(this.normX, this.z);
    const left = roadRenderer.getScreenCoords(-0.95, this.z);
    const right = roadRenderer.getScreenCoords(0.95, this.z);
    const scale = center.scale;

    const pillarH = Math.max(Math.floor(140 * scale), 16);
    const gapW = Math.max(Math.floor(PILLAR_GAP_WIDTH * 1.5 * scale), 8);
    const halfGap = gapW / 2.0;

    const cx = center.x;
    const cy = center.y;
    const lx = left.x;
    const rx = right.x;

    // Left Pillar
    const leftPillarW = Math.max(1, cx - halfGap - lx);
    ctx.fillStyle = 'rgb(30, 150, 215)';
    ctx.beginPath();
    ctx.roundRect(Math.floor(lx), Math.floor(cy - pillarH), Math.floor(leftPillarW), pillarH, 2);
    ctx.fill();

    ctx.strokeStyle = 'rgb(0, 255, 255)';
    ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
    ctx.beginPath();
    ctx.roundRect(Math.floor(lx), Math.floor(cy - pillarH), Math.floor(leftPillarW), pillarH, 2);
    ctx.stroke();

    // Right Pillar
    const rightPillarW = Math.max(1, rx - (cx + halfGap));
    ctx.fillStyle = 'rgb(30, 150, 215)';
    ctx.beginPath();
    ctx.roundRect(Math.floor(cx + halfGap), Math.floor(cy - pillarH), Math.floor(rightPillarW), pillarH, 2);
    ctx.fill();

    ctx.strokeStyle = 'rgb(0, 255, 255)';
    ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
    ctx.beginPath();
    ctx.roundRect(Math.floor(cx + halfGap), Math.floor(cy - pillarH), Math.floor(rightPillarW), pillarH, 2);
    ctx.stroke();

    // Top Crossbar
    const barH = Math.max(Math.floor(14 * scale), 3);
    ctx.fillStyle = 'rgb(20, 75, 140)';
    ctx.fillRect(Math.floor(lx), Math.floor(cy - pillarH), Math.floor(rx - lx), barH);

    // Neon floor slit edge markers
    ctx.strokeStyle = 'rgb(80, 255, 160)';
    ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
    ctx.beginPath();
    ctx.moveTo(Math.floor(cx - halfGap), Math.floor(cy));
    ctx.lineTo(Math.floor(cx - halfGap), Math.floor(cy - pillarH));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(Math.floor(cx + halfGap), Math.floor(cy));
    ctx.lineTo(Math.floor(cx + halfGap), Math.floor(cy - pillarH));
    ctx.stroke();

    // Prompt text
    if (scale > 0.45) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(11, Math.floor(16 * scale))}px Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.promptText, cx, Math.floor(cy - pillarH - 4));
    }
  }
}

export class RoadBlock extends Obstacle {
  public typeName: 'RoadBlock' = 'RoadBlock';
  public lanes: number[];

  constructor(z: number = MAX_Z, lanes?: number[]) {
    const chosenLanes = lanes ? [...lanes] : [Math.floor(Math.random() * 3)];
    const primaryX = LANE_X[chosenLanes[0]] ?? 0.0;
    super(z, primaryX);
    this.lanes = chosenLanes;
  }

  public checkCollision(car: Car): boolean {
    if (this.collided || this.passed) return false;
    const res = checkRoadBlockCollision(this.z, this.lanes, car);
    if (res.collided) {
      this.collided = true;
      return true;
    }
    return false;
  }

  public checkNearMiss(car: Car): boolean {
    if (this.collided || this.nearMissAwarded) return false;
    const res = checkRoadBlockCollision(this.z, this.lanes, car);
    if (res.nearMiss) {
      this.nearMissAwarded = true;
      return true;
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    if (this.z <= 0) return;

    for (const lane of this.lanes) {
      const lx = LANE_X[lane] ?? 0.0;
      const coords = roadRenderer.getScreenCoords(lx, this.z);
      const scale = coords.scale;
      const blockW = Math.max(Math.floor(110 * scale), 12);
      const blockH = Math.max(Math.floor(70 * scale), 8);
      const rx = Math.floor(coords.x - blockW / 2.0);
      const ry = Math.floor(coords.y - blockH);

      // Barricade block
      ctx.fillStyle = 'rgb(240, 115, 0)';
      ctx.beginPath();
      ctx.roundRect(rx, ry, blockW, blockH, 3);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, Math.floor(2 * scale));
      ctx.beginPath();
      ctx.roundRect(rx, ry, blockW, blockH, 3);
      ctx.stroke();

      // Diagonal hazard X stripes
      ctx.strokeStyle = 'rgb(40, 20, 10)';
      ctx.lineWidth = Math.max(1, Math.floor(3 * scale));
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + blockW, ry + blockH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rx + blockW, ry);
      ctx.lineTo(rx, ry + blockH);
      ctx.stroke();

      // Prompt text
      if (scale > 0.45) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.floor(15 * scale))}px Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('! STEER !', coords.x, ry - 2);
      }
    }
  }
}

export class LaserStrip extends Obstacle {
  public typeName: 'LaserStrip' = 'LaserStrip';
  public readonly promptText = 'JUMP (RAISE BROWS)';

  constructor(z: number = MAX_Z) {
    super(z, 0.0);
  }

  public checkCollision(car: Car): boolean {
    if (this.collided || this.passed) return false;
    const res = checkLaserStripCollision(this.z, car);
    if (res.collided) {
      this.collided = true;
      return true;
    }
    return false;
  }

  public checkNearMiss(car: Car): boolean {
    if (this.collided || this.nearMissAwarded) return false;
    const res = checkLaserStripCollision(this.z, car);
    if (res.nearMiss) {
      this.nearMissAwarded = true;
      return true;
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    if (this.z <= 0) return;

    const left = roadRenderer.getScreenCoords(-0.95, this.z);
    const right = roadRenderer.getScreenCoords(0.95, this.z);
    const center = roadRenderer.getScreenCoords(0.0, this.z);
    const scale = center.scale;

    const stripH = Math.max(Math.floor(18 * scale), 4);
    const stripW = Math.max(4, Math.floor(right.x - left.x));
    const topY = Math.floor(left.y - stripH);
    const lx = Math.floor(left.x);
    const rx = Math.floor(right.x);

    // Glowing plasma laser aura along asphalt
    ctx.fillStyle = 'rgba(255, 40, 20, 0.35)';
    ctx.beginPath();
    ctx.roundRect(lx - 5, topY - 4, stripW + 10, stripH + 8, 4);
    ctx.fill();

    // Red outer laser beam
    ctx.fillStyle = 'rgb(255, 40, 40)';
    ctx.beginPath();
    ctx.roundRect(lx, topY, stripW, stripH, 3);
    ctx.fill();

    // Hot golden-white laser core
    const coreH = Math.max(2, Math.floor(stripH / 3));
    ctx.fillStyle = 'rgb(255, 240, 140)';
    ctx.fillRect(lx + 2, Math.floor(topY + (stripH - coreH) / 2), Math.max(2, stripW - 4), coreH);

    // Side emitter pylons
    const pylonW = Math.max(Math.floor(14 * scale), 3);
    const pylonH = Math.max(Math.floor(26 * scale), 6);
    ctx.fillStyle = 'rgb(90, 95, 115)';
    ctx.fillRect(lx - pylonW, Math.floor(left.y - pylonH), pylonW, pylonH);
    ctx.fillRect(rx, Math.floor(right.y - pylonH), pylonW, pylonH);

    // Metallic highlight on pylons
    ctx.fillStyle = 'rgb(140, 150, 175)';
    ctx.fillRect(lx - pylonW + 1, Math.floor(left.y - pylonH + 1), Math.max(1, pylonW - 2), 2);
    ctx.fillRect(rx + 1, Math.floor(right.y - pylonH + 1), Math.max(1, pylonW - 2), 2);

    // Prompt text
    if (scale > 0.45) {
      ctx.fillStyle = '#fff582';
      ctx.font = `bold ${Math.max(11, Math.floor(16 * scale))}px Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.promptText, center.x, topY - 4);
    }
  }
}

export interface ObstacleEvents {
  obstaclesPassed: number;
  coinsCollected: number;
  nearMisses: number;
  collision: boolean;
  gauntletStarted: boolean;
  coinScreenPositions: [number, number][];
}

export class ObstacleManager {
  public obstacles: Obstacle[] = [];
  public coins: Coin[] = [];
  public spawnTimer: number = 0.0;
  public obstaclesSpawned: number = 0;
  public gauntletQueue: [number, { kind: string; param?: number | number[] }][] = [];

  public update(
    speed: number,
    dt: number,
    car: Car,
    roadRenderer: RoadRenderer
  ): ObstacleEvents {
    const events: ObstacleEvents = {
      obstaclesPassed: 0,
      coinsCollected: 0,
      nearMisses: 0,
      collision: false,
      gauntletStarted: false,
      coinScreenPositions: [],
    };

    // 1. Update Obstacles
    for (const obs of this.obstacles) {
      obs.update(speed, dt);

      if (obs.checkCollision(car)) {
        events.collision = true;
      }

      if (!obs.passed && obs.z < CAR_Z - 15.0 && !obs.collided) {
        obs.passed = true;
        events.obstaclesPassed += 1;
        if (obs.checkNearMiss(car)) {
          events.nearMisses += 1;
        }
      }
    }

    // In-place compaction for zero GC allocation during 60 FPS gameplay
    let writeObs = 0;
    for (let i = 0; i < this.obstacles.length; i++) {
      if (this.obstacles[i].z > -25.0) {
        this.obstacles[writeObs++] = this.obstacles[i];
      }
    }
    this.obstacles.length = writeObs;

    // 2. Update Coins
    for (const coin of this.coins) {
      coin.update(speed, dt);
      if (coin.checkCollect(car)) {
        events.coinsCollected += 1;
        const coords = roadRenderer.getScreenCoords(coin.normX, CAR_Z);
        events.coinScreenPositions.push([coords.x, coords.y - 35]);
      }
    }

    let writeCoins = 0;
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.z > -20.0 && !c.collected) {
        this.coins[writeCoins++] = c;
      }
    }
    this.coins.length = writeCoins;

    // 3. Spawning
    this.spawnTimer += dt;
    if (this.gauntletQueue.length > 0) {
      const [nextDelay, spec] = this.gauntletQueue[0];
      if (this.spawnTimer >= nextDelay) {
        this.spawnTimer = 0.0;
        this.gauntletQueue.shift();
        this.spawnFromSpec(spec);
      }
    } else {
      const spawnThreshold = Math.max(1.35, 2.45 - speed / 1050.0);
      if (this.spawnTimer >= spawnThreshold) {
        this.spawnTimer = 0.0;
        if (this.obstaclesSpawned >= 5 && Math.random() < 0.24) {
          this.queueGauntletWave(speed);
          events.gauntletStarted = true;
        } else {
          this.spawnRandomObstacle();
        }
      }
    }

    return events;
  }

  private queueGauntletWave(speed: number): void {
    const gapTime = Math.max(1.15, 1.65 - speed / 1600.0);
    const shiftedGateX = Math.random() < 0.5 ? -0.42 : 0.42;

    const patterns: { kind: string; param?: number | number[] }[][] = [
      [
        { kind: 'LOW_BEAM' },
        { kind: 'PILLAR_GATE', param: 0.0 },
        { kind: 'LASER_STRIP' },
      ],
      [
        { kind: 'ROAD_BLOCK_DOUBLE' },
        { kind: 'LOW_BEAM' },
        { kind: 'PILLAR_GATE', param: shiftedGateX },
      ],
      [
        { kind: 'LASER_STRIP' },
        { kind: 'LOW_BEAM' },
        { kind: 'ROAD_BLOCK_SINGLE' },
      ],
    ];

    const chosen = patterns[Math.floor(Math.random() * patterns.length)];
    this.spawnFromSpec(chosen[0]);
    for (let i = 1; i < chosen.length; i++) {
      this.gauntletQueue.push([gapTime, chosen[i]]);
    }
  }

  private spawnFromSpec(spec: { kind: string; param?: number | number[] }): void {
    this.obstaclesSpawned++;

    if (spec.kind === 'LOW_BEAM') {
      this.obstacles.push(new LowBeam(MAX_Z));
      const coinPositions = [-0.35, 0.0, 0.35];
      const coinX = coinPositions[Math.floor(Math.random() * coinPositions.length)];
      this.coins.push(new Coin(MAX_Z - 35.0, coinX, 8.0));
    } else if (spec.kind === 'PILLAR_GATE') {
      const gateX = typeof spec.param === 'number' ? spec.param : 0.0;
      this.obstacles.push(new PillarGate(MAX_Z, gateX));
      this.coins.push(new Coin(MAX_Z - 35.0, gateX, 22.0));
    } else if (spec.kind === 'LASER_STRIP') {
      this.obstacles.push(new LaserStrip(MAX_Z));
      // High floating coin above the laser strip for mid-air grabs!
      this.coins.push(new Coin(MAX_Z - 20.0, 0.0, 64.0));
    } else if (spec.kind === 'ROAD_BLOCK_SINGLE') {
      const blocked = Math.floor(Math.random() * 3);
      this.obstacles.push(new RoadBlock(MAX_Z, [blocked]));
      const openLanes = [0, 1, 2].filter((l) => l !== blocked);
      const chosenLane = openLanes[Math.floor(Math.random() * openLanes.length)];
      this.coins.push(new Coin(MAX_Z - 30.0, LANE_X[chosenLane] ?? 0.0, 18.0));
    } else if (spec.kind === 'ROAD_BLOCK_DOUBLE') {
      const openLane = Math.floor(Math.random() * 3);
      const blocked = [0, 1, 2].filter((l) => l !== openLane);
      this.obstacles.push(new RoadBlock(MAX_Z, blocked));
      this.coins.push(new Coin(MAX_Z - 30.0, LANE_X[openLane] ?? 0.0, 18.0));
    }
  }

  private spawnRandomObstacle(): void {
    if (this.obstaclesSpawned < 4) {
      const choices = [
        { kind: 'LOW_BEAM' },
        { kind: 'PILLAR_GATE', param: 0.0 },
        { kind: 'ROAD_BLOCK_SINGLE' },
        { kind: 'LASER_STRIP' },
      ];
      this.spawnFromSpec(choices[Math.floor(Math.random() * choices.length)]);
    } else {
      const shiftedGateX = Math.random() < 0.5 ? -0.42 : 0.42;
      const choices = [
        { kind: 'LOW_BEAM' },
        { kind: 'PILLAR_GATE', param: 0.0 },
        { kind: 'PILLAR_GATE', param: shiftedGateX },
        { kind: 'LASER_STRIP' },
        { kind: 'ROAD_BLOCK_SINGLE' },
        { kind: 'ROAD_BLOCK_DOUBLE' },
      ];
      this.spawnFromSpec(choices[Math.floor(Math.random() * choices.length)]);
    }
  }

  public render(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer): void {
    // Sort all obstacles and coins descending by Z (painter's algorithm)
    type Renderable = { z: number; draw: (c: CanvasRenderingContext2D, r: RoadRenderer) => void };
    const items: Renderable[] = [
      ...this.obstacles.map((o) => ({ z: o.z, draw: (c: CanvasRenderingContext2D, r: RoadRenderer) => o.draw(c, r) })),
      ...this.coins.map((coin) => ({ z: coin.z, draw: (c: CanvasRenderingContext2D, r: RoadRenderer) => coin.draw(c, r) })),
    ];

    items.sort((a, b) => b.z - a.z);

    for (const item of items) {
      item.draw(ctx, roadRenderer);
    }
  }

  public reset(): void {
    this.obstacles = [];
    this.coins = [];
    this.gauntletQueue = [];
    this.spawnTimer = 0.0;
    this.obstaclesSpawned = 0;
  }
}
