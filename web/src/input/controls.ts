/**
 * Unified Controls Manager.
 * Merges Desktop Keyboard, Mobile Touch HUD, and optional Vision inputs
 * into a single consolidated InputState per tick.
 */

import { CarShapeKey } from '../config';
import { KeyboardInput } from './keyboard';
import { TouchInput } from './touch';

export interface InputState {
  targetNormX: number;
  targetShape: CarShapeKey | null;
  jumpPressed: boolean;
  shieldPressed: boolean;
  pausePressed: boolean;
  mutePressed: boolean;
  restartPressed: boolean;
}

export class ControlsManager {
  public readonly keyboard: KeyboardInput;
  public readonly touch: TouchInput;

  // Pluggable vision steer, shape, and abilities
  private visionSteerX: number | null = null;
  private visionShape: CarShapeKey | null = null;
  private previousVisionShape: CarShapeKey | null = null;
  private visionJump: boolean = false;
  private visionShield: boolean = false;
  private manualSteerGraceTicks: number = 0;
  private manualShapeGraceTicks: number = 0;

  constructor() {
    this.keyboard = new KeyboardInput();
    this.touch = new TouchInput();
  }

  public init(): void {
    this.keyboard.attach();
    this.touch.attach();
  }

  public destroy(): void {
    this.keyboard.detach();
    this.touch.detach();
  }

  public setPlayingState(playing: boolean): void {
    this.keyboard.isPlaying = playing;
    this.touch.isPlaying = playing;
  }

  public clearRestart(): void {
    this.keyboard.clearRestart();
    this.touch.clearRestart();
  }

  public setVisionInput(
    steerX: number | null,
    shape: CarShapeKey | null,
    jump: boolean = false,
    shield: boolean = false
  ): void {
    this.visionSteerX = steerX;
    this.visionShape = shape;
    if (jump) this.visionJump = true;
    if (shield) this.visionShield = true;
  }

  public poll(): InputState {
    const kbSteer = this.keyboard.getSteerInput();
    const touchSteer = this.touch.getSteerInput();
    let steer = 0.0;

    if (kbSteer !== 0.0) {
      steer = kbSteer;
      this.manualSteerGraceTicks = 20; // ~0.33s manual steering priority
    } else if (touchSteer !== 0.0) {
      steer = touchSteer;
      this.manualSteerGraceTicks = 20;
    } else if (this.manualSteerGraceTicks > 0) {
      this.manualSteerGraceTicks--;
      steer = 0.0;
    } else if (this.visionSteerX !== null) {
      steer = this.visionSteerX;
    }

    const kbShape = this.keyboard.getShapeInput();
    const touchShape = this.touch.getShapeInput();
    let shape: CarShapeKey | null = null;

    if (touchShape !== null) {
      shape = touchShape;
      this.manualShapeGraceTicks = 45; // ~0.75s manual morph lock
      this.previousVisionShape = touchShape;
    } else if (kbShape !== null) {
      shape = kbShape;
      this.manualShapeGraceTicks = 45;
      this.previousVisionShape = kbShape;
    } else if (this.manualShapeGraceTicks > 0) {
      this.manualShapeGraceTicks--;
      // Hold current manual shape, ignore neutral vision resting face
    } else if (this.visionShape !== null) {
      if (this.visionShape !== this.previousVisionShape) {
        shape = this.visionShape;
        this.previousVisionShape = this.visionShape;
      }
    }

    const pausePressed = this.keyboard.consumePause() || this.touch.consumePause();
    const mutePressed = this.keyboard.consumeMute() || this.touch.consumeMute();
    const restartPressed = this.keyboard.consumeRestart() || this.touch.consumeRestart();
    const jumpPressed = this.keyboard.consumeJump() || this.touch.consumeJump() || this.visionJump;
    this.visionJump = false;
    const shieldPressed = this.keyboard.consumeShield() || this.touch.consumeShield() || this.visionShield;
    this.visionShield = false;

    return {
      targetNormX: Math.max(-0.82, Math.min(0.82, steer)),
      targetShape: shape,
      jumpPressed,
      shieldPressed,
      pausePressed,
      mutePressed,
      restartPressed,
    };
  }
}
