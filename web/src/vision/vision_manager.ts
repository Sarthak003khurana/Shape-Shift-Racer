/**
 * Unified Vision Manager.
 * Orchestrates camera stream lifecycle, MediaPipe Face Landmarker inference,
 * Vision Processor, Calibration, Privacy UI, and feeds input into ControlsManager.
 */

import { CarShapeKey } from '../config';
import { FaceLandmarkerService, RawVisionFrame } from './landmarker';
import { VisionProcessor, VisionState } from './processor';
import { CalibrationManager, CalibrationStep } from './calibration';
import { PrivacyModalUI } from '../ui/privacy_modal';
import { loadSettings, saveSettings } from '../core/storage';

export type CameraStatus = 'off' | 'active' | 'denied' | 'unsupported';

export interface VisionOutput {
  steerNormX: number | null;
  detectedShape: CarShapeKey | null;
  jumpTriggered: boolean;
  shieldTriggered: boolean;
  isFacePresent: boolean;
  isTracking: boolean;
  cameraStatus: CameraStatus;
  smileIntensity: number;
  openIntensity: number;
  browIntensity: number;
  yawDeg: number;
  rollDeg: number;
}

export class VisionManager {
  private container: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarkerService: FaceLandmarkerService;
  private processor: VisionProcessor;
  private calibration: CalibrationManager;
  private privacyUI: PrivacyModalUI;

  private cameraStatus: CameraStatus = 'off';
  private isRunning: boolean = false;
  private lastVisionState: VisionState | null = null;

  // Audio callback for chime triggering during calibration
  private onChimeTrigger?: (chime: 'calibrated') => void;

  constructor() {
    this.landmarkerService = new FaceLandmarkerService();
    this.processor = new VisionProcessor();
    this.calibration = new CalibrationManager();
    this.privacyUI = new PrivacyModalUI();

    // Load saved settings
    const settings = loadSettings();
    this.processor.setSensitivities(
      settings.smile_sensitivity,
      settings.open_sensitivity,
      settings.steer_sensitivity
    );

    // Apply saved calibration baselines
    this.processor.setBaselines(this.calibration.getBaselines());
  }

  public setAudioChimeCallback(cb: (chime: 'calibrated') => void): void {
    this.onChimeTrigger = cb;
  }

  public getProcessor(): VisionProcessor {
    return this.processor;
  }

  public getCalibration(): CalibrationManager {
    return this.calibration;
  }

  public getStatus(): CameraStatus {
    return this.cameraStatus;
  }

  public isModalOpen(): boolean {
    return this.privacyUI.isModalVisible();
  }

  public init(container: HTMLElement): void {
    this.container = container;
    this.calibration.setCallbacks({
      onStepStart: (step: CalibrationStep, prompt: string) => {
        this.privacyUI.showCalibrationOverlay(step, prompt);
      },
      onStepProgress: (_step: CalibrationStep, remainingSec: number) => {
        const percent = ((2.2 - remainingSec) / 2.2) * 100.0;
        this.privacyUI.updateCalibrationProgress(percent);
      },
      onStepComplete: (_step: CalibrationStep) => {
        if (this.onChimeTrigger) {
          this.onChimeTrigger('calibrated');
        }
      },
      onFinished: (baselines) => {
        this.processor.setBaselines(baselines);
        this.privacyUI.hideCalibrationOverlay();
        if (this.onChimeTrigger) {
          this.onChimeTrigger('calibrated');
        }
      },
      onCancel: () => {
        this.privacyUI.hideCalibrationOverlay();
      },
    });

    this.privacyUI.mount(container, {
      onEnableCamera: () => {
        this.startCamera().catch((err) => {
          console.warn('[VisionManager] Camera startup rejected/failed:', err);
        });
      },
      onSkipCamera: () => {
        this.cameraStatus = 'off';
        this.privacyUI.showStatusBadge('Keyboard & Touch Controls Active');
      },
      onCancelCalibration: () => {
        this.calibration.cancelInteractiveCalibration();
      },
    });
  }

  public async startCamera(): Promise<boolean> {
    if (this.cameraStatus === 'active') return true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[VisionManager] mediaDevices.getUserMedia not supported on this platform');
      this.cameraStatus = 'unsupported';
      const isHttpOnRemote =
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        window.location.protocol === 'http:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';
      const msg = isHttpOnRemote
        ? 'HTTPS required for mobile camera (use https:// or deploy to Vercel)'
        : 'Camera unsupported - Keyboard & Touch Active';
      this.privacyUI.showStatusBadge(msg);
      return false;
    }

