/**
 * Privacy Permission Modal & PiP Webcam HUD Overlay.
 * Informs user with plain-language privacy guarantee ("video never leaves device"),
 * handles camera enable / skip actions, provides webcam PiP preview with expression telemetry,
 * and renders interactive calibration overlay when running 3-step wizard.
 */

import { VisionState } from '../vision/processor';
import { CalibrationStep } from '../vision/calibration';

export interface PrivacyModalCallbacks {
  onEnableCamera: () => void;
  onSkipCamera: () => void;
  onCancelCalibration?: () => void;
  onRecenter?: () => void;
}

export class PrivacyModalUI {
  private container: HTMLElement | null = null;
  private modalElement: HTMLElement | null = null;
  private pipContainer: HTMLElement | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipCtx: CanvasRenderingContext2D | null = null;
  private statusBadge: HTMLElement | null = null;
  private calibrationOverlay: HTMLElement | null = null;

  private isPipVisible: boolean = true;
  private callbacks: PrivacyModalCallbacks = {
    onEnableCamera: () => {},
    onSkipCamera: () => {},
  };

  constructor() {}

  public mount(parent: HTMLElement, callbacks: PrivacyModalCallbacks): void {
    this.container = parent;
    this.callbacks = callbacks;

    this.createStyles();
    this.createPrivacyModal();
    this.createStatusBadge();
    this.createPipHud();
    this.createCalibrationOverlay();
  }

