/**
 * Mobile Multi-Touch Input Controller.
 * Handles dual-thumb controls with independent pointer tracking and zero lag.
 */

import { CarShapeKey } from '../config';

export class TouchInput {
  private activeSteerPointers: Map<number, 'left' | 'right'> = new Map();
  private lastShapeInput: CarShapeKey | null = null;
  public pauseTriggered: boolean = false;
  public muteTriggered: boolean = false;
  public restartTriggered: boolean = false;
  public jumpTriggered: boolean = false;
  public shieldTriggered: boolean = false;
  public isPlaying: boolean = false;

  private boundListeners: { element: HTMLElement | Window | Document; event: string; fn: EventListener }[] = [];

  public attach(): void {
    const btnLeft = document.getElementById('btn-steer-left');
    const btnRight = document.getElementById('btn-steer-right');
    const btnFlat = document.getElementById('btn-shape-flat');
    const btnNormal = document.getElementById('btn-shape-normal');
    const btnNarrow = document.getElementById('btn-shape-narrow');
    const btnPause = document.getElementById('btn-pause');
    const btnAudio = document.getElementById('btn-audio');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const gameContainer = document.getElementById('game-container');

    const addListener = (element: HTMLElement | Window | Document | null, event: string, fn: EventListener) => {
      if (element) {
        element.addEventListener(event, fn, { passive: false });
        this.boundListeners.push({ element, event, fn });
      }
    };

    // Steering buttons
    if (btnLeft) {
      addListener(btnLeft, 'pointerdown', (e: Event) => {
        const pe = e as PointerEvent;
        pe.preventDefault();
        btnLeft.classList.add('active');
        this.activeSteerPointers.set(pe.pointerId, 'left');
      });
      const endLeft = (e: Event) => {
        const pe = e as PointerEvent;
        btnLeft.classList.remove('active');
        this.activeSteerPointers.delete(pe.pointerId);
      };
      addListener(btnLeft, 'pointerup', endLeft);
      addListener(btnLeft, 'pointercancel', endLeft);
      addListener(btnLeft, 'pointerleave', endLeft);
    }

    if (btnRight) {
      addListener(btnRight, 'pointerdown', (e: Event) => {
        const pe = e as PointerEvent;
        pe.preventDefault();
        btnRight.classList.add('active');
        this.activeSteerPointers.set(pe.pointerId, 'right');
      });
      const endRight = (e: Event) => {
        const pe = e as PointerEvent;
        btnRight.classList.remove('active');
        this.activeSteerPointers.delete(pe.pointerId);
      };
      addListener(btnRight, 'pointerup', endRight);
      addListener(btnRight, 'pointercancel', endRight);
      addListener(btnRight, 'pointerleave', endRight);
    }

    // Shape morph buttons
    const bindShapeBtn = (btn: HTMLElement | null, shape: CarShapeKey) => {
      if (!btn) return;
      addListener(btn, 'pointerdown', (e: Event) => {
        e.preventDefault();
        btn.classList.add('active');
        this.lastShapeInput = shape;
      });
      const end = () => btn.classList.remove('active');
      addListener(btn, 'pointerup', end);
      addListener(btn, 'pointercancel', end);
      addListener(btn, 'pointerleave', end);
    };

    bindShapeBtn(btnFlat, 'FLAT');
    bindShapeBtn(btnNormal, 'NORMAL');
    bindShapeBtn(btnNarrow, 'NARROW');

    // Jump & Shield touch buttons
    const btnJump = document.getElementById('btn-jump');
    if (btnJump) {
      addListener(btnJump, 'pointerdown', (e: Event) => {
        e.preventDefault();
        btnJump.classList.add('active');
        this.jumpTriggered = true;
      });
      const endJump = () => btnJump.classList.remove('active');
      addListener(btnJump, 'pointerup', endJump);
      addListener(btnJump, 'pointercancel', endJump);
    }

    const btnShield = document.getElementById('btn-shield');
    if (btnShield) {
      addListener(btnShield, 'pointerdown', (e: Event) => {
        e.preventDefault();
        btnShield.classList.add('active');
        this.shieldTriggered = true;
      });
      const endShield = () => btnShield.classList.remove('active');
      addListener(btnShield, 'pointerup', endShield);
      addListener(btnShield, 'pointercancel', endShield);
    }

    // Audio mute button
    if (btnAudio) {
      addListener(btnAudio, 'pointerdown', (e: Event) => {
        e.preventDefault();
        this.muteTriggered = true;
      });
    }

    // Pause button
    if (btnPause) {
      addListener(btnPause, 'pointerdown', (e: Event) => {
        e.preventDefault();
        this.pauseTriggered = true;
      });
    }

    // Fullscreen button
    if (btnFullscreen && gameContainer) {
      addListener(btnFullscreen, 'pointerdown', (e: Event) => {
        e.preventDefault();
        try {
          if (!document.fullscreenElement) {
            if (gameContainer.requestFullscreen) {
              gameContainer.requestFullscreen();
            } else if ((gameContainer as any).webkitRequestFullscreen) {
              (gameContainer as any).webkitRequestFullscreen();
            }
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
            }
          }
        } catch {
          // Ignore
        }
      });

      const updateFullscreenIcon = () => {
        if (document.fullscreenElement) {
          btnFullscreen.textContent = '✕';
          btnFullscreen.setAttribute('aria-label', 'Exit Fullscreen');
        } else {
          btnFullscreen.textContent = '⛶';
          btnFullscreen.setAttribute('aria-label', 'Enter Fullscreen');
        }
      };
      addListener(document, 'fullscreenchange', updateFullscreenIcon);
      addListener(document, 'webkitfullscreenchange', updateFullscreenIcon);
    }

