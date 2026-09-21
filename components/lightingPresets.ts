import { PresetsType } from "@react-three/drei/helpers/environment-assets";

export type PresetKey = "studio" | "sunset" | "moonlight";

export interface LightingPreset {
  id: PresetKey;
  name: string;
  subtitle: string;
  icon: string;
  // drei <Environment> preset:
  // "studio" => Studio
  // "sunset" => Sunset
  // "night"  => Moonlight (closest high-quality starlit night hdri in @react-three/drei)
  envPreset: PresetsType;
  envIntensity: number;

  keyLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };

  rimLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };

  fillLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };

  bounceLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };

  ambientLight: {
    color: string;
    intensity: number;
  };

  hemisphereLight: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };

  background: {
    color: string;
    fogNear: number;
    fogFar: number;
  };

  bloom: {
    intensity: number;
    luminanceThreshold: number;
  };
}

export const LIGHTING_PRESETS: Record<PresetKey, LightingPreset> = {
  studio: {
    id: "studio",
    name: "Studio",
    subtitle: "Precision Horology Lab",
    icon: "💡",
    // Verified valid drei preset: "studio"
    envPreset: "studio",
    envIntensity: 0.85,
    keyLight: {
      color: "#fff6e8", // Warm white neutral
      intensity: 3.5,
      position: [12, 18, 14],
    },
    rimLight: {
      color: "#38bdf8", // Crisp metallic rim
      intensity: 3.0,
      position: [0, 8, -16],
    },
    fillLight: {
      color: "#7dd3fc", // Soft sky fill
      intensity: 2.2,
      position: [-14, 12, -8],
    },
    bounceLight: {
      color: "#f59e0b", // Warm brass underbelly reflection
      intensity: 2.0,
      position: [0, -10, 6],
    },
    ambientLight: {
      color: "#1e293b", // Slate ambient
      intensity: 1.2,
    },
    hemisphereLight: {
      skyColor: "#fef3c7",
      groundColor: "#0f172a",
      intensity: 1.2,
    },
    background: {
      color: "#030509", // Near-black neutral
      fogNear: 25,
      fogFar: 75,
    },
    bloom: {
      intensity: 0.65,
      luminanceThreshold: 0.68,
    },
  },

  sunset: {
    id: "sunset",
    name: "Sunset",
    subtitle: "Golden Dusk Radiance",
    icon: "🌅",
    // Verified valid drei preset: "sunset"
    envPreset: "sunset",
    envIntensity: 1.1,
    keyLight: {
      color: "#ff8a3d", // Warm sunset orange / amber
      intensity: 4.4,
      position: [14, 14, 12],
    },
    rimLight: {
      color: "#3b82f6", // Cool contrasting electric blue rim against warm key
      intensity: 3.6,
      position: [-4, 8, -16],
    },
    fillLight: {
      color: "#f43f5e", // Warm rose / magenta sky fill
      intensity: 2.0,
      position: [-14, 10, -6],
    },
    bounceLight: {
      color: "#ea580c", // Rich copper / terracotta gear bounce
      intensity: 2.5,
      position: [0, -10, 6],
    },
    ambientLight: {
      color: "#2a111a", // Dusky charcoal-maroon ambient
      intensity: 1.0,
    },
    hemisphereLight: {
      skyColor: "#fdba74",
      groundColor: "#18090e",
      intensity: 1.3,
    },
    background: {
      color: "#16070c", // Deep warm charcoal / maroon
      fogNear: 22,
      fogFar: 70,
    },
    bloom: {
      intensity: 0.85,
      luminanceThreshold: 0.60,
    },
  },

  moonlight: {
    id: "moonlight",
    name: "Moonlight",
    subtitle: "Starlit Midnight Caliber",
    icon: "🌙",
    // Verified valid drei preset: "night"
    // Note: "night" is the closest available drei environment preset for Moonlight
    envPreset: "night",
    envIntensity: 0.65,
    keyLight: {
      color: "#bfdbfe", // Cool moonlit blue-white
      intensity: 2.8,
      position: [10, 20, 12],
    },
    rimLight: {
      color: "#38bdf8", // Icy neon cyan rim highlighting gear silhouettes
      intensity: 3.8,
      position: [0, 10, -16],
    },
    fillLight: {
      color: "#818cf8", // Soft ethereal violet-blue fill
      intensity: 1.8,
      position: [-14, 12, -8],
    },
    bounceLight: {
      color: "#1e3a8a", // Deep midnight navy bounce
      intensity: 1.4,
      position: [0, -10, 6],
    },
    ambientLight: {
      color: "#0c1322", // Cold deep indigo ambient
      intensity: 0.8,
    },
    hemisphereLight: {
      skyColor: "#93c5fd",
      groundColor: "#030712",
      intensity: 0.9,
    },
    background: {
      color: "#030712", // Deep navy / indigo
      fogNear: 20,
      fogFar: 65,
    },
    bloom: {
      intensity: 1.08, // Slightly stronger bloom at night so glowing parts read dramatically
      luminanceThreshold: 0.52,
    },
  },
};

export const LIGHTING_PRESET_LIST: LightingPreset[] = Object.values(LIGHTING_PRESETS);
