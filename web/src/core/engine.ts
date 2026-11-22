/**
 * Shape-Shift Racer Core Game Engine.
 * Manages 60 FPS requestAnimationFrame loop, clamped delta time, state transitions,
 * collision responses, scoring, particle systems, and rendering orchestration.
 */

import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  BASE_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  OBSTACLE_BASE_POINTS,
  COIN_BASE_POINTS,
  NEAR_MISS_BONUS,
  getMultiplierForStreak,
} from '../config';
import { RoadRenderer } from '../graphics/road';
import { Car } from '../gameplay/car';
import { ObstacleManager } from '../gameplay/obstacles';
import { ControlsManager } from '../input/controls';
import { createStateMachine, GameStateMachine } from './state';
import { loadHighScores, saveHighScore, HighScoreEntry } from './storage';
import { SparkParticle, FloatingPopup } from '../graphics/particles';
import { WebAudioManager } from '../audio/audio_manager';
import { VisionManager } from '../vision/vision_manager';
import { PauseMenuUI } from '../ui/pause_menu';
import {
  renderHUD,
  renderStartOverlay,
  renderPauseOverlay,
  renderGameOverOverlay,
} from '../ui/hud';

// Mobile Performance Tuning: In-place array compaction eliminates GC spikes at 60 FPS
function compactArray<T>(arr: T[], predicate: (item: T) => boolean): void {
  if (arr.length === 0) return;
  let writeIdx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      arr[writeIdx++] = arr[i];
    }
  }
  arr.length = writeIdx;
}

export class GameEngine {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  public readonly road: RoadRenderer;
  public readonly car: Car;
  public readonly obstacles: ObstacleManager;
  public readonly controls: ControlsManager;
  public readonly stateMachine: GameStateMachine;
  public readonly audio: WebAudioManager;
  public readonly vision: VisionManager;
  public readonly pauseMenu: PauseMenuUI;

  // Particle & popup entities
  public sparks: SparkParticle[] = [];
  public popups: FloatingPopup[] = [];

  // Gameplay metrics
  public score: number = 0;
  public distance: number = 0.0;
  public speed: number = BASE_SPEED;
  public coins: number = 0;
  public lives: number = 3;
  public streak: number = 0;
  public maxStreak: number = 0;
  public multiplier: number = 1;

  // High score tracking
  public highScores: HighScoreEntry[] = [];
  public highScore: number = 0;
  public isNewRecord: boolean = false;

  // Visual timers
  public screenShakeTimer: number = 0.0;
  public screenFlashTimer: number = 0.0;
  public invulnerableTimer: number = 0.0;
  public gameOverCooldown: number = 0.0;

  // Viewport dimensions (dynamic for mobile portrait vs desktop widescreen)
  public screenWidth: number = SCREEN_WIDTH;
  public screenHeight: number = SCREEN_HEIGHT;

