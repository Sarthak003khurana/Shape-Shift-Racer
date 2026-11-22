/**
 * 4 Dynamic Synthwave Biomes:
 * Sunset Drive -> Cyber Night -> Neon Tokyo -> Plasma Storm
 * Cycles every 500 meters with smooth RGB lerping.
 */

import { BIOMES, BIOME_DISTANCE, BiomeConfig, RGBTuple } from '../config';

export function lerpColor(c1: RGBTuple, c2: RGBTuple, t: number): RGBTuple {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

export function toRgbString(c: RGBTuple, alpha?: number): string {
  const r = Math.max(0, Math.min(255, Math.round(c[0])));
  const g = Math.max(0, Math.min(255, Math.round(c[1])));
  const b = Math.max(0, Math.min(255, Math.round(c[2])));
  if (alpha !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export class BiomeManager {
  public biomeIdx: number = 0;
  public palette: Record<keyof Omit<BiomeConfig, 'name'>, RGBTuple>;

  constructor() {
    const initial = BIOMES[0];
    this.palette = {
      sky_top: [...initial.sky_top],
      sky_bottom: [...initial.sky_bottom],
      sun: [...initial.sun],
      sun_glow: [...initial.sun_glow],
      mountain: [...initial.mountain],
      ground: [...initial.ground],
      asphalt_a: [...initial.asphalt_a],
      asphalt_b: [...initial.asphalt_b],
      curb_light: [...initial.curb_light],
      curb_dark: [...initial.curb_dark],
      accent: [...initial.accent],
    };
  }

  public reset(): void {
    this.biomeIdx = 0;
    const initial = BIOMES[0];
    for (const key of Object.keys(this.palette) as (keyof typeof this.palette)[]) {
      this.palette[key] = [...initial[key]];
    }
  }

  public get currentBiomeName(): string {
    return BIOMES[this.biomeIdx].name;
  }

  public get accentRgb(): RGBTuple {
    return this.palette.accent;
  }

  public get accentColor(): string {
    return toRgbString(this.palette.accent);
  }

  public update(dt: number, distanceMeters: number): { biomeName: string; biomeChanged: boolean } {
    const newIdx = Math.floor(distanceMeters / BIOME_DISTANCE) % BIOMES.length;
    const biomeChanged = newIdx !== this.biomeIdx;
    this.biomeIdx = newIdx;

    const targetBiome = BIOMES[this.biomeIdx];
    const blend = Math.min(1.0, 2.2 * dt);

    for (const key of Object.keys(this.palette) as (keyof typeof this.palette)[]) {
      this.palette[key] = lerpColor(this.palette[key], targetBiome[key], blend);
    }

    return {
      biomeName: targetBiome.name,
      biomeChanged,
    };
  }
}
