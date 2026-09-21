import { LightingPreset } from "./lightingPresets";

/**
 * Dedicated visual theme configuration for Chronos Corridor mini-game mode.
 * Kept completely independent from showcase mode's moody lighting presets,
 * specifically tuned for 60+ FPS gameplay clarity, contrast, and obstacle recognition.
 */
export interface GameThemeConfig {
  // Primary visual accents
  accentColor: string;
  accentSecondary: string;

  // High-contrast lane & corridor materials
  railColor: string;
  dividerColor: string;
  stripeColor: string;
  archColor: string;
  archGlowColor: string;

  // Obstacle warning aesthetics (clearly hazardous at high speed)
  hazardBaseColor: string;
  hazardEmissive: string;
  hazardEmissiveIntensity: number;
  spikeEmissive: string;
  spikeEmissiveIntensity: number;

  // Collectible colors
  coinColor: string;
  coinEmissive: string;

  // Dedicated gameplay lighting and atmosphere
  lightingPreset: LightingPreset;
}

export const GAME_MODE_THEME: GameThemeConfig = {
  accentColor: "#fbbf24",       // High-visibility Vivid Amber
  accentSecondary: "#f59e0b",   // Deep Amber Accent

  railColor: "#fbbf24",         // Saturated Amber outer corridor boundaries
  dividerColor: "#fcd34d",      // Sharp illuminated dividers separating all 3 lanes
  stripeColor: "#d97706",       // Scrolling ground ties
  archColor: "#1e2230",         // Structural caliber archways
  archGlowColor: "#fbbf24",     // Glowing horology indicator rings

  hazardBaseColor: "#1a1d24",   // Dark metallic gunmetal base
  hazardEmissive: "#ea580c",    // Warm red-orange rim/edge hazard warning
  hazardEmissiveIntensity: 0.65,
  spikeEmissive: "#ef4444",     // Vivid warning red for lethal spikes
  spikeEmissiveIntensity: 0.95,

  coinColor: "#dfa83e",         // Warm Clockwork Gold
  coinEmissive: "#f59e0b",

  lightingPreset: {
    id: "studio",
    name: "Chronos Corridor Game Theme",
    subtitle: "High Visibility Gameplay Arena",
    icon: "⚡",
    envPreset: "studio",
    envIntensity: 0.35,         // Low specular glare so obstacle silhouettes remain crisp
    keyLight: {
      color: "#ffffff",
      intensity: 3.8,           // Bright, even directional light from overhead-front
      position: [0, 20, 10],   // Positioned centered above all 3 lanes for uniform illumination
    },
    fillLight: {
      color: "#e2e8f0",
      intensity: 2.2,           // Balanced neutral fill across both shoulders
      position: [0, 14, -8],
    },
    rimLight: {
      color: "#fed7aa",         // Gentle warm rim
      intensity: 1.0,
      position: [0, 8, -20],
    },
    bounceLight: {
      color: "#0f172a",
      intensity: 0.5,
      position: [0, -6, 0],
    },
    ambientLight: {
      color: "#1e2438",         // Bright, even ambient base: eliminates dark shadow pockets
      intensity: 2.4,
    },
    hemisphereLight: {
      skyColor: "#2e3856",     // Indigo-tinted sky reflection
      groundColor: "#060810",   // Deep dark ground
      intensity: 1.6,
    },
    background: {
      color: "#05060f",         // Deep indigo / near-black high-contrast background
      fogNear: 32,              // Fog pushed back so distant obstacles have crisp silhouettes
      fogFar: 85,
    },
    bloom: {
      intensity: 0.22,           // Lower & tighter bloom so glow never washes out obstacles
      luminanceThreshold: 0.70, // Only intensely emissive elements bloom
    },
  },
};