    try {
      this.privacyUI.showStatusBadge('Initializing AI Vision Engine...');
      const ready = await this.landmarkerService.init();
      if (!ready) {
        this.cameraStatus = 'unsupported';
        this.privacyUI.showStatusBadge('Vision engine fallback - Keyboard & Touch Active');
        return false;
      }

      // Mobile Performance Tuning: Use 320x240 ideal constraints on mobile to minimize CPU/GPU load
      const isMobile =
        typeof navigator !== 'undefined' &&
        (/Android|iPhone|iPad|iPod|Windows Phone|webOS/i.test(navigator.userAgent || '') ||
          (typeof window !== 'undefined' && 'ontouchstart' in window));
      const idealWidth = isMobile ? 320 : 480;
      const idealHeight = isMobile ? 240 : 360;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          facingMode: 'user',
        },
        audio: false,
      });

      this.stream = stream;
      if (!this.video) {
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', 'true');
        this.video.setAttribute('webkit-playsinline', 'true');
        (this.video as any).playsInline = true;
        this.video.setAttribute('autoplay', 'true');
        this.video.muted = true;
        this.video.setAttribute('muted', 'true');
        // iOS Safari requires non-zero size so hardware video decoder stays active
        this.video.style.position = 'fixed';
        this.video.style.top = '-9999px';
        this.video.style.left = '-9999px';
        this.video.style.width = `${idealWidth}px`;
        this.video.style.height = `${idealHeight}px`;
        this.video.style.opacity = '0.001';
        this.video.style.pointerEvents = 'none';
        if (this.container) {
          this.container.appendChild(this.video);
        }
      }

      this.video.srcObject = stream;
      // Wait for metadata so videoWidth / videoHeight are non-zero before playback
      await new Promise<void>((resolve) => {
        if (this.video!.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
        } else {
          this.video!.onloadedmetadata = () => resolve();
        }
      });
      await this.video.play();

      this.cameraStatus = 'active';
      this.isRunning = true;
      this.calibration.resetAutoZero();
      this.privacyUI.showPipHud();
      this.privacyUI.showStatusBadge('Facial & Head Pose Tracking Active');

      return true;
    } catch (err: any) {
      console.warn('[VisionManager] User denied camera or device unavailable:', err);
      this.cameraStatus = 'denied';
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera Permission Denied in Settings'
          : 'Camera unavailable - Keyboard & Touch Active';
      this.privacyUI.showStatusBadge(msg);
      return false;
    }
  }

  public stopCamera(): void {
    this.isRunning = false;
    this.cameraStatus = 'off';

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.privacyUI.hidePipHud();
    this.privacyUI.showStatusBadge('Keyboard & Touch Controls Active');
  }

  public startInteractiveCalibration(): boolean {
    if (this.cameraStatus !== 'active') {
      this.privacyUI.showStatusBadge('Enable Camera first to run 3-step face calibration');
      return false;
    }
    this.calibration.startInteractiveCalibration();
    return true;
  }

  /**
   * Update method called every frame from GameEngine update loop.
   */
  public update(dt: number): VisionOutput {
    if (this.cameraStatus !== 'active' || !this.video || !this.isRunning) {
      return {
        steerNormX: null,
        detectedShape: null,
        jumpTriggered: false,
        shieldTriggered: false,
        isFacePresent: false,
        isTracking: false,
        cameraStatus: this.cameraStatus,
        smileIntensity: 0.0,
        openIntensity: 0.0,
        browIntensity: 0.0,
        yawDeg: 0.0,
        rollDeg: 0.0,
      };
    }

    // 1. Throttled 20-30 Hz inference
    const nowMs = performance.now();
    const frame: RawVisionFrame | null = this.landmarkerService.detectVideoFrame(
      this.video,
      nowMs
    );

    if (frame) {
      const nowSec = nowMs / 1000.0;
      const state = this.processor.processFrame(
        frame.blendshapes,
        frame.matrix,
        frame.landmarks,
        nowSec
      );
      this.lastVisionState = state;

      if (state.faceDetected) {
        const sample = {
          smileRaw: state.smileRaw,
          openRaw: state.openRaw,
          yawDeg: state.yawDeg,
          rollDeg: state.rollDeg,
        };

        // Auto-zero fast 1-step calibration
        this.calibration.feedAutoZeroFrame(sample);

        // 3-step interactive wizard if active
        if (this.calibration.isCalibrating()) {
          this.calibration.update(dt, sample);
        }
      }
    } else if (this.calibration.isCalibrating()) {
      this.calibration.update(dt, null);
    }

    // Render PiP HUD
    this.privacyUI.renderPip(this.video, this.lastVisionState);

    const s = this.lastVisionState;
    if (s && s.faceDetected) {
      return {
        steerNormX: s.steerNormX,
        detectedShape: s.activeShape,
        jumpTriggered: s.jumpTriggered,
        shieldTriggered: s.shieldTriggered,
        isFacePresent: true,
        isTracking: true,
        cameraStatus: this.cameraStatus,
        smileIntensity: s.smoothSmile,
        openIntensity: s.smoothOpen,
        browIntensity: s.smoothBrow,
        yawDeg: s.yawDeg,
        rollDeg: s.rollDeg,
      };
    }

    return {
      steerNormX: null,
      detectedShape: null,
      jumpTriggered: false,
      shieldTriggered: false,
      isFacePresent: false,
      isTracking: true,
      cameraStatus: this.cameraStatus,
      smileIntensity: 0.0,
      openIntensity: 0.0,
      browIntensity: 0.0,
      yawDeg: 0.0,
      rollDeg: 0.0,
    };
  }

  public updateSensitivities(smile: number, open: number, steer: number): void {
    this.processor.setSensitivities(smile, open, steer);
    const settings = loadSettings();
    settings.smile_sensitivity = smile;
    settings.open_sensitivity = open;
    settings.steer_sensitivity = steer;
    saveSettings(settings);
  }

  public destroy(): void {
    this.stopCamera();
    this.landmarkerService.destroy();
  }
}
