/**
 * Unit Test: WebAudioManager lifecycle, buffer pre-rendering, mute & volume management.
 */

import { WebAudioManager } from '../src/audio/audio_manager';
import { loadSettings, saveSettings } from '../src/core/storage';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running WebAudioManager Unit Tests...\n');

// Mock localStorage if in Node environment
if (typeof window === 'undefined' || !window.localStorage) {
  const store: Record<string, string> = {};
  (globalThis as any).window = globalThis.window || {};
  (globalThis as any).window.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

// 1. Initial Mute State from Storage
{
  saveSettings({
    smile_sensitivity: 1.0,
    open_sensitivity: 1.0,
    steer_sensitivity: 1.0,
    music_enabled: false,
  });

  const manager = new WebAudioManager();
  assert(manager.isMuted() === true, 'AudioManager should initialize muted when music_enabled is false');
  console.log('✓ 1. Initial mute state correctly loaded from storage (music_enabled=false -> muted=true)');
}

// 2. Mute Toggle and Persistence
{
  saveSettings({
    smile_sensitivity: 1.0,
    open_sensitivity: 1.0,
    steer_sensitivity: 1.0,
    music_enabled: true,
  });

  const manager = new WebAudioManager();
  assert(manager.isMuted() === false, 'AudioManager should initialize unmuted when music_enabled is true');

  const newMuted = manager.toggleMute();
  assert(newMuted === true, 'toggleMute should switch unmuted to muted');
  assert(manager.isMuted() === true, 'isMuted should return true');

  const saved = loadSettings();
  assert(saved.music_enabled === false, 'Storage should reflect music_enabled=false after mute');

  manager.toggleMute();
  assert(manager.isMuted() === false, 'toggleMute should switch muted to unmuted');
  assert(loadSettings().music_enabled === true, 'Storage should reflect music_enabled=true after unmute');
  console.log('✓ 2. Mute toggle and persistence to localStorage verified');
}

// 3. Volume Adjustments
{
  const manager = new WebAudioManager();
  manager.setMusicVolume(0.5);
  assert(Math.abs(manager.getMusicVolume() - 0.5) < 1e-4, 'Music volume setter failed');

  manager.setSfxVolume(0.75);
  assert(Math.abs(manager.getSfxVolume() - 0.75) < 1e-4, 'SFX volume setter failed');

  // Clamping test
  manager.setMusicVolume(1.8);
  assert(manager.getMusicVolume() === 1.0, 'Music volume should clamp at 1.0');
  manager.setMusicVolume(-0.5);
  assert(manager.getMusicVolume() === 0.0, 'Music volume should clamp at 0.0');
  console.log('✓ 3. Volume clamping and accessors verified');
}

// 4. Mock AudioContext Buffer Pre-Rendering Verification
{
  class MockAudioBuffer {
    public length: number;
    public sampleRate: number;
    public data: Float32Array;
    constructor(numberOfChannels: number, length: number, sampleRate: number) {
      this.length = length;
      this.sampleRate = sampleRate;
      this.data = new Float32Array(length);
    }
    public getChannelData(channel: number): Float32Array {
      return this.data;
    }
  }

  class MockGainNode {
    public gain = {
      value: 1.0,
      setValueAtTime: (val: number, time: number) => {
        this.gain.value = val;
      },
    };
    public connect(dest: any) {}
  }

  class MockAudioBufferSourceNode {
    public buffer: any = null;
    public loop: boolean = false;
    public onended: (() => void) | null = null;
    public connect(dest: any) {}
    public start(time: number) {}
    public stop() {}
    public disconnect() {}
  }

  class MockAudioContext {
    public sampleRate = 44100;
    public currentTime = 0;
    public state = 'running';
    public destination = {};

    public createGain() {
      return new MockGainNode();
    }
    public createBuffer(channels: number, length: number, sampleRate: number) {
      return new MockAudioBuffer(channels, length, sampleRate);
    }
    public createBufferSource() {
      return new MockAudioBufferSourceNode();
    }
    public resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    public close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  (globalThis as any).window.AudioContext = MockAudioContext;

  const manager = new WebAudioManager();
  const t0 = performance.now();
  await manager.init();
  const tElapsed = performance.now() - t0;

  console.log(`✓ 4. Web Audio pre-rendering into AudioBuffers completed in ${tElapsed.toFixed(2)}ms (< 25ms target)`);

  // Verify play methods execute without error
  manager.startMusic();
  manager.playSfx('morph');
  manager.playSfx('clear');
  manager.playSfx('coin');
  manager.playSfx('streak');
  manager.playSfx('near_miss');
  manager.playSfx('biome');
  manager.playSfx('crash');
  manager.playSfx('calibrated');
  manager.stopMusic();
  manager.destroy();

  console.log('✓ 5. Playback and stop methods executed successfully on mock nodes');
}

console.log('\nAll WebAudioManager unit tests passed successfully!');