  private createStyles(): void {
    if (document.getElementById('ssr-privacy-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssr-privacy-styles';
    style.textContent = `
      .ssr-privacy-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(8, 4, 18, 0.88);
        backdrop-filter: blur(6px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: ssrFadeIn 0.25s ease-out;
      }

      @keyframes ssrFadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }

      .ssr-modal-card {
        width: 90%;
        max-width: 540px;
        background: rgba(18, 14, 34, 0.98);
        border: 2px solid #00e6ff;
        border-radius: 12px;
        padding: 28px 24px;
        box-shadow: 0 0 30px rgba(0, 230, 255, 0.35);
        color: #e0d8f0;
        text-align: center;
      }

      .ssr-modal-title {
        font-family: Impact, sans-serif;
        font-size: 28px;
        color: #00e6ff;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }

      .ssr-privacy-badge {
        display: inline-block;
        background: rgba(0, 255, 140, 0.15);
        color: #00ff8c;
        border: 1px solid #00ff8c;
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 16px;
        letter-spacing: 0.5px;
      }

      .ssr-modal-desc {
        font-size: 15px;
        line-height: 1.55;
        color: #c8c0d8;
        margin-bottom: 18px;
      }

      .ssr-modal-desc strong {
        color: #ffffff;
      }

      .ssr-features-list {
        background: rgba(28, 20, 50, 0.6);
        border: 1px solid rgba(0, 230, 255, 0.2);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 22px;
        text-align: left;
        font-size: 13px;
        line-height: 1.6;
      }

      .ssr-btn-row {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .ssr-btn {
        padding: 12px 22px;
        font-size: 15px;
        font-weight: bold;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.1s, background-color 0.15s;
        border: none;
      }

      .ssr-btn-primary {
        background: linear-gradient(135deg, #00e6ff, #0088ff);
        color: #050510;
        box-shadow: 0 0 16px rgba(0, 230, 255, 0.4);
      }
      .ssr-btn-primary:hover {
        transform: scale(1.03);
        box-shadow: 0 0 24px rgba(0, 230, 255, 0.6);
      }

      .ssr-btn-secondary {
        background: rgba(30, 22, 54, 0.9);
        border: 1px solid #7d7395;
        color: #e0d8f0;
      }
      .ssr-btn-secondary:hover {
        border-color: #00e6ff;
        color: #00e6ff;
      }

      /* Fallback status badge (prominent top center notification) */
      .ssr-status-badge {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(18, 14, 34, 0.92);
        border: 1px solid rgba(0, 230, 255, 0.6);
        border-radius: 999px;
        padding: 6px 16px;
        font-size: 13px;
        font-weight: bold;
        color: #00e6ff;
        white-space: nowrap;
        display: none;
        pointer-events: none;
        z-index: 999;
        box-shadow: 0 0 15px rgba(0, 230, 255, 0.4);
      }

      /* PiP Webcam Preview HUD */
      .ssr-pip-hud {
        position: absolute;
        top: 14px;
        right: 120px;
        width: 160px;
        height: 120px;
        background: rgba(10, 8, 20, 0.85);
        border: 2px solid rgba(0, 230, 255, 0.6);
        border-radius: 8px;
        overflow: hidden;
        z-index: 60;
        display: none;
        box-shadow: 0 0 16px rgba(0, 230, 255, 0.3);
      }

      @media (max-width: 800px) and (orientation: portrait) {
        .ssr-pip-hud {
          top: calc(56px + env(safe-area-inset-top, 0px));
          right: 12px;
          width: 96px;
          height: 72px;
          border-width: 1.5px;
        }

        .ssr-modal-card {
          padding: 20px 16px;
        }

        .ssr-modal-title {
          font-size: 22px;
        }

        .ssr-features-list {
          font-size: 11.5px;
        }

        .ssr-btn {
          padding: 10px 18px;
          font-size: 13.5px;
        }
      }

      .ssr-pip-canvas {
        width: 100%;
        height: 100%;
        display: block;
        transform: scaleX(-1); /* Natural mirror feel */
      }

      .ssr-pip-toggle-btn {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 22px;
        height: 22px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: #fff;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 65;
      }

      /* Interactive 3-Step Calibration Overlay */
      .ssr-calib-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 6, 22, 0.82);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 900;
        color: #fff;
        text-align: center;
      }

      .ssr-calib-card {
        background: rgba(22, 16, 42, 0.95);
        border: 2px solid #ffd700;
        border-radius: 12px;
        padding: 30px;
        max-width: 520px;
        width: 90%;
        box-shadow: 0 0 35px rgba(255, 215, 0, 0.3);
      }

      .ssr-calib-title {
        font-family: Impact, sans-serif;
        font-size: 32px;
        color: #ffd700;
        margin-bottom: 8px;
      }

      .ssr-calib-prompt {
        font-size: 18px;
        color: #e0d8f0;
        margin-bottom: 20px;
        min-height: 48px;
      }

      .ssr-calib-progress-bar {
        width: 100%;
        height: 14px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 7px;
        overflow: hidden;
        margin-bottom: 20px;
      }

      .ssr-calib-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #00e6ff, #ffd700);
        transition: width 0.1s linear;
      }
    `;
    document.head.appendChild(style);
  }

  private createPrivacyModal(): void {
    if (!this.container) return;

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'ssr-privacy-modal-backdrop';
    this.modalElement.innerHTML = `
      <div class="ssr-modal-card">
        <h2 class="ssr-modal-title">FACIAL &amp; HEAD POSE CONTROLS</h2>
        <div class="ssr-privacy-badge">🔒 100% ON-DEVICE PRIVACY GUARANTEE</div>
        <p class="ssr-modal-desc">
          <strong>Face tracking runs entirely in your browser using local WebAssembly.</strong><br />
          Your camera video never leaves your computer, is never recorded, and is never transmitted over the internet.
        </p>
        <div class="ssr-features-list">
          <div>• <strong>Smile Wide:</strong> Morphs your car into <em>LOW-RIDER</em> (slides under low beams)</div>
          <div>• <strong>Open Mouth:</strong> Morphs your car into <em>SLIM-BLADE</em> (slips through twin pillars)</div>
          <div>• <strong>Head Turn / Tilt:</strong> Steers your car smoothly across the 3 neon highway lanes</div>
          <div>• <em>Keyboard (A/D/Arrows/Space) and Touch buttons remain fully active at all times!</em></div>
        </div>
        <div class="ssr-btn-row">
          <button id="ssr-btn-enable-cam" class="ssr-btn ssr-btn-primary">Enable Camera</button>
          <button id="ssr-btn-skip-cam" class="ssr-btn ssr-btn-secondary">Skip / Keyboard &amp; Touch Only</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.modalElement);

    const btnEnable = this.modalElement.querySelector('#ssr-btn-enable-cam');
    const btnSkip = this.modalElement.querySelector('#ssr-btn-skip-cam');

    let enableHandled = false;
    const onEnable = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (enableHandled) return;
      enableHandled = true;
      this.hideModal();
      this.callbacks.onEnableCamera();
    };

    btnEnable?.addEventListener('click', onEnable);
    btnEnable?.addEventListener('touchend', onEnable);

    let skipHandled = false;
    const onSkip = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (skipHandled) return;
      skipHandled = true;
      this.hideModal();
      this.callbacks.onSkipCamera();
      this.showStatusBadge('Keyboard & Touch Controls Active');
    };

    btnSkip?.addEventListener('click', onSkip);
    btnSkip?.addEventListener('touchend', onSkip);
  }

  private createStatusBadge(): void {
    if (!this.container) return;
    this.statusBadge = document.createElement('div');
    this.statusBadge.className = 'ssr-status-badge';
    this.statusBadge.textContent = 'Keyboard & Touch Controls Active';
    this.container.appendChild(this.statusBadge);
  }

  private createPipHud(): void {
    if (!this.container) return;
    this.pipContainer = document.createElement('div');
    this.pipContainer.className = 'ssr-pip-hud';
    this.pipContainer.title = 'Tap preview to Recenter head pose';
    this.pipContainer.style.cursor = 'pointer';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ssr-pip-toggle-btn';
    toggleBtn.textContent = '👁';
    toggleBtn.title = 'Toggle Webcam HUD';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePip();
    });

    const onPipClick = (e: Event) => {
      if (e.target === toggleBtn) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.callbacks.onRecenter) {
        this.callbacks.onRecenter();
      }
    };
    this.pipContainer.addEventListener('click', onPipClick);
    this.pipContainer.addEventListener('touchend', onPipClick);

    this.pipCanvas = document.createElement('canvas');
    this.pipCanvas.className = 'ssr-pip-canvas';
    this.pipCanvas.width = 160;
    this.pipCanvas.height = 120;
    this.pipCtx = this.pipCanvas.getContext('2d');

    this.pipContainer.appendChild(toggleBtn);
    this.pipContainer.appendChild(this.pipCanvas);
    this.container.appendChild(this.pipContainer);
  }

  private createCalibrationOverlay(): void {
    if (!this.container) return;
    this.calibrationOverlay = document.createElement('div');
    this.calibrationOverlay.className = 'ssr-calib-overlay';
    this.calibrationOverlay.innerHTML = `
      <div class="ssr-calib-card">
        <div class="ssr-calib-title">CALIBRATION WIZARD</div>
        <div id="ssr-calib-step-name" style="font-weight: bold; color: #00e6ff; margin-bottom: 8px;">STEP: NEUTRAL</div>
        <div id="ssr-calib-prompt" class="ssr-calib-prompt">Look straight at the screen with a relaxed neutral face.</div>
        <div class="ssr-calib-progress-bar">
          <div id="ssr-calib-fill" class="ssr-calib-fill"></div>
        </div>
        <button id="ssr-calib-cancel-btn" class="ssr-btn ssr-btn-secondary" style="font-size: 13px; padding: 6px 16px;">Cancel</button>
      </div>
    `;

    this.container.appendChild(this.calibrationOverlay);

    const cancelBtn = this.calibrationOverlay.querySelector('#ssr-calib-cancel-btn');
    cancelBtn?.addEventListener('click', () => {
      this.hideCalibrationOverlay();
      if (this.callbacks.onCancelCalibration) {
        this.callbacks.onCancelCalibration();
      }
    });
  }

  public showModal(): void {
    if (this.modalElement) {
      this.modalElement.style.display = 'flex';
    }
  }

  public hideModal(): void {
    if (this.modalElement) {
      this.modalElement.style.display = 'none';
    }
  }

  public isModalVisible(): boolean {
    return Boolean(this.modalElement && this.modalElement.style.display !== 'none');
  }

  public showStatusBadge(text: string): void {
    if (this.statusBadge) {
      this.statusBadge.textContent = text;
      this.statusBadge.style.display = 'block';
    }
  }

  public hideStatusBadge(): void {
    if (this.statusBadge) {
      this.statusBadge.style.display = 'none';
    }
  }

  public showPipHud(): void {
    if (this.pipContainer) {
      this.pipContainer.style.display = 'block';
    }
  }

  public hidePipHud(): void {
    if (this.pipContainer) {
      this.pipContainer.style.display = 'none';
    }
  }

  public togglePip(): void {
    this.isPipVisible = !this.isPipVisible;
    if (this.pipCanvas) {
      this.pipCanvas.style.opacity = this.isPipVisible ? '1' : '0.1';
    }
  }

  public showCalibrationOverlay(step: CalibrationStep, prompt: string): void {
    if (!this.calibrationOverlay) return;
    this.calibrationOverlay.style.display = 'flex';
    const stepEl = this.calibrationOverlay.querySelector('#ssr-calib-step-name');
    const promptEl = this.calibrationOverlay.querySelector('#ssr-calib-prompt');
    if (stepEl) stepEl.textContent = `STEP: ${step}`;
    if (promptEl) promptEl.textContent = prompt;
  }

  public updateCalibrationProgress(percent: number): void {
    if (!this.calibrationOverlay) return;
    const fill = this.calibrationOverlay.querySelector('#ssr-calib-fill') as HTMLElement | null;
    if (fill) {
      fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  public hideCalibrationOverlay(): void {
    if (this.calibrationOverlay) {
      this.calibrationOverlay.style.display = 'none';
    }
  }

  /**
   * Render camera feed and expression metrics to PiP HUD canvas.
   */
  public renderPip(video: HTMLVideoElement | null, state: VisionState | null): void {
    if (!this.pipCtx || !this.pipCanvas || !this.isPipVisible) return;
    const ctx = this.pipCtx;
    const w = this.pipCanvas.width;
    const h = this.pipCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        ctx.drawImage(video, 0, 0, w, h);
      } catch {
        // Safe ignore
      }
    } else {
      ctx.fillStyle = '#100a20';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#7d7395';
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Webcam Feed', w / 2, h / 2);
    }

    if (state && state.faceDetected) {
      // Telemetry meters overlay (un-mirrored text)
      ctx.save();
      // Reverse canvas coordinate flip so text reads normally
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      // Smile meter (pink)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(6, 6, 60, 8);
      ctx.fillStyle = '#ff0080';
      ctx.fillRect(6, 6, Math.floor(60 * state.smoothSmile), 8);

      // Open mouth meter (lime)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(6, 18, 60, 8);
      ctx.fillStyle = '#00ff8c';
      ctx.fillRect(6, 18, Math.floor(60 * state.smoothOpen), 8);

      // Eyebrow meter (yellow - Jump)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(6, 30, 60, 6);
      ctx.fillStyle = '#ffdc00';
      ctx.fillRect(6, 30, Math.floor(60 * (state.smoothBrow || 0)), 6);

      // Wink meter (purple - Shield)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(6, 40, 60, 6);
      ctx.fillStyle = '#b450ff';
      ctx.fillRect(6, 40, Math.floor(60 * (state.winkScore || 0)), 6);

      // Steering indicator (cyan)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(6, 50, 60, 6);
      const steerNorm = (state.steerNormX / 0.82 + 1.0) * 0.5; // 0 to 1
      ctx.fillStyle = '#00e6ff';
      ctx.fillRect(6 + Math.floor(steerNorm * 56), 49, 4, 8);

      // Detected shape tag
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(w - 74, 6, 68, 16);
      ctx.strokeStyle =
        state.activeShape === 'FLAT'
          ? '#ff0080'
          : state.activeShape === 'NARROW'
          ? '#00ff8c'
          : '#00e6ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(w - 74, 6, 68, 16);

      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.activeShape, w - 40, 18);

      // Recenter tip
      ctx.fillStyle = 'rgba(0, 230, 255, 0.75)';
      ctx.font = 'bold 8px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO RECENTER', w / 2, h - 5);

      ctx.restore();
    }
  }
}
