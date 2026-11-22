/**
 * Web Audio Manager for Shape-Shift Racer.
 * Handles AudioContext lifecycle, autoplay policy unlock on user gesture,
 * pre-rendered procedural AudioBuffers for 8 SFX and 120 BPM Synthwave music loop,
 * gain routing (master, music, SFX), and persistent mute settings.
 */

import {
  DEFAULT_SAMPLE_RATE,
  synthesizeMorph,
  synthesizeClear,
  synthesizeCoin,
  synthesizeStreak,
  synthesizeNearMiss,
  synthesizeBiome,
  synthesizeCrash,
  synthesizeCalibrated,
  synthesizeJump,
  synthesizeShield,
  synthesizeSynthwaveLoop,
} from './synth';
import { loadSettings, saveSettings } from '../core/storage';

export type SoundEffect =
  | 'morph'
  | 'clear'
  | 'coin'
  | 'streak'
  | 'near_miss'
  | 'biome'
  | 'crash'
  | 'calibrated'
  | 'jump'
  | 'shield';

export interface AudioManager {
  init(): Promise<void>;
  playSfx(sfx: SoundEffect): void;
  startMusic(): void;
  stopMusic(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export class WebAudioManager implements AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private sfxBuffers: Map<SoundEffect, AudioBuffer> = new Map();
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;

  private isInitialized: boolean = false;
  private isMusicPlaying: boolean = false;
  private muted: boolean = false;

  private musicVolume: number = 0.28;
  private sfxVolume: number = 1.0;

  constructor() {
    // Read persistent setting (music_enabled)
    const settings = loadSettings();
    this.muted = !settings.music_enabled;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // Check for AudioContext availability in window
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;

    if (!AudioContextClass) {
      console.warn('[AudioManager] Web Audio API is not supported in this environment.');
      return;
    }

    try {
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn('[AudioManager] Failed to create AudioContext:', e);
      return;
    }

    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate || DEFAULT_SAMPLE_RATE;

    // Create Audio Nodes
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0.0 : 1.0, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // Pre-render all 8 SFX buffers (<10ms total execution)
    this.renderSfxBuffer('morph', synthesizeMorph(sampleRate), sampleRate);
    this.renderSfxBuffer('clear', synthesizeClear(sampleRate), sampleRate);
    this.renderSfxBuffer('coin', synthesizeCoin(sampleRate), sampleRate);
    this.renderSfxBuffer('streak', synthesizeStreak(sampleRate), sampleRate);
    this.renderSfxBuffer('near_miss', synthesizeNearMiss(sampleRate), sampleRate);
    this.renderSfxBuffer('biome', synthesizeBiome(sampleRate), sampleRate);
    this.renderSfxBuffer('crash', synthesizeCrash(sampleRate), sampleRate);
    this.renderSfxBuffer('calibrated', synthesizeCalibrated(sampleRate), sampleRate);
    this.renderSfxBuffer('jump', synthesizeJump(sampleRate), sampleRate);
    this.renderSfxBuffer('shield', synthesizeShield(sampleRate), sampleRate);

    // Pre-render Synthwave music loop (8.0s)
    const musicPcm = synthesizeSynthwaveLoop(sampleRate, 1.0);
    this.musicBuffer = ctx.createBuffer(1, musicPcm.length, sampleRate);
    this.musicBuffer.getChannelData(0).set(musicPcm);

    // Register user gesture listener to automatically unlock suspended audio context
    this.setupGestureUnlock();

    this.isInitialized = true;
    console.log('[AudioManager] Procedural SFX & Synthwave soundtrack pre-rendered successfully.');
  }

  private renderSfxBuffer(name: SoundEffect, pcm: Float32Array, sampleRate: number): void {
    if (!this.ctx) return;
    const buffer = this.ctx.createBuffer(1, pcm.length, sampleRate);
    buffer.getChannelData(0).set(pcm);
    this.sfxBuffers.set(name, buffer);
  }

  private setupGestureUnlock(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  /**
   * Resumes AudioContext if suspended by browser autoplay policy.
   */
  public async unlock(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[AudioManager] Failed to resume AudioContext:', err);
      }
    }
  }

  /**
   * Starts looping the 8.0s Synthwave soundtrack.
   */
  public startMusic(): void {
    if (!this.ctx || !this.musicBuffer || this.isMusicPlaying) return;

    // Ensure context is running
    if (this.ctx.state === 'suspended') {
      this.unlock();
    }

    try {
      this.musicSource = this.ctx.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.loop = true;
      if (this.musicGain) {
        this.musicSource.connect(this.musicGain);
      }
      this.musicSource.start(0);
      this.isMusicPlaying = true;
    } catch (err) {
      console.warn('[AudioManager] Failed to start music:', err);
    }
  }

  /**
   * Stops/pauses the looping Synthwave soundtrack.
   */
  public stopMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch (_) {
        // Source may already have stopped
      }
      this.musicSource = null;
    }
    this.isMusicPlaying = false;
  }

  /**
   * Plays a pre-rendered one-shot procedural SFX.
   */
  public playSfx(sfx: SoundEffect): void {
    if (!this.ctx || this.muted) return;

    const buffer = this.sfxBuffers.get(sfx);
    if (!buffer) return;

    if (this.ctx.state === 'suspended') {
      this.unlock();
    }

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      if (this.sfxGain) {
        source.connect(this.sfxGain);
      }
      source.start(0);
      source.onended = () => {
        try {
          source.disconnect();
        } catch (_) {}
      };
    } catch (err) {
      console.warn(`[AudioManager] Error playing SFX '${sfx}':`, err);
    }
  }

  /**
   * Sets mute state and persists in localStorage.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0.0 : 1.0, this.ctx.currentTime);
    }

    const settings = loadSettings();
    settings.music_enabled = !muted;
    saveSettings(settings);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Toggles audio mute state.
   */
  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (_) {}
      this.ctx = null;
    }
    this.sfxBuffers.clear();
    this.musicBuffer = null;
    this.isInitialized = false;
  }
}
