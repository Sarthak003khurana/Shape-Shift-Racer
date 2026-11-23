/**
 * Self-Hosted MediaPipe Face Landmarker Wrapper.
 * Loads vision WASM and face_landmarker.task from local static assets.
 * Operates at 20-30 Hz throttled inference decoupled from the 60 FPS Canvas render loop.
 */

import type { FaceLandmarker as FaceLandmarkerType, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { resolveAssetUrl } from '../core/assets';

export interface RawVisionFrame {
  blendshapes: Record<string, number> | null;
  matrix: number[] | null;
  landmarks: { x: number; y: number; z: number }[] | null;
  timestampMs: number;
}

export class FaceLandmarkerService {
  private landmarker: FaceLandmarkerType | null = null;
  private visionFileset: any = null;
  private modelPath: string = '';
  private activeDelegate: 'GPU' | 'CPU' | null = null;
  private isInitializing: boolean = false;
  private isProcessing: boolean = false;
  private lastInferenceTime: number = 0;
  private lastTimestampMs: number = 0;
  private readonly minInferenceIntervalMs: number = 33.3; // ~30 Hz cap

  private resolveAssetUrl(relativePath: string): string {
    return resolveAssetUrl(relativePath);
  }

  public async init(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      const wasmPath = this.resolveAssetUrl('mediapipe/wasm');
      this.modelPath = this.resolveAssetUrl('mediapipe/models/face_landmarker.task');

      console.log(`[FaceLandmarker] Initializing WASM from: ${wasmPath}`);
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      this.visionFileset = await FilesetResolver.forVisionTasks(wasmPath);

      // Attempt GPU delegate first, fallback to CPU
      try {
        console.log('[FaceLandmarker] Attempting GPU delegate initialization...');
        this.landmarker = await FaceLandmarker.createFromOptions(this.visionFileset, {
          baseOptions: {
            modelAssetPath: this.modelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        this.activeDelegate = 'GPU';
        console.log('[FaceLandmarker] GPU delegate initialized successfully.');
      } catch (gpuErr) {
        console.warn('[FaceLandmarker] GPU delegate failed, falling back to CPU:', gpuErr);
        this.landmarker = await FaceLandmarker.createFromOptions(this.visionFileset, {
          baseOptions: {
            modelAssetPath: this.modelPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        this.activeDelegate = 'CPU';
        console.log('[FaceLandmarker] CPU delegate initialized successfully.');
      }

      this.isInitializing = false;
      return true;
    } catch (err) {
      this.isInitializing = false;
      console.error('[FaceLandmarker] Failed to initialize MediaPipe Face Landmarker:', err);
      return false;
    }
  }

  private async fallbackToCpuDelegate(): Promise<void> {
    if (this.activeDelegate === 'CPU' || this.isInitializing || !this.visionFileset) return;
    this.isInitializing = true;
    try {
      if (this.landmarker) {
        try {
          this.landmarker.close();
        } catch {
          // Ignore close errors
        }
        this.landmarker = null;
      }
      console.warn('[FaceLandmarker] Runtime GPU error detected; switching to CPU delegate...');
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      this.landmarker = await FaceLandmarker.createFromOptions(this.visionFileset, {
        baseOptions: {
          modelAssetPath: this.modelPath,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      this.activeDelegate = 'CPU';
      console.log('[FaceLandmarker] Switched to CPU delegate successfully.');
    } catch (err) {
      console.error('[FaceLandmarker] CPU fallback initialization failed:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Run inference on video frame throttled to 20-30 Hz.
   */
  public detectVideoFrame(
    video: HTMLVideoElement,
    nowMs: number = performance.now()
  ): RawVisionFrame | null {
    if (!this.landmarker || this.isProcessing || this.isInitializing) return null;
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return null;
    }

    if (nowMs - this.lastInferenceTime < this.minInferenceIntervalMs) {
      return null;
    }

    this.isProcessing = true;
    try {
      // MediaPipe requires strictly increasing integer millisecond timestamps in VIDEO mode
      const timestampMs = Math.max(this.lastTimestampMs + 1, Math.round(nowMs));
      const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs);
      this.lastInferenceTime = nowMs;
      this.lastTimestampMs = timestampMs;

      let blendshapesRecord: Record<string, number> | null = null;
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        blendshapesRecord = {};
        for (const cat of result.faceBlendshapes[0].categories) {
          blendshapesRecord[cat.categoryName] = cat.score;
        }
      }

      let matrixValues: number[] | null = null;
      if (result.facialTransformationMatrixes && result.facialTransformationMatrixes.length > 0) {
        const mat = result.facialTransformationMatrixes[0];
        if (mat && (Array.isArray(mat.data) || ArrayBuffer.isView(mat.data))) {
          matrixValues = Array.from(mat.data as ArrayLike<number>);
        } else if (Array.isArray(mat) || ArrayBuffer.isView(mat)) {
          matrixValues = Array.from(mat as ArrayLike<number>);
        }
      }

      let landmarks: { x: number; y: number; z: number }[] | null = null;
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        landmarks = result.faceLandmarks[0].map((pt) => ({
          x: pt.x,
          y: pt.y,
          z: pt.z,
        }));
      }

      this.isProcessing = false;
      return {
        blendshapes: blendshapesRecord,
        matrix: matrixValues,
        landmarks,
        timestampMs,
      };
    } catch (e) {
      this.isProcessing = false;
      console.warn('[FaceLandmarker] Inference error:', e);
      if (this.activeDelegate === 'GPU') {
        void this.fallbackToCpuDelegate();
      }
      return null;
    }
  }

  public destroy(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (e) {
        console.warn('[FaceLandmarker] Error closing landmarker:', e);
      }
      this.landmarker = null;
    }
  }
}
