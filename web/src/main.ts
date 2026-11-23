/**
 * Main Application Entry Point:
 * Mounts canvas, establishes 1280x720 high-DPI scaling (capped at 2.0 DPR),
 * handles responsive viewport letterboxing, initializes GameEngine,
 * and bootstraps EEA/UK Cookie Consent + feature-flagged AdManager.
 */

import { SCREEN_WIDTH, SCREEN_HEIGHT } from './config';
import { GameEngine } from './core/engine';
import { initSiteCompliance } from './compliance/init_site_compliance';

export function setupCanvasScaler(
  canvas: HTMLCanvasElement,
  onResize?: (width: number, height: number) => void
): () => void {
  const resize = () => {
    const isMobilePortrait =
      typeof window !== 'undefined' &&
      window.innerWidth < window.innerHeight &&
      window.innerWidth <= 800;
    const targetW = isMobilePortrait ? 720 : SCREEN_WIDTH;
    const targetH = isMobilePortrait ? 1280 : SCREEN_HEIGHT;

    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.0);
    canvas.width = Math.floor(targetW * dpr);
    canvas.height = Math.floor(targetH * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    }

    if (onResize) {
      onResize(targetW, targetH);
    }
  };

  resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    }
  };
}

function init(): GameEngine | null {
  // Always bootstrap cookie consent + feature-flagged (off by default) ad gating
  initSiteCompliance();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    return null;
  }

  const engine = new GameEngine(canvas);
  setupCanvasScaler(canvas, (w, h) => {
    engine.setDimensions(w, h);
  });
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

  // Register PWA Service Worker in production
  if (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}
