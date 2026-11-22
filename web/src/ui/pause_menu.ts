/**
 * Interactive Pause Menu UI.
 * Provides live sensitivity sliders (Smile, O-Mouth, Steer),
 * audio mute toggle, and 3-step facial calibration wizard trigger.
 */

import { VisionManager } from '../vision/vision_manager';
import { WebAudioManager } from '../audio/audio_manager';
import { loadSettings } from '../core/storage';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onToggleAudio: () => void;
  onStartCalibration: () => void;
  onToggleCamera?: () => Promise<void> | void;
}

export class PauseMenuUI {
  private container: HTMLElement | null = null;
  private menuElement: HTMLElement | null = null;
  private isVisible: boolean = false;

  private smileSlider: HTMLInputElement | null = null;
  private openSlider: HTMLInputElement | null = null;
  private steerSlider: HTMLInputElement | null = null;
  private audioBtn: HTMLButtonElement | null = null;
  private cameraBtn: HTMLButtonElement | null = null;
  private noticeEl: HTMLElement | null = null;

  private visionManager: VisionManager | null = null;
  private audioManager: WebAudioManager | null = null;
  private callbacks: PauseMenuCallbacks = {
    onResume: () => {},
    onToggleAudio: () => {},
    onStartCalibration: () => {},
  };

  public mount(
    parent: HTMLElement,
    vision: VisionManager,
    audio: WebAudioManager,
    callbacks: PauseMenuCallbacks
  ): void {
    this.container = parent;
    this.visionManager = vision;
    this.audioManager = audio;
    this.callbacks = callbacks;

    this.createStyles();
    this.createMenu();
  }