    // Tap on canvas / game container to start / restart game (ONLY when not playing!)
    // Ignore clicks on buttons, inputs, links, modals, pause menu, calibration, PiP HUD, or consent banner
    if (gameContainer) {
      addListener(gameContainer, 'pointerdown', (e: Event) => {
        if (this.isPlaying) return; // Never queue restart while actively playing
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const isInteractiveOrOverlay =
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'A' ||
          target.tagName === 'LABEL' ||
          target.tagName === 'SELECT' ||
          Boolean(
            target.closest(
              'button, input, a, label, select, .ssr-privacy-modal-backdrop, .ssr-consent-modal-backdrop, .ssr-pause-overlay, .ssr-calib-overlay, .ssr-pip-hud, .ssr-consent-banner'
            )
          );
        if (!isInteractiveOrOverlay) {
          this.restartTriggered = true;
        }
      });
    }

    // Window level safety cleanup for pointer release outside elements
    addListener(window, 'pointerup', (e: Event) => {
      const pe = e as PointerEvent;
      this.activeSteerPointers.delete(pe.pointerId);
    });
    addListener(window, 'pointercancel', (e: Event) => {
      const pe = e as PointerEvent;
      this.activeSteerPointers.delete(pe.pointerId);
    });
  }

  public detach(): void {
    for (const { element, event, fn } of this.boundListeners) {
      element.removeEventListener(event, fn);
    }
    this.boundListeners = [];
    this.activeSteerPointers.clear();
  }

  public getSteerInput(): number {
    let left = false;
    let right = false;
    for (const dir of this.activeSteerPointers.values()) {
      if (dir === 'left') left = true;
      if (dir === 'right') right = true;
    }

    if (left && !right) return -0.75;
    if (right && !left) return 0.75;
    return 0.0;
  }

  public getShapeInput(): CarShapeKey | null {
    const s = this.lastShapeInput;
    this.lastShapeInput = null;
    return s;
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

  public clearRestart(): void {
    this.restartTriggered = false;
  }
}