  // Loop control
  private lastFrameTime: number = 0;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to obtain 2D rendering context');
    }
    this.ctx = context;

    this.road = new RoadRenderer();
    this.car = new Car();
    this.obstacles = new ObstacleManager();
    this.controls = new ControlsManager();
    this.stateMachine = createStateMachine('START');
    this.audio = new WebAudioManager();
    this.vision = new VisionManager();
    this.pauseMenu = new PauseMenuUI();

    this.highScores = loadHighScores();
    this.highScore = this.highScores.length > 0 ? this.highScores[0].score : 0;
  }

  public setDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.road.setDimensions(width, height);
    this.car.setDimensions(width, height);
  }

  public init(): void {
    this.controls.init();
    this.audio.init().catch((err) => console.warn('[AudioManager] Failed to init:', err));

    const container =
      (document.getElementById('game-container') as HTMLElement) ||
      this.canvas.parentElement ||
      document.body;
    this.vision.init(container);
    this.vision.setAudioChimeCallback((chime) => this.audio.playSfx(chime));

    this.pauseMenu.mount(container, this.vision, this.audio, {
      onResume: () => {
        this.audio.unlock();
        this.pauseMenu.hide();
        this.stateMachine.transition('PLAYING');
        this.audio.startMusic();
      },
      onToggleAudio: () => {
        this.audio.toggleMute();
      },
      onStartCalibration: () => {
        this.vision.startInteractiveCalibration();
      },
      onToggleCamera: async () => {
        if (this.vision.getStatus() === 'active') {
          this.vision.stopCamera();
        } else {
          await this.vision.startCamera();
        }
      },
    });

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.controls.destroy();
    this.audio.destroy();
    this.vision.destroy();
    this.pauseMenu.hide();
  }

  public resetGame(): void {
    this.score = 0;
    this.distance = 0.0;
    this.speed = BASE_SPEED;
    this.coins = 0;
    this.lives = 3;
    this.streak = 0;
    this.maxStreak = 0;
    this.multiplier = 1;
    this.isNewRecord = false;

    this.screenShakeTimer = 0.0;
    this.screenFlashTimer = 0.0;
    this.invulnerableTimer = 0.0;

    this.sparks = [];
    this.popups = [];

    this.road.reset();
    this.car.reset();
    this.obstacles.reset();
  }

  private loop(now: number): void {
    if (!this.isRunning) return;

    const rawDt = (now - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = now;
    // Clamped dt to prevent collision tunneling or simulation explosion
    const dt = Math.min(rawDt, 0.1);

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private update(dt: number): void {
    // 1. Update Vision Engine (MediaPipe FaceLandmarker, One-Euro, Calibration, PiP HUD)
    const visionOut = this.vision.update(dt);
    this.controls.setVisionInput(
      visionOut.steerNormX,
      visionOut.detectedShape,
      visionOut.jumpTriggered,
      visionOut.shieldTriggered
    );

    const state = this.stateMachine.current;
    this.controls.setPlayingState(state === 'PLAYING');

    const input = this.controls.poll();

    if (input.mutePressed) {
      this.audio.toggleMute();
      this.pauseMenu.syncAudioBtn();
    }

    if (state === 'START') {
      this.pauseMenu.hide();
      // Gently scroll road in menu background
      this.road.update(120.0, dt, this.distance);
      compactArray(this.sparks, (s) => s.update(dt));
      compactArray(this.popups, (p) => p.update(dt));

      if (input.restartPressed && !this.vision.isModalOpen()) {
        this.audio.unlock();
        this.resetGame();
        this.stateMachine.transition('PLAYING');
        this.audio.startMusic();
      }
      return;
    }

    if (state === 'PAUSED') {
      if (input.pausePressed || input.restartPressed) {
        this.audio.unlock();
        this.pauseMenu.hide();
        this.stateMachine.transition('PLAYING');
        this.audio.startMusic();
      }
      return;
    }

    if (state === 'GAMEOVER') {
      this.pauseMenu.hide();
      if (this.gameOverCooldown > 0) {
        this.gameOverCooldown = Math.max(0, this.gameOverCooldown - dt);
      }
      // Slow roll after game over
      this.road.update(60.0, dt, this.distance);
      compactArray(this.sparks, (s) => s.update(dt));
      compactArray(this.popups, (p) => p.update(dt));

      // Guarded restart: requires 1.0s cooldown to prevent instant accidental restart loop!
      if (this.gameOverCooldown <= 0 && input.restartPressed && !this.vision.isModalOpen()) {
        this.audio.unlock();
        this.resetGame();
        this.stateMachine.transition('PLAYING');
        this.audio.startMusic();
      }
      return;
    }

    if (state === 'PLAYING') {
      // Handle Pause
      if (input.pausePressed) {
        this.audio.stopMusic();
        this.pauseMenu.show();
        this.stateMachine.transition('PAUSED');
        return;
      }

      // Handle Jump ability (Eyebrow Raise or Space / J)
      if (input.jumpPressed) {
        if (this.car.triggerJump()) {
          this.audio.playSfx('jump');
          this.popups.push(
            new FloatingPopup('JUMP!', this.car.screenX, this.car.screenY - 80, '#00f0ff', 24, 0.7)
          );
        }
      }

      // Handle Shield & Nitro ability (Asymmetric Wink or Shift / E)
      if (input.shieldPressed) {
        if (this.car.activateShield()) {
          this.audio.playSfx('shield');
          this.popups.push(
            new FloatingPopup('ENERGY SHIELD!', this.car.screenX, this.car.screenY - 95, '#00ff8c', 26, 1.2)
          );
        }
      }

      // Apply steering and shape
      this.car.setTargetSteer(input.targetNormX);
      if (input.targetShape !== null) {
        if (this.car.setShape(input.targetShape)) {
          this.audio.playSfx('morph');
        }
      }

      // Distance & Road Curves
      this.distance += (this.speed * dt) / 10.0;
      const biomeResult = this.road.update(this.speed, dt, this.distance);
      if (biomeResult.biomeChanged) {
        this.audio.playSfx('biome');
        this.popups.push(
          new FloatingPopup(
            `ZONE: ${biomeResult.biomeName}`,
            SCREEN_WIDTH / 2,
            160,
            this.road.biomeManager.accentColor,
            36,
            1.8
          )
        );
      }

      // Player car physics
      this.car.update(this.road, dt);

      // Visual timers
      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer -= dt;
      }
      if (this.screenFlashTimer > 0) {
        this.screenFlashTimer -= dt;
      }
      if (this.screenShakeTimer > 0) {
        this.screenShakeTimer -= dt;
      }

      // Particles & Popups
      compactArray(this.sparks, (s) => s.update(dt));
      compactArray(this.popups, (p) => p.update(dt));

      // Obstacles, Pickups & Collisions
      const ev = this.obstacles.update(this.speed, dt, this.car, this.road);

      if (ev.gauntletStarted) {
        this.popups.push(
          new FloatingPopup('GAUNTLET WAVE!', this.screenWidth / 2, 210, '#ff50b4', 34, 1.5)
        );
      }

      // Obstacle Clears & Speed Progression
      if (ev.obstaclesPassed > 0) {
        this.audio.playSfx('clear');
        const prevMult = this.multiplier;
        this.streak += ev.obstaclesPassed;
        this.maxStreak = Math.max(this.maxStreak, this.streak);
        this.multiplier = getMultiplierForStreak(this.streak);

        const gained = OBSTACLE_BASE_POINTS * ev.obstaclesPassed * this.multiplier;
        this.score += gained;
        this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INCREMENT * ev.obstaclesPassed);

        this.popups.push(
          new FloatingPopup(
            `+${gained}`,
            this.car.screenX,
            this.car.screenY - this.car.h - 20,
            '#64ffa0',
            24,
            0.9
          )
        );

        if (this.multiplier > prevMult) {
          this.audio.playSfx('streak');
          this.popups.push(
            new FloatingPopup(
              `STREAK ${this.multiplier}x!`,
              this.screenWidth / 2,
              260,
              '#ffdc28',
              36,
              1.3
            )
          );
        }
      }

      // Near-Miss Bonus
      if (ev.nearMisses > 0) {
        this.audio.playSfx('near_miss');
        const bonus = NEAR_MISS_BONUS * ev.nearMisses * this.multiplier;
        this.score += bonus;
        this.popups.push(
          new FloatingPopup(
            `NEAR MISS +${bonus}!`,
            this.car.screenX,
            this.car.screenY - this.car.h - 52,
            '#00f0ff',
            24,
            1.1
          )
        );
      }

      // Coin Pickups
      if (ev.coinsCollected > 0) {
        this.audio.playSfx('coin');
        this.coins += ev.coinsCollected;
        const coinPts = COIN_BASE_POINTS * ev.coinsCollected * this.multiplier;
        this.score += coinPts;

        for (const [cx, cy] of ev.coinScreenPositions) {
          this.popups.push(new FloatingPopup(`COIN +${coinPts}`, cx, cy, '#ffd700', 22, 0.9));
          for (let s = 0; s < 10; s++) {
            this.sparks.push(
              new SparkParticle(
                cx,
                cy,
                [
                  [255, 230, 0],
                  [255, 255, 200],
                  [255, 170, 0],
                ],
                true
              )
            );
          }
        }
      }

      // Collision Event
      if (ev.collision && this.invulnerableTimer <= 0) {
        if (this.car.isShielded) {
          // Shield defelects obstacle damage!
          this.audio.playSfx('near_miss');
          this.popups.push(
            new FloatingPopup(
              'SHIELD DEFLECT!',
              this.car.screenX,
              this.car.screenY - this.car.h - 30,
              '#00ff8c',
              24,
              0.8
            )
          );
          for (let s = 0; s < 14; s++) {
            this.sparks.push(
              new SparkParticle(this.car.screenX, this.car.screenY - this.car.h / 2.0, [
                [0, 240, 255],
                [120, 255, 255],
                [255, 230, 80],
              ])
            );
          }
        } else {
          this.audio.playSfx('crash');
          this.lives -= 1;
          this.streak = 0;
          this.multiplier = 1;
          this.screenFlashTimer = 0.20;
          this.screenShakeTimer = 0.25;
          this.invulnerableTimer = 1.4;
          this.car.invulnerableTimer = 1.4;

          // Collision spark debris
          for (let s = 0; s < 28; s++) {
            this.sparks.push(
              new SparkParticle(this.car.screenX, this.car.screenY - this.car.h / 2.0)
            );
          }

          // Check Game Over
          if (this.lives <= 0) {
            this.audio.stopMusic();
            const saveRes = saveHighScore(
              this.score,
              this.distance,
              this.maxStreak,
              this.coins
            );
            this.highScores = saveRes.scores;
            this.isNewRecord = saveRes.isNewRecord;
            this.highScore = this.highScores.length > 0 ? this.highScores[0].score : this.score;
            this.gameOverCooldown = 1.0; // 1.0s cooldown before allowing restart
            this.controls.clearRestart(); // Flush any buffered keys
            this.stateMachine.transition('GAMEOVER');
          }
        }
      }
    }
  }

  private render(): void {
    const ctx = this.ctx;

    // Apply screen shake if active
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShakeTimer > 0) {
      const mag = Math.floor(10 * (this.screenShakeTimer / 0.25));
      shakeX = Math.floor((Math.random() - 0.5) * 2 * mag);
      shakeY = Math.floor((Math.random() - 0.5) * 2 * mag);
    }

    ctx.save();
    if (shakeX !== 0 || shakeY !== 0) {
      ctx.translate(shakeX, shakeY);
    }

    // 1. 2.5D Road & Environment
    this.road.render(ctx);

    // 2. Obstacles & Pickups
    this.obstacles.render(ctx, this.road);

    // 3. Player Car
    this.car.render(ctx);

    // 4. Sparks & Popups
    for (const spark of this.sparks) {
      spark.draw(ctx);
    }
    for (const popup of this.popups) {
      popup.draw(ctx);
    }

    ctx.restore();

    // 5. Red Collision Damage Flash
    if (this.screenFlashTimer > 0) {
      const alpha = 0.55 * (this.screenFlashTimer / 0.20);
      ctx.save();
      ctx.fillStyle = `rgba(255, 0, 0, ${Math.max(0, Math.min(1, alpha))})`;
      ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
      ctx.restore();
    }

    // 6. HUD Telemetry
    renderHUD(
      ctx,
      {
        score: this.score,
        highScore: this.highScore,
        distance: this.distance,
        speed: this.speed,
        coins: this.coins,
        lives: this.lives,
        streak: this.streak,
        multiplier: this.multiplier,
        biomeName: this.road.biomeManager.currentBiomeName,
        accentColor: this.road.biomeManager.accentColor,
        currentShape: this.car.currentShapeKey,
        isMuted: this.audio.isMuted(),
      },
      this.screenWidth,
      this.screenHeight
    );

    // 7. State Overlays
    const state = this.stateMachine.current;
    if (state === 'START') {
      renderStartOverlay(ctx, this.screenWidth, this.screenHeight);
    } else if (state === 'PAUSED') {
      renderPauseOverlay(ctx, this.audio.isMuted(), this.screenWidth, this.screenHeight);
    } else if (state === 'GAMEOVER') {
      renderGameOverOverlay(
        ctx,
        this.score,
        this.distance,
        this.maxStreak,
        this.coins,
        this.highScores,
        this.isNewRecord,
        this.gameOverCooldown <= 0,
        this.screenWidth,
        this.screenHeight
      );
    }
  }
}
