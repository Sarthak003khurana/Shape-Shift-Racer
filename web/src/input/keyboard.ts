/**
 * Desktop Keyboard Input Handler.
 * Supports Arrows and WASD for steering & morphing, Space for normal/start/restart,
 * P for pause, and M for audio toggle.
 */

import { CarShapeKey } from '../config';

export class KeyboardInput {
  private keysDown: Set<string> = new Set();
  public pauseTriggered: boolean = false;
  public muteTriggered: boolean = false;
  public restartTriggered: boolean = false;
  public jumpTriggered: boolean = false;
  public shieldTriggered: boolean = false;
  public recenterTriggered: boolean = false;
  public isPlaying: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
  }

  public attach(): void {
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    this.keysDown.clear();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent default scrolling for arrows and space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (!e.repeat) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.pauseTriggered = true;
      }
      if (e.code === 'KeyM') {
        this.muteTriggered = true;
      }
      if (e.code === 'KeyR' || e.code === 'Enter') {
        this.restartTriggered = true;
      }
      if (e.code === 'Space') {
        if (!this.isPlaying) {
          this.restartTriggered = true;
        } else {
          this.jumpTriggered = true;
        }
      }
      if (e.code === 'KeyJ') {
        this.jumpTriggered = true;
      }
      if (e.code === 'KeyC') {
        this.recenterTriggered = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
        this.shieldTriggered = true;
      }
    }

    this.keysDown.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  public getSteerInput(): number {
    const left = this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA');
    const right = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD');

    if (left && !right) return -0.75;
    if (right && !left) return 0.75;
    return 0.0;
  }

  public getShapeInput(): CarShapeKey | null {
    if (this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS') || this.keysDown.has('Digit2')) {
      return 'FLAT';
    }
    if (this.keysDown.has('ArrowUp') || this.keysDown.has('KeyW') || this.keysDown.has('Digit3')) {
      return 'NARROW';
    }
    if (this.keysDown.has('Digit1') || this.keysDown.has('KeyN')) {
      return 'NORMAL';
    }
    return null;
  }

  public consumePause(): boolean {
    const p = this.pauseTriggered;
    this.pauseTriggered = false;
    return p;
  }

  public consumeMute(): boolean {
    const m = this.muteTriggered;
    this.muteTriggered = false;
    return m;
  }

  public consumeRestart(): boolean {
    const r = this.restartTriggered;
    this.restartTriggered = false;
    return r;
  }

  public consumeJump(): boolean {
    const j = this.jumpTriggered;
    this.jumpTriggered = false;
    return j;
  }

  public consumeShield(): boolean {
    const s = this.shieldTriggered;
    this.shieldTriggered = false;
    return s;
  }

  public consumeRecenter(): boolean {
    const c = this.recenterTriggered;
    this.recenterTriggered = false;
    return c;
  }

  public clearRestart(): void {
    this.restartTriggered = false;
  }
}
