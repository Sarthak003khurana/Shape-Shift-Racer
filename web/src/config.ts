/**
 * Shape-Shift Racer Configuration & Constants
 * Ported with exact mathematical parity from Python reference implementation.
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export type RGBTuple = [number, number, number];

export interface CarShapeConfig {
  width: number;
  height: number;
  color_primary: RGBTuple;
  color_accent: RGBTuple;
  name: string;
  description: string;
}

export type CarShapeKey = 'NORMAL' | 'FLAT' | 'NARROW';

export interface BiomeConfig {
  name: string;
  sky_top: RGBTuple;
  sky_bottom: RGBTuple;
  sun: RGBTuple;
  sun_glow: RGBTuple;
  mountain: RGBTuple;
  ground: RGBTuple;
  asphalt_a: RGBTuple;
  asphalt_b: RGBTuple;
  curb_light: RGBTuple;
  curb_dark: RGBTuple;
  accent: RGBTuple;
}

// Screen & Coordinate Reference
export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;
export const FPS = 60;
export const TITLE = 'Shape-Shift Racer by Sarthak';

// 2.5D Road Geometry
export const HORIZON_Y = Math.floor(SCREEN_HEIGHT * 0.44); // 316
export const ROAD_BOTTOM_WIDTH = Math.floor(SCREEN_WIDTH * 0.78); // 998
export const ROAD_TOP_WIDTH = Math.floor(SCREEN_WIDTH * 0.12); // 153
export const ROAD_LEFT_BOTTOM = Math.floor((SCREEN_WIDTH - ROAD_BOTTOM_WIDTH) / 2); // 141
export const ROAD_RIGHT_BOTTOM = ROAD_LEFT_BOTTOM + ROAD_BOTTOM_WIDTH; // 1139
export const ROAD_LEFT_TOP = Math.floor((SCREEN_WIDTH - ROAD_TOP_WIDTH) / 2); // 563
export const ROAD_RIGHT_TOP = ROAD_LEFT_TOP + ROAD_TOP_WIDTH; // 716
export const NUM_LANES = 3;

// Lane centers in normalized road coordinates (-1.0 to 1.0)
export const LANE_X: Record<number, number> = {
  0: -0.55,
  1: 0.0,
  2: 0.55,
};

// Camera & Perspective
export const CAMERA_DEPTH = 300.0;
export const MAX_Z = 1200.0;
export const CAR_Z = 40.0;

// Vehicle Morphing Dimensions (px at CAR_Z)
export const CAR_SHAPES: Record<CarShapeKey, CarShapeConfig> = {
  NORMAL: {
    width: 84,
    height: 50,
    color_primary: [0, 210, 255], // Neon Cyan
    color_accent: [255, 255, 255],
    name: 'CRUISER',
    description: 'Standard Balanced',
  },
  FLAT: {
    width: 136,
    height: 22,
    color_primary: [255, 0, 128], // Neon Hot Pink
    color_accent: [255, 240, 100],
    name: 'LOW-RIDER',
    description: 'Ultra-Flat (Under Low Beams)',
  },
  NARROW: {
    width: 32,
    height: 100,
    color_primary: [0, 255, 140], // Neon Lime Green
    color_accent: [100, 255, 255],
    name: 'SLIM-BLADE',
    description: 'Ultra-Narrow (Through Pillar Slits)',
  },
};

// Clearance Dimensions for Obstacle Gaps (at CAR_Z)
export const LOW_BEAM_GAP_HEIGHT = 30; // Only FLAT (h=22) fits; NORMAL (h=50) & NARROW (h=100) crash
export const PILLAR_GAP_WIDTH = 48; // Only NARROW (w=32) fits; NORMAL (w=84) & FLAT (w=136) crash

// Speeds & Multipliers
export const BASE_SPEED = 420.0;
export const SPEED_INCREMENT = 10.0;
export const MAX_SPEED = 920.0;
export const STEER_SPEED = 6.0;

// Scoring
export const OBSTACLE_BASE_POINTS = 100;
export const COIN_BASE_POINTS = 50;
export const NEAR_MISS_BONUS = 50;

// Streak Multiplier Tiers: [min_streak, multiplier]
export const STREAK_TIERS: [number, number][] = [
  [10, 5],
  [6, 3],
  [3, 2],
  [0, 1],
];

export function getMultiplierForStreak(streak: number): number {
  for (const [minStreak, mult] of STREAK_TIERS) {
    if (streak >= minStreak) {
      return mult;
    }
  }
  return 1;
}

// 4 Dynamic Biomes
export const BIOME_DISTANCE = 500.0;
export const BIOMES: BiomeConfig[] = [
  {
    name: 'SUNSET DRIVE',
    sky_top: [15, 5, 32],
    sky_bottom: [62, 16, 72],
    sun: [255, 215, 0],
    sun_glow: [255, 90, 40],
    mountain: [36, 12, 52],
    ground: [12, 8, 22],
    asphalt_a: [28, 22, 42],
    asphalt_b: [22, 16, 34],
    curb_light: [255, 40, 120],
    curb_dark: [42, 20, 72],
    accent: [0, 230, 255],
  },
  {
    name: 'CYBER NIGHT',
    sky_top: [4, 10, 28],
    sky_bottom: [14, 38, 80],
    sun: [0, 235, 255],
    sun_glow: [0, 120, 255],
    mountain: [10, 22, 48],
    ground: [5, 10, 20],
    asphalt_a: [18, 26, 44],
    asphalt_b: [13, 20, 35],
    curb_light: [0, 220, 255],
    curb_dark: [18, 42, 85],
    accent: [0, 255, 200],
  },
  {
    name: 'NEON TOKYO',
    sky_top: [8, 22, 28],
    sky_bottom: [22, 62, 58],
    sun: [120, 255, 170],
    sun_glow: [255, 40, 160],
    mountain: [14, 36, 42],
    ground: [8, 16, 18],
    asphalt_a: [22, 34, 38],
    asphalt_b: [16, 26, 30],
    curb_light: [50, 255, 140],
    curb_dark: [70, 18, 68],
    accent: [255, 60, 180],
  },
  {
    name: 'PLASMA STORM',
    sky_top: [28, 4, 14],
    sky_bottom: [85, 18, 28],
    sun: [255, 120, 20],
    sun_glow: [255, 30, 50],
    mountain: [48, 10, 20],
    ground: [20, 6, 10],
    asphalt_a: [38, 18, 26],
    asphalt_b: [28, 12, 18],
    curb_light: [255, 200, 0],
    curb_dark: [95, 16, 24],
    accent: [255, 210, 40],
  },
];

// Persistence Keys & Defaults
export const HIGHSCORES_KEY = 'ssr_highscores';
export const SETTINGS_KEY = 'ssr_settings';
export const MAX_HIGHSCORES = 5;

export interface GameSettings {
  smile_sensitivity: number;
  open_sensitivity: number;
  steer_sensitivity: number;
  music_enabled: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  smile_sensitivity: 1.0,
  open_sensitivity: 1.0,
  steer_sensitivity: 1.0,
  music_enabled: true,
};

// Branding & Contact
export const CONTACT_EMAIL = 'shapeshifttracer@gmail.com';

// Feature Flags & AdSense Configuration (Milestone 4)
// Ads remain strictly disabled and hidden until explicitly switched on AFTER AdSense approval.
const envMeta =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env
    ? (import.meta as unknown as { env: Record<string, string> }).env
    : {};

export const ADS_ENABLED: boolean = envMeta.VITE_ADS_ENABLED === 'true';
export const SHOW_ADS: boolean = envMeta.VITE_SHOW_ADS === 'true';
export const ADSENSE_CLIENT_ID: string = envMeta.VITE_ADSENSE_CLIENT_ID || 'ca-pub-4627783195003112';
export const CONSENT_STORAGE_KEY = 'ssr_cookie_consent_v1';
export const ADSENSE_TEST_MODE: boolean = envMeta.VITE_ADSENSE_TEST_MODE === 'true';

export interface AdSlotConfig {
  id: string;
  slotId: string;
  format: 'horizontal' | 'rectangle' | 'auto';
  label: string;
}

export const AD_SLOTS: Record<'menu' | 'gameOver' | 'belowGame' | 'editorialMid', AdSlotConfig> = {
  menu: {
    id: 'ssr-ad-slot-menu',
    slotId: envMeta.VITE_ADSENSE_SLOT_MENU || '7772868480',
    format: 'horizontal',
    label: 'Advertisement',
  },
  gameOver: {
    id: 'ssr-ad-slot-gameover',
    slotId: envMeta.VITE_ADSENSE_SLOT_GAMEOVER || '7772868480',
    format: 'rectangle',
    label: 'Advertisement',
  },
  belowGame: {
    id: 'ssr-ad-slot-below-game',
    slotId: envMeta.VITE_ADSENSE_SLOT_BELOW_GAME || '7772868480',
    format: 'horizontal',
    label: 'Advertisement',
  },
  editorialMid: {
    id: 'ssr-ad-slot-editorial-mid',
    slotId: envMeta.VITE_ADSENSE_SLOT_EDITORIAL_MID || '7772868480',
    format: 'auto',
    label: 'Advertisement',
  },
};