  private createStyles(): void {
    if (document.getElementById('ssr-pause-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssr-pause-menu-styles';
    style.textContent = `
      .ssr-pause-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(8, 4, 18, 0.88);
        backdrop-filter: blur(8px);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 500;
        color: #e0d8f0;
        user-select: none;
      }

      .ssr-pause-card {
        background: rgba(22, 16, 42, 0.96);
        border: 2px solid #00e6ff;
        border-radius: 12px;
        padding: 24px 32px;
        max-width: 580px;
        width: 90%;
        box-shadow: 0 0 35px rgba(0, 230, 255, 0.35);
        text-align: center;
      }

      .ssr-pause-title {
        font-family: Impact, sans-serif;
        font-size: 38px;
        color: #00e6ff;
        letter-spacing: 2px;
        margin-bottom: 4px;
        text-shadow: 0 0 16px rgba(0, 230, 255, 0.6);
      }

      .ssr-pause-subtitle {
        font-size: 13px;
        color: #9ba5be;
        margin-bottom: 20px;
      }

      .ssr-slider-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
        text-align: left;
      }

      .ssr-slider-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .ssr-slider-label {
        font-size: 13px;
        font-weight: bold;
        color: #dce6ff;
        min-width: 150px;
      }

      .ssr-slider-input {
        flex: 1;
        accent-color: #00e6ff;
        cursor: pointer;
      }

      .ssr-slider-val {
        font-family: monospace;
        font-size: 13px;
        color: #ffe600;
        min-width: 44px;
        text-align: right;
      }

      .ssr-pause-btn-row {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .ssr-pause-btn {
        padding: 10px 18px;
        font-size: 14px;
        font-weight: bold;
        border-radius: 6px;
        cursor: pointer;
        border: none;
        transition: transform 0.1s, box-shadow 0.1s;
      }

      .ssr-pause-btn:hover {
        transform: scale(1.03);
      }

      .ssr-pause-btn-resume {
        background: linear-gradient(135deg, #64ff8c, #00d26a);
        color: #061a0e;
        box-shadow: 0 0 16px rgba(100, 255, 140, 0.4);
      }

      .ssr-pause-btn-calib {
        background: rgba(36, 26, 64, 0.9);
        border: 1px solid #ffd700;
        color: #ffd700;
      }
      .ssr-pause-btn-calib:hover {
        background: rgba(255, 215, 0, 0.2);
        box-shadow: 0 0 16px rgba(255, 215, 0, 0.4);
      }

      .ssr-pause-btn-audio {
        background: rgba(36, 26, 64, 0.9);
        border: 1px solid #00e6ff;
        color: #00e6ff;
      }
    `;
    document.head.appendChild(style);
  }

  private createMenu(): void {
    if (!this.container) return;

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'ssr-pause-overlay';

    const settings = loadSettings();

    this.menuElement.innerHTML = `
      <div class="ssr-pause-card">
        <h2 class="ssr-pause-title">PAUSED</h2>
        <div class="ssr-pause-subtitle">Shape-Shift Racer by Sarthak</div>

        <div class="ssr-slider-group">
          <div class="ssr-slider-row">
            <span class="ssr-slider-label">Smile Sensitivity:</span>
            <input type="range" id="ssr-slider-smile" class="ssr-slider-input" min="0.5" max="2.0" step="0.05" value="${settings.smile_sensitivity.toFixed(2)}" />
            <span id="ssr-val-smile" class="ssr-slider-val">${settings.smile_sensitivity.toFixed(2)}x</span>
          </div>

          <div class="ssr-slider-row">
            <span class="ssr-slider-label">O-Mouth Sensitivity:</span>
            <input type="range" id="ssr-slider-open" class="ssr-slider-input" min="0.5" max="2.0" step="0.05" value="${settings.open_sensitivity.toFixed(2)}" />
            <span id="ssr-val-open" class="ssr-slider-val">${settings.open_sensitivity.toFixed(2)}x</span>
          </div>

          <div class="ssr-slider-row">
            <span class="ssr-slider-label">Steer Sensitivity:</span>
            <input type="range" id="ssr-slider-steer" class="ssr-slider-input" min="0.5" max="2.0" step="0.05" value="${settings.steer_sensitivity.toFixed(2)}" />
            <span id="ssr-val-steer" class="ssr-slider-val">${settings.steer_sensitivity.toFixed(2)}x</span>
          </div>
        </div>

        <div class="ssr-pause-btn-row">
          <button id="ssr-pause-resume" class="ssr-pause-btn ssr-pause-btn-resume">Resume Game</button>
          <button id="ssr-pause-calib" class="ssr-pause-btn ssr-pause-btn-calib">★ Calibrate Face (3 Steps)</button>
          <button id="ssr-pause-camera" class="ssr-pause-btn ssr-pause-btn-audio">📷 Camera</button>
          <button id="ssr-pause-audio" class="ssr-pause-btn ssr-pause-btn-audio">🔊 Audio</button>
        </div>
        <div id="ssr-pause-notice" style="margin-top: 10px; min-height: 18px; font-size: 12px; color: #ffd700;"></div>
      </div>
    `;

    this.container.appendChild(this.menuElement);

    this.smileSlider = this.menuElement.querySelector('#ssr-slider-smile');
    this.openSlider = this.menuElement.querySelector('#ssr-slider-open');
    this.steerSlider = this.menuElement.querySelector('#ssr-slider-steer');
    this.audioBtn = this.menuElement.querySelector('#ssr-pause-audio');
    this.cameraBtn = this.menuElement.querySelector('#ssr-pause-camera');
    this.noticeEl = this.menuElement.querySelector('#ssr-pause-notice');

    const valSmile = this.menuElement.querySelector('#ssr-val-smile');
    const valOpen = this.menuElement.querySelector('#ssr-val-open');
    const valSteer = this.menuElement.querySelector('#ssr-val-steer');

    const updateSens = () => {
      const s = parseFloat(this.smileSlider?.value || '1.0');
      const o = parseFloat(this.openSlider?.value || '1.0');
      const st = parseFloat(this.steerSlider?.value || '1.0');
      if (valSmile) valSmile.textContent = `${s.toFixed(2)}x`;
      if (valOpen) valOpen.textContent = `${o.toFixed(2)}x`;
      if (valSteer) valSteer.textContent = `${st.toFixed(2)}x`;

      if (this.visionManager) {
        this.visionManager.updateSensitivities(s, o, st);
      }
    };

    this.smileSlider?.addEventListener('input', updateSens);
    this.openSlider?.addEventListener('input', updateSens);
    this.steerSlider?.addEventListener('input', updateSens);

    const btnResume = this.menuElement.querySelector('#ssr-pause-resume');
    btnResume?.addEventListener('click', () => {
      this.hide();
      this.callbacks.onResume();
    });

    const btnCalib = this.menuElement.querySelector('#ssr-pause-calib');
    btnCalib?.addEventListener('click', () => {
      if (this.visionManager && this.visionManager.getStatus() !== 'active') {
        if (this.noticeEl) {
          this.noticeEl.textContent = 'Enable Camera first to run 3-step face calibration.';
        }
        return;
      }
      if (this.noticeEl) this.noticeEl.textContent = '';
      this.callbacks.onStartCalibration();
    });

    this.cameraBtn?.addEventListener('click', async () => {
      if (this.noticeEl) this.noticeEl.textContent = '';
      if (this.callbacks.onToggleCamera) {
        await this.callbacks.onToggleCamera();
        this.syncCameraBtn();
      }
    });

    this.audioBtn?.addEventListener('click', () => {
      this.callbacks.onToggleAudio();
      this.syncAudioBtn();
    });
  }

  public syncCameraBtn(): void {
    if (!this.cameraBtn || !this.visionManager) return;
    const status = this.visionManager.getStatus();
    if (status === 'active') {
      this.cameraBtn.textContent = '📷 Camera: ON';
      this.cameraBtn.style.borderColor = '#00ff8c';
      this.cameraBtn.style.color = '#00ff8c';
    } else if (status === 'denied') {
      this.cameraBtn.textContent = '📷 Camera: Denied';
      this.cameraBtn.style.borderColor = '#ff5060';
      this.cameraBtn.style.color = '#ff5060';
    } else {
      this.cameraBtn.textContent = '📷 Enable Camera';
      this.cameraBtn.style.borderColor = '#00e6ff';
      this.cameraBtn.style.color = '#00e6ff';
    }
  }

  public syncAudioBtn(): void {
    if (!this.audioBtn || !this.audioManager) return;
    const isMuted = this.audioManager.isMuted();
    this.audioBtn.textContent = isMuted ? '🔇 Audio: Muted' : '🔊 Audio: Active';
    this.audioBtn.style.borderColor = isMuted ? '#ff5060' : '#00e6ff';
    this.audioBtn.style.color = isMuted ? '#ff5060' : '#00e6ff';
  }

  public show(): void {
    if (this.menuElement) {
      this.syncAudioBtn();
      this.syncCameraBtn();
      if (this.noticeEl) this.noticeEl.textContent = '';
      this.menuElement.style.display = 'flex';
      this.isVisible = true;
    }
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.isVisible = false;
    }
  }

  public isMenuOpen(): boolean {
    return this.isVisible;
  }
}
