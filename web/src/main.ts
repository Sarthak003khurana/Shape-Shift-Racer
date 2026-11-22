/**
 * Main Application Entry Point:
 * Mounts canvas, establishes 1280x720 high-DPI scaling (capped at 2.0 DPR),
 * handles responsive viewport letterboxing, initializes GameEngine,
 * and bootstraps EEA/UK Cookie Consent + feature-flagged AdManager.
 */

import { SCREEN_WIDTH, SCREEN_HEIGHT } from './config';
import { GameEngine } from './core/engine';
import { initSiteCompliance } from './compliance/init_site_compliance';

export function setupCanvasScaler(canvas: HTMLCanvasElement): () => void {
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    canvas.width = Math.floor(SCREEN_WIDTH * dpr);
    canvas.height = Math.floor(SCREEN_HEIGHT * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    }
  };

  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}

function init(): GameEngine | null {
  // Always bootstrap cookie consent + feature-flagged (off by default) ad gating
  initSiteCompliance();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    return null;
  }

  setupCanvasScaler(canvas);
  const engine = new GameEngine(canvas);
  engine.init();

  console.log('[ShapeShiftRacer] Core 2.5D Game Engine initialized successfully.');
  return engine;
}

// Auto-start when DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}
