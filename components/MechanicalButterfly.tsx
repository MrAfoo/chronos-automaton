"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Sparkles,
  Environment,
  AdaptiveDpr,
  AdaptiveEvents,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import {
  detectLowSpecHardware,
  savePerformancePreference,
} from "./performanceConfig";
import {
  BUTTERFLY_PARTS,
  SCAN_PART_ORDER,
  type ButterflyPartSpec,
} from "./butterflyData";
import { ExplodedPart } from "./ExplodedPart";
import { ScanPlane } from "./ScanPlane";
import { OverlayHUD } from "./OverlayHUD";
import { WindingMechanism } from "./WindingMechanism";
import { GameCorridor, type LaneIndex } from "./GameCorridor";
import { GameHUD } from "./GameHUD";
import { playLaneSwitchSound } from "./soundFX";
import {
  LIGHTING_PRESETS,
  type LightingPreset,
  type PresetKey,
} from "./lightingPresets";
import { GAME_MODE_THEME } from "./gameTheme";
import {
  Gear,
  Wing,
  Head,
  Legs,
  LightSource,
  useClockworkMaterials,
  type ClockworkMaterials,
} from "./ButterflyParts";

// Suppress known harmless Three.js r186 internal deprecation warning originating from @react-three/fiber's internal store
if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("THREE.Clock: This module has been deprecated")
    ) {
      return;
    }
    origWarn.apply(console, args);
  };

  // Polyfill / safety guard to ensure getContextAttributes() never returns null.
  // Libraries like `postprocessing` call `renderer.getContext().getContextAttributes().alpha`
  // without null-checks. If WebGL context is lost or attributes return null during initialization/HMR,
  // this prevents the unhandled `TypeError: Cannot read properties of null (reading 'alpha')` crash.
  const patchContextProto = (proto: any) => {
    if (!proto || !proto.getContextAttributes || proto.__postprocessing_alpha_guard__) return;
    const origGetContextAttributes = proto.getContextAttributes;
    proto.getContextAttributes = function () {
      const attrs = origGetContextAttributes.call(this);
      if (attrs) return attrs;
      return {
        alpha: true,
        depth: true,
        stencil: false,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
        desynchronized: false,
      };
    };
    proto.__postprocessing_alpha_guard__ = true;
  };

  if (typeof WebGLRenderingContext !== "undefined") {
    patchContextProto(WebGLRenderingContext.prototype);
  }
  if (typeof WebGL2RenderingContext !== "undefined") {
    patchContextProto(WebGL2RenderingContext.prototype);
  }
}

/**
 * Safe ErrorBoundary wrapper around postprocessing EffectComposer.
 * Catches any postprocessing/WebGL pass errors cleanly to prevent crashing the main 3D scene.
 */
class SafeEffectComposer extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("SafeEffectComposer: Postprocessing error caught, falling back cleanly:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Safe ErrorBoundary & Suspense wrapper around Drei's <Environment>.
 * Prevents HDR asset download delays, network timeouts, or 404s from blocking or crashing the 3D scene.
 */
class SafeEnvironment extends React.Component<
  { preset: any; environmentIntensity: number },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("SafeEnvironment: Environment preset load failed; falling back to procedural lights:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return (
      <React.Suspense fallback={null}>
        <Environment
          preset={this.props.preset}
          environmentIntensity={this.props.environmentIntensity}
        />
      </React.Suspense>
    );
  }
}

const STABLE_GL_CONFIG = {
  antialias: true,
  alpha: true,
  powerPreference: "high-performance" as const,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.15,
};

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

export interface MechanicalButterflyProps {
  flapSpeed?: number;           // Wing flapping frequency multiplier (default: 1.0)
  gearSpeedMultiplier?: number; // Gear rotation speed multiplier (default: 1.0)
  brassColor?: string;          // Hex color for clockwork brass (default: #dfa83e)
  steelColor?: string;          // Hex color for gunmetal steel (default: #252830)
  upperGlassColor?: string;     // Hex color for upper wing glass (default: #e59d38)
  lowerGlassColor?: string;     // Hex color for lower wing glass (default: #1fa396)
  bloomIntensity?: number;      // Postprocessing bloom intensity (default: 0.65)
  enableControls?: boolean;     // Enable user orbit controls (default: true)
  autoRotate?: boolean;         // Auto-rotate scene camera (default: false for open world)
  showSparkles?: boolean;       // Atmospheric drifting particles (default: true)
  showControlsOverlay?: boolean;// Display floating telemetry & controls HUD (default: true)
  initialLightPosition?: [number, number, number]; // Initial light position
  initialLightingPreset?: PresetKey; // Initial lighting mood preset (default: "moonlight")
}

// ============================================================================
// CAMERA CHOREOGRAPHER (SMOOTH EASE ON EXPLODED VIEW)
// ============================================================================

interface CameraChoreographerProps {
  isExploded: boolean;
  isPlaying: boolean;
  isGameMode?: boolean;
  cameraShake?: number;
}

const CameraChoreographer: React.FC<CameraChoreographerProps> = ({
  isExploded,
  isGameMode = false,
  cameraShake = 0,
}) => {
  const { camera, controls } = useThree();
  const prevExplodedRef = useRef(isExploded);
  const prevGameModeRef = useRef(isGameMode);
  const animatingRef = useRef(false);
  const animProgressRef = useRef(1);
  const startCamPosRef = useRef(new THREE.Vector3());
  const destCamPosRef = useRef(new THREE.Vector3());
  const startTargetRef = useRef(new THREE.Vector3());
  const destTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const modeChanged = prevGameModeRef.current !== isGameMode;
    const explodeChanged = prevExplodedRef.current !== isExploded;

    if (modeChanged || explodeChanged) {
      prevGameModeRef.current = isGameMode;
      prevExplodedRef.current = isExploded;
      startCamPosRef.current.copy(camera.position);

      const ctrl = controls as any;
      if (ctrl && ctrl.target) {
        startTargetRef.current.copy(ctrl.target);
      } else {
        startTargetRef.current.set(0, 1.2, 0);
      }

      if (isGameMode) {
        // Elevated chase camera behind small butterfly looking down the 3-lane corridor with clear sightline
        destCamPosRef.current.set(0, 2.7, 5.0);
        destTargetRef.current.set(0, 0.9, -18.0);
      } else if (isExploded) {
        // Move camera back smoothly so all exploded parts fit into view
        destCamPosRef.current.set(0, 3.2, 14.5);
        destTargetRef.current.set(0, 1.6, 0);
      } else {
        // Return to showcase framing
        destCamPosRef.current.set(0, 2.2, 9.5);
        destTargetRef.current.set(0, 1.2, 0);
      }

      animProgressRef.current = 0;
      animatingRef.current = true;
    }
  }, [isExploded, isGameMode, camera, controls]);

  useFrame((_, delta) => {
    if (animatingRef.current) {
      animProgressRef.current += delta * 2.4;
      if (animProgressRef.current >= 1) {
        animProgressRef.current = 1;
        animatingRef.current = false;
      }
      const t = animProgressRef.current;
      // Smooth cubic ease out
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startCamPosRef.current, destCamPosRef.current, ease);

      const ctrl = controls as any;
      if (ctrl && ctrl.target) {
        ctrl.target.lerpVectors(startTargetRef.current, destTargetRef.current, ease);
        ctrl.update();
      }
    }

    // Screen shake on obstacle impact during gameplay
    if (isGameMode && cameraShake > 0.01) {
      const shakeX = (Math.random() - 0.5) * cameraShake * 0.9;
      const shakeY = (Math.random() - 0.5) * cameraShake * 0.9;
      camera.position.x += shakeX;
      camera.position.y += shakeY;
    }
  });

  return null;
};

// ============================================================================
// EXPANDED ENVIRONMENT, DEPTH CUES & ATMOSPHERIC LIGHTING PRESETS
// ============================================================================

interface SceneWorldProps {
  preset: LightingPreset;
  onPlaceLight?: (point: [number, number, number]) => void;
  isPlaying?: boolean;
}

const SceneWorld: React.FC<SceneWorldProps> = ({
  preset,
  onPlaceLight,
  isPlaying = false,
}) => {
  const groundPointerDownRef = useRef({ x: 0, y: 0 });

  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const bounceLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);

  // Persistent target colors (allocated once to eliminate per-frame garbage collection)
  const targetKeyColor = useMemo(() => new THREE.Color(preset.keyLight.color), []);
  const targetFillColor = useMemo(() => new THREE.Color(preset.fillLight.color), []);
  const targetRimColor = useMemo(() => new THREE.Color(preset.rimLight.color), []);
  const targetBounceColor = useMemo(() => new THREE.Color(preset.bounceLight.color), []);
  const targetAmbientColor = useMemo(() => new THREE.Color(preset.ambientLight.color), []);
  const targetHemiSkyColor = useMemo(() => new THREE.Color(preset.hemisphereLight.skyColor), []);
  const targetHemiGroundColor = useMemo(() => new THREE.Color(preset.hemisphereLight.groundColor), []);
  const targetBgColor = useMemo(() => new THREE.Color(preset.background.color), []);

  // Track whether lighting preset is actively transitioning to eliminate per-frame CPU lerp loops
  const isTransitioningRef = useRef(true);

  // Update target colors when preset selection changes
  useEffect(() => {
    targetKeyColor.set(preset.keyLight.color);
    targetFillColor.set(preset.fillLight.color);
    targetRimColor.set(preset.rimLight.color);
    targetBounceColor.set(preset.bounceLight.color);
    targetAmbientColor.set(preset.ambientLight.color);
    targetHemiSkyColor.set(preset.hemisphereLight.skyColor);
    targetHemiGroundColor.set(preset.hemisphereLight.groundColor);
    targetBgColor.set(preset.background.color);
    isTransitioningRef.current = true;
  }, [
    preset,
    targetKeyColor,
    targetFillColor,
    targetRimColor,
    targetBounceColor,
    targetAmbientColor,
    targetHemiSkyColor,
    targetHemiGroundColor,
    targetBgColor,
  ]);

  // Current lerping intensity values
  const currentKeyIntensity = useRef(preset.keyLight.intensity);
  const currentFillIntensity = useRef(preset.fillLight.intensity);
  const currentRimIntensity = useRef(preset.rimLight.intensity);
  const currentBounceIntensity = useRef(preset.bounceLight.intensity);
  const currentAmbientIntensity = useRef(preset.ambientLight.intensity);
  const currentHemiIntensity = useRef(preset.hemisphereLight.intensity);

  useFrame((state, delta) => {
    if (!isTransitioningRef.current) return;

    // Check if key light intensity has converged within epsilon
    const intensityDelta = Math.abs(currentKeyIntensity.current - preset.keyLight.intensity);
    if (intensityDelta < 0.005) {
      isTransitioningRef.current = false;
    }

    // Frame-rate independent exponential lerp factor (~1.2-1.5s smooth crossfade)
    const factor = 1.0 - Math.exp(-Math.min(delta, 0.1) * 3.5);

    // 1. Primary Key Light
    if (keyLightRef.current) {
      keyLightRef.current.color.lerp(targetKeyColor, factor);
      currentKeyIntensity.current = THREE.MathUtils.lerp(
        currentKeyIntensity.current,
        preset.keyLight.intensity,
        factor
      );
      keyLightRef.current.intensity = currentKeyIntensity.current;
    }

    // 2. Secondary Fill Light
    if (fillLightRef.current) {
      fillLightRef.current.color.lerp(targetFillColor, factor);
      currentFillIntensity.current = THREE.MathUtils.lerp(
        currentFillIntensity.current,
        preset.fillLight.intensity,
        factor
      );
      fillLightRef.current.intensity = currentFillIntensity.current;
    }

    // 3. Silhouette Rim Light
    if (rimLightRef.current) {
      rimLightRef.current.color.lerp(targetRimColor, factor);
      currentRimIntensity.current = THREE.MathUtils.lerp(
        currentRimIntensity.current,
        preset.rimLight.intensity,
        factor
      );
      rimLightRef.current.intensity = currentRimIntensity.current;
    }

    // 4. Ground Bounce Light
    if (bounceLightRef.current) {
      bounceLightRef.current.color.lerp(targetBounceColor, factor);
      currentBounceIntensity.current = THREE.MathUtils.lerp(
        currentBounceIntensity.current,
        preset.bounceLight.intensity,
        factor
      );
      bounceLightRef.current.intensity = currentBounceIntensity.current;
    }

    // 5. Ambient Base Fill Light
    if (ambientLightRef.current) {
      ambientLightRef.current.color.lerp(targetAmbientColor, factor);
      currentAmbientIntensity.current = THREE.MathUtils.lerp(
        currentAmbientIntensity.current,
        preset.ambientLight.intensity,
        factor
      );
      ambientLightRef.current.intensity = currentAmbientIntensity.current;
    }

    // 6. Dual-tone Hemisphere Light
    if (hemiLightRef.current) {
      hemiLightRef.current.color.lerp(targetHemiSkyColor, factor);
      hemiLightRef.current.groundColor.lerp(targetHemiGroundColor, factor);
      currentHemiIntensity.current = THREE.MathUtils.lerp(
        currentHemiIntensity.current,
        preset.hemisphereLight.intensity,
        factor
      );
      hemiLightRef.current.intensity = currentHemiIntensity.current;
    }

    // 7. Background & Scene Fog Crossfade
    if (state.scene.background instanceof THREE.Color) {
      state.scene.background.lerp(targetBgColor, factor);
    }
    if (state.scene.fog && "color" in state.scene.fog) {
      (state.scene.fog as THREE.Fog).color.lerp(targetBgColor, factor);
      (state.scene.fog as THREE.Fog).near = THREE.MathUtils.lerp(
        (state.scene.fog as THREE.Fog).near,
        preset.background.fogNear,
        factor
      );
      (state.scene.fog as THREE.Fog).far = THREE.MathUtils.lerp(
        (state.scene.fog as THREE.Fog).far,
        preset.background.fogFar,
        factor
      );
    }
  });

  return (
    <>
      <fog
        attach="fog"
        args={[
          preset.background.color,
          preset.background.fogNear,
          preset.background.fogFar,
        ]}
      />

      {/* Primary Key Light */}
      <directionalLight
        ref={keyLightRef}
        position={preset.keyLight.position}
        intensity={preset.keyLight.intensity}
        color={preset.keyLight.color}
      />

      {/* Secondary Sky Fill Light */}
      <directionalLight
        ref={fillLightRef}
        position={preset.fillLight.position}
        intensity={preset.fillLight.intensity}
        color={preset.fillLight.color}
      />

      {/* Back Rim Light for Metallic Silhouette */}
      <directionalLight
        ref={rimLightRef}
        position={preset.rimLight.position}
        intensity={preset.rimLight.intensity}
        color={preset.rimLight.color}
      />

      {/* Warm Ground Bounce Light for Underbelly Gears */}
      <directionalLight
        ref={bounceLightRef}
        position={preset.bounceLight.position}
        intensity={preset.bounceLight.intensity}
        color={preset.bounceLight.color}
      />

      {/* Ambient Fill for Base Visibility */}
      <ambientLight
        ref={ambientLightRef}
        intensity={preset.ambientLight.intensity}
        color={preset.ambientLight.color}
      />

      {/* Dual-tone Hemisphere Light for Rich Horizon Reflections */}
      <hemisphereLight
        ref={hemiLightRef}
        args={[
          preset.hemisphereLight.skyColor,
          preset.hemisphereLight.groundColor,
          preset.hemisphereLight.intensity,
        ]}
      />

      {/*
        drei <Environment> HDRI preset
        Note: drei's <Environment> does not natively support multi-texture crossfading.
        The environment map snap-swaps cleanly upon preset selection while all light
        colors, intensities, fog, and background smoothly crossfade around it.
      */}
      <SafeEnvironment
        preset={preset.envPreset}
        environmentIntensity={preset.envIntensity}
      />

      {/* Ground Grid Floor & Ground Click Receiver */}
      <gridHelper args={[80, 80, "#1e293b", "#090e18"]} position={[0, -5.5, 0]} />
      <mesh
        position={[0, -5.6, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          if (!isPlaying || !onPlaceLight) return;
          groundPointerDownRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!isPlaying || !onPlaceLight) return;
          const dx = e.clientX - groundPointerDownRef.current.x;
          const dy = e.clientY - groundPointerDownRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) < 8) {
            e.stopPropagation();
            onPlaceLight([e.point.x, 2.0, e.point.z]);
          }
        }}
      >
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#04060c" roughness={0.92} metalness={0.08} />
      </mesh>
    </>
  );
};

// ============================================================================
// BLOOM CONTROLLER (SMOOTH POSTPROCESSING LERP ON PRESET CHANGE)
// ============================================================================

interface BloomControllerProps {
  preset: LightingPreset;
  bloomRef: React.RefObject<any>;
}

const BloomController: React.FC<BloomControllerProps> = ({ preset, bloomRef }) => {
  const currentIntensity = useRef(preset.bloom.intensity);

  useFrame((_, delta) => {
    if (!bloomRef.current) return;
    const factor = 1.0 - Math.exp(-Math.min(delta, 0.1) * 3.5);
    currentIntensity.current = THREE.MathUtils.lerp(
      currentIntensity.current,
      preset.bloom.intensity,
      factor
    );
    bloomRef.current.intensity = currentIntensity.current;
  });

  return null;
};

// ============================================================================
// INTERACTIVE CLICK-TO-PLACE GROUND/VOLUME RAYCAST RECEIVER
// ============================================================================

interface ClickPlaneProps {
  onPlaceLight: (point: [number, number, number]) => void;
  disabled?: boolean;
}

const ClickPlane: React.FC<ClickPlaneProps> = ({ onPlaceLight, disabled = false }) => {
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  if (disabled) return null;

  return (
    <mesh
      position={[0, 1.5, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const dx = e.clientX - pointerDownPosRef.current.x;
        const dy = e.clientY - pointerDownPosRef.current.y;
        const dragDist = Math.sqrt(dx * dx + dy * dy);

        if (dragDist < 8) {
          e.stopPropagation();
          const clampedY = THREE.MathUtils.clamp(e.point.y + 0.5, 1.0, 5.5);
          onPlaceLight([e.point.x, clampedY, e.point.z]);
        }
      }}
    >
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

// ============================================================================
// MAIN BUTTERFLY RIG: LIGHT-SEEKING, EXPLODED INSPECTION & DIAGNOSTICS SWEEP
// ============================================================================

interface ButterflyRigProps {
  flapSpeed: number;
  gearSpeedMultiplier: number;
  materials: ClockworkMaterials;
  targetLightPos: [number, number, number];
  isPlaying: boolean;
  isExploded: boolean;
  hoveredPartId: string | null;
  onHover: (id: string | null) => void;
  onTelemetryUpdate?: (
    state: "SHOWCASE" | "SEEKING" | "ORBITING" | "INSPECTION",
    speed: number,
    distance: number
  ) => void;
  // Diagnostic Scan props
  diagnosticState: "IDLE" | "SCANNING" | "COMPLETE";
  onScanProgress?: (
    progress: number,
    count: number,
    activePart: ButterflyPartSpec | null
  ) => void;
  onScanComplete?: () => void;
  // Mainspring winding tension callback
  onTensionUpdate?: (tension: number) => void;
  // Mini-game flight trial props
  isGameMode?: boolean;
  gameTargetLane?: LaneIndex;
  onButterflyXChange?: (x: number) => void;
  butterflyXRef?: React.MutableRefObject<number>;
}

const ButterflyRig: React.FC<ButterflyRigProps> = ({
  flapSpeed,
  gearSpeedMultiplier,
  materials,
  targetLightPos,
  isPlaying,
  isExploded,
  hoveredPartId,
  onHover,
  onTelemetryUpdate,
  diagnosticState,
  onScanProgress,
  onScanComplete,
  onTensionUpdate,
  isGameMode = false,
  gameTargetLane = 0,
  onButterflyXChange,
  butterflyXRef,
}) => {
  const butterflyGroupRef = useRef<THREE.Group>(null);
  const currentLaneXRef = useRef(0.0);
  const currentRollRef = useRef(0.0);

  // Wing hinge refs
  const leftUpperWingRef = useRef<THREE.Group>(null);
  const rightUpperWingRef = useRef<THREE.Group>(null);
  const leftLowerWingRef = useRef<THREE.Group>(null);
  const rightLowerWingRef = useRef<THREE.Group>(null);
  const currentScaleRef = useRef(1.0);
  const abdomenRef = useRef<THREE.Group>(null);

  // Physics state kept entirely in refs - centered front and center at [0, 1.2, 0]
  const posRef = useRef(new THREE.Vector3(0, 1.2, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const quatRef = useRef(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0))
  );
  const prevHeadingRef = useRef(new THREE.Vector3(0, 0, -1));

  // Exploded progress state (0 = Assembled, 1 = Fully Exploded)
  const explodeProgressRef = useRef(0.0);
  const [easedProgress, setEasedProgress] = useState(0.0);

  // State machine state
  const flightStateRef = useRef<"SHOWCASE" | "SEEKING" | "ORBITING" | "INSPECTION">("SHOWCASE");
  const orbitAngleRef = useRef(0);
  const orbitRadiusRef = useRef(2.8);
  const orbitDirectionRef = useRef(1);

  // Pre-allocated scratch vectors
  const scratchRef = useRef({
    targetVec: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    desiredVel: new THREE.Vector3(),
    wanderVec: new THREE.Vector3(),
    currentHeading: new THREE.Vector3(),
    targetQuat: new THREE.Quaternion(),
    rollQuat: new THREE.Quaternion(),
    forwardUnit: new THREE.Vector3(0, 0, 1),
    orbitTargetPos: new THREE.Vector3(),
    inspectionPos: new THREE.Vector3(0, 1.2, 0),
    inspectionQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0)),
  });

  const timeAccRef = useRef(0);
  const telemetryTickRef = useRef(0);

  // -------------------------------------------------------------
  // DIAGNOSTIC SCAN STATE
  // -------------------------------------------------------------
  const isScanning = diagnosticState === "SCANNING";
  const scanZStart = 2.4;
  const scanZEnd = -2.6;
  const scanZRef = useRef(scanZStart);
  const [scanPlaneZ, setScanPlaneZ] = useState(scanZStart);
  const scannedPartsRef = useRef<Set<string>>(new Set());
  const [scannedPartsSet, setScannedPartsSet] = useState<Set<string>>(new Set());
  const [activeDiagnosticPartId, setActiveDiagnosticPartId] = useState<string | null>(null);
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset scan state whenever a new scan begins
  useEffect(() => {
    if (isScanning) {
      scanZRef.current = scanZStart;
      setScanPlaneZ(scanZStart);
      scannedPartsRef.current = new Set();
      setScannedPartsSet(new Set());
      setActiveDiagnosticPartId(null);
    }
  }, [isScanning]);

  // -------------------------------------------------------------
  // MAINSPRING WINDING & KINETIC TENSION STATE
  // -------------------------------------------------------------
  const windTensionRef = useRef(0.0);
  const [displayedTension, setDisplayedTension] = useState(0.0);
  const tensionTickRef = useRef(0);

  const handleWind = useCallback(
    (deltaTension: number) => {
      if (isExploded || isScanning) return;
      windTensionRef.current = THREE.MathUtils.clamp(
        windTensionRef.current + deltaTension,
        0,
        1
      );
      setDisplayedTension(windTensionRef.current);
      onTensionUpdate?.(windTensionRef.current);
    },
    [isExploded, isScanning, onTensionUpdate]
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = scratchRef.current;

    // -------------------------------------------------------------
    // 1. EXPLODED PROGRESS INTERPOLATION (CUBIC EASE)
    // -------------------------------------------------------------
    const targetProgress = isExploded ? 1.0 : 0.0;
    explodeProgressRef.current = THREE.MathUtils.damp(
      explodeProgressRef.current,
      targetProgress,
      4.2,
      dt
    );

    const rawP = explodeProgressRef.current;
    // Cubic ease-in-out formula
    const currentEasedP =
      rawP < 0.5 ? 4 * rawP * rawP * rawP : 1 - Math.pow(-2 * rawP + 2, 3) / 2;

    // Throttle state update to sub-components only when progress moves meaningfully
    if (Math.abs(currentEasedP - easedProgress) > 0.005) {
      setEasedProgress(currentEasedP);
    }

    s.targetVec.set(...targetLightPos);
    s.toTarget.subVectors(s.targetVec, posRef.current);
    const distanceToLight = s.toTarget.length();

    // -------------------------------------------------------------
    // 2. DIAGNOSTIC SCAN SWEEP ENGINE
    // -------------------------------------------------------------
    if (isScanning) {
      // Advance scan line along Z axis from front (+2.4) to tail (-2.6) over ~2.8s
      const scanSpeed = (scanZStart - scanZEnd) / 2.8;
      scanZRef.current -= scanSpeed * dt;
      const currentZ = scanZRef.current;
      setScanPlaneZ(currentZ);

      const progress = THREE.MathUtils.clamp(
        (scanZStart - currentZ) / (scanZStart - scanZEnd),
        0,
        1
      );

      // Check which parts have been crossed by the scanning plane
      let newlyScannedPart: ButterflyPartSpec | null = null;
      for (const item of SCAN_PART_ORDER) {
        if (currentZ <= item.triggerZ && !scannedPartsRef.current.has(item.id)) {
          scannedPartsRef.current.add(item.id);
          const spec = BUTTERFLY_PARTS[item.id];
          if (spec) {
            newlyScannedPart = spec;
          }
        }
      }

      if (newlyScannedPart) {
        const nextSet = new Set(scannedPartsRef.current);
        setScannedPartsSet(nextSet);
        setActiveDiagnosticPartId(newlyScannedPart.id);

        // Keep 3D badge active for 1.2s before auto-fading
        if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
        badgeTimerRef.current = setTimeout(() => {
          setActiveDiagnosticPartId((current) =>
            current === newlyScannedPart?.id ? null : current
          );
        }, 1200);

        onScanProgress?.(progress, nextSet.size, newlyScannedPart);
      } else {
        // Continuous percentage updates for smooth progress bar
        onScanProgress?.(
          progress,
          scannedPartsRef.current.size,
          activeDiagnosticPartId ? BUTTERFLY_PARTS[activeDiagnosticPartId] ?? null : null
        );
      }

      // Check if sweep has finished
      if (currentZ <= scanZEnd) {
        onScanComplete?.();
      }
    }

    // -------------------------------------------------------------
    // 3. MAINSPRING TENSION DECAY & KINETIC SPEED BOOST
    // -------------------------------------------------------------
    // Decay tension over ~22s only when not frozen in inspection or scan
    if (!isScanning && !isExploded && currentEasedP < 0.08) {
      if (windTensionRef.current > 0) {
        windTensionRef.current = Math.max(0, windTensionRef.current - dt * (1.0 / 22.0));
        tensionTickRef.current += dt;
        if (tensionTickRef.current > 0.09) {
          tensionTickRef.current = 0;
          setDisplayedTension(windTensionRef.current);
          onTensionUpdate?.(windTensionRef.current);
        }
      }
    }
    const tensionSpeedBoost = 1.0 + windTensionRef.current * 1.8;

    // -------------------------------------------------------------
    // 4. STATE MACHINE & FLIGHT KINEMATICS
    // -------------------------------------------------------------
    if (isScanning || isExploded || currentEasedP > 0.08) {
      // INSPECTION / DIAGNOSTICS: Freeze flight & hold stable front and center
      flightStateRef.current = "INSPECTION";
      velRef.current.set(0, 0, 0);

      // Smoothly transition group position & level rotation for inspection
      posRef.current.lerp(s.inspectionPos, Math.min(1, dt * 4.5));
      quatRef.current.slerp(s.inspectionQuat, Math.min(1, dt * 5.0));

      if (butterflyGroupRef.current) {
        butterflyGroupRef.current.position.copy(posRef.current);
        butterflyGroupRef.current.quaternion.copy(quatRef.current);
      }
    } else if (isGameMode) {
      // -------------------------------------------------------------
      // 4A. CHRONOS CORRIDOR 3-LANE FLIGHT TRIAL
      // -------------------------------------------------------------
      flightStateRef.current = "SHOWCASE";
      velRef.current.set(0, 0, 0);
      timeAccRef.current += dt;
      const t = timeAccRef.current;

      // Target X based on player's current lane (-1, 0, 1) * 2.2
      const targetX = gameTargetLane * 2.2;
      const prevX = currentLaneXRef.current;

      // Smooth horizontal lerp toward target lane (crisp, responsive steering)
      currentLaneXRef.current = THREE.MathUtils.damp(
        currentLaneXRef.current,
        targetX,
        14.0,
        dt
      );

      // Inform parent/corridor of current butterfly X without triggering React re-renders
      if (butterflyXRef) {
        butterflyXRef.current = currentLaneXRef.current;
      }
      onButterflyXChange?.(currentLaneXRef.current);

      // Aerodynamic banking roll into the turn
      const xVel = (currentLaneXRef.current - prevX) / Math.max(dt, 0.001);
      const targetRoll = THREE.MathUtils.clamp(-xVel * 0.08, -0.45, 0.45);
      currentRollRef.current = THREE.MathUtils.damp(
        currentRollRef.current,
        targetRoll,
        12.0,
        dt
      );

      // Vertical hover bob: lower elevation so forward sightline down corridor is unobstructed
      const hoverY = 0.85 + Math.sin(t * 7.0) * 0.06;
      posRef.current.set(currentLaneXRef.current, hoverY, 0);

      // Orientation: Facing forward down the negative Z corridor into the screen (yaw = Math.PI)
      // with a slight pitch forward (-0.08) and dynamic roll banking
      const targetGameQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-0.08, Math.PI, currentRollRef.current)
      );
      quatRef.current.slerp(targetGameQuat, Math.min(1, dt * 14.0));

      if (butterflyGroupRef.current) {
        butterflyGroupRef.current.position.copy(posRef.current);
        butterflyGroupRef.current.quaternion.copy(quatRef.current);
      }
    } else if (!isPlaying) {
      // SHOWCASE HOVER MODE: Gracefully hover front and center in clear view
      flightStateRef.current = "SHOWCASE";
      velRef.current.set(0, 0, 0);
      timeAccRef.current += dt;
      const t = timeAccRef.current;

      const hoverY = 1.2 + Math.sin(t * 1.8) * 0.12;
      const hoverX = Math.sin(t * 0.9) * 0.1;
      const targetHoverPos = new THREE.Vector3(hoverX, hoverY, 0);

      const rollTilt = Math.sin(t * 0.9) * 0.04;
      const pitchTilt = Math.sin(t * 1.8) * 0.03 - 0.06;
      const yawTilt = Math.cos(t * 0.7) * 0.06;
      const targetHoverQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pitchTilt, yawTilt, rollTilt)
      );

      posRef.current.lerp(targetHoverPos, Math.min(1, dt * 4.0));
      quatRef.current.slerp(targetHoverQuat, Math.min(1, dt * 4.0));

      if (butterflyGroupRef.current) {
        butterflyGroupRef.current.position.copy(posRef.current);
        butterflyGroupRef.current.quaternion.copy(quatRef.current);
      }
    } else {
      // ACTIVE FLIGHT: Seeking or Orbiting Light Beacon
      timeAccRef.current += dt;
      const t = timeAccRef.current;

      const arrivalRadius = 3.2;
      const departRadius = 4.8;

      if (
        flightStateRef.current === "SEEKING" ||
        flightStateRef.current === "INSPECTION" ||
        flightStateRef.current === "SHOWCASE"
      ) {
        flightStateRef.current = "SEEKING";
        if (distanceToLight < arrivalRadius) {
          flightStateRef.current = "ORBITING";
          orbitAngleRef.current = Math.atan2(
            posRef.current.z - s.targetVec.z,
            posRef.current.x - s.targetVec.x
          );
          orbitRadiusRef.current = Math.max(2.2, Math.min(3.4, distanceToLight));
          const tangentX = -Math.sin(orbitAngleRef.current);
          const tangentZ = Math.cos(orbitAngleRef.current);
          const dot = velRef.current.x * tangentX + velRef.current.z * tangentZ;
          orbitDirectionRef.current = dot >= 0 ? 1 : -1;
        }
      } else {
        if (distanceToLight > departRadius) {
          flightStateRef.current = "SEEKING";
        }
      }

      // Steering
      if (flightStateRef.current === "SEEKING") {
        const maxSpeed = 7.5 * tensionSpeedBoost;
        const minSpeed = 3.2 * tensionSpeedBoost;
        const approachFactor = Math.min(1, Math.max(0, (distanceToLight - arrivalRadius) / 6.0));
        const desiredSpeed = THREE.MathUtils.lerp(minSpeed, maxSpeed, approachFactor);

        const wanderNoiseX = Math.sin(t * 1.6) * 0.9 + Math.sin(t * 3.1) * 0.35;
        const wanderNoiseY = Math.cos(t * 1.9) * 0.5 + Math.sin(t * 3.8) * 0.25;
        const wanderNoiseZ = Math.cos(t * 1.4) * 0.9;
        s.wanderVec.set(wanderNoiseX, wanderNoiseY, wanderNoiseZ);

        s.desiredVel.copy(s.toTarget).add(s.wanderVec).normalize().multiplyScalar(desiredSpeed);
        const steeringWeight = THREE.MathUtils.lerp(2.2, 3.8, approachFactor);
        velRef.current.lerp(s.desiredVel, Math.min(1, dt * steeringWeight));
      } else {
        // Orbiting
        const orbitSpeed = 3.6 * tensionSpeedBoost;
        orbitAngleRef.current +=
          orbitDirectionRef.current * (orbitSpeed / orbitRadiusRef.current) * dt;
        const bobY = Math.sin(t * 2.4) * 0.45;
        s.orbitTargetPos.set(
          s.targetVec.x + Math.cos(orbitAngleRef.current) * orbitRadiusRef.current,
          s.targetVec.y + bobY,
          s.targetVec.z + Math.sin(orbitAngleRef.current) * orbitRadiusRef.current
        );
        s.desiredVel.subVectors(s.orbitTargetPos, posRef.current).multiplyScalar(4.0);
        velRef.current.lerp(s.desiredVel, Math.min(1, dt * 5.0));
      }

      posRef.current.addScaledVector(velRef.current, dt);
      if (posRef.current.y < -4.5) {
        posRef.current.y = -4.5;
        velRef.current.y = Math.max(1.0, -velRef.current.y * 0.5);
      }

      if (butterflyGroupRef.current) {
        butterflyGroupRef.current.position.copy(posRef.current);
      }

      // Aerodynamic Banking
      const speed = velRef.current.length();
      if (speed > 0.05) {
        s.currentHeading.copy(velRef.current).normalize();
        s.targetQuat.setFromUnitVectors(s.forwardUnit, s.currentHeading);

        const dtSafe = Math.max(dt, 0.001);
        const turnRate =
          (prevHeadingRef.current.x * s.currentHeading.z -
            prevHeadingRef.current.z * s.currentHeading.x) /
          dtSafe;
        prevHeadingRef.current.copy(s.currentHeading);

        const targetRoll = isNaN(turnRate)
          ? 0
          : THREE.MathUtils.clamp(-turnRate * 0.35, -0.75, 0.75);
        s.rollQuat.setFromAxisAngle(s.forwardUnit, targetRoll);
        s.targetQuat.multiply(s.rollQuat);

        quatRef.current.slerp(s.targetQuat, Math.min(1, dt * 7.0));

        if (butterflyGroupRef.current) {
          butterflyGroupRef.current.quaternion.copy(quatRef.current);
        }
      }
    }

    // -------------------------------------------------------------
    // 4. WING FLAPPING (FROZEN WHEN EXPLODED OR SCANNING)
    // -------------------------------------------------------------
    const flapFreezeMultiplier = isScanning ? 0 : Math.max(0, 1 - currentEasedP * 1.5);
    const speed = velRef.current.length();
    const t = timeAccRef.current;

    const dynamicFlapCadence = !isPlaying
      ? flapSpeed * 0.95
      : flapSpeed * (0.8 + Math.min(1.2, speed * 0.15));
    const cycleDuration =
      flightStateRef.current === "ORBITING" ? 4.2 : (!isPlaying ? 3.6 : 3.2);
    const cycleTime = (t * 0.75) % cycleDuration;
    const isGliding = cycleTime > 2.0;
    const glideFade = isGliding
      ? Math.max(0, 1 - (cycleTime - 2.0) * 3.5)
      : Math.min(1, cycleTime * 3.5);

    const flapFreq = dynamicFlapCadence * 3.8 * tensionSpeedBoost;
    const rawFlap = Math.sin(t * flapFreq * Math.PI * 2);
    const asymmetricFlap = Math.sign(rawFlap) * Math.pow(Math.abs(rawFlap), 0.85);

    const baseDihedral = 0.22;
    const flapAmpBase = isGameMode ? 0.28 : 0.72;
    const flapAmplitude = flapAmpBase * (0.15 + 0.85 * glideFade) * flapFreezeMultiplier;
    const upperWingFlapAngle = baseDihedral + asymmetricFlap * flapAmplitude;

    const lowerRawFlap = Math.sin((t * flapFreq - 0.12) * Math.PI * 2);
    const lowerWingFlapAngle = baseDihedral * 0.8 + lowerRawFlap * flapAmplitude * 0.9;

    const flapVelocity = Math.cos(t * flapFreq * Math.PI * 2) * flapFreezeMultiplier;
    const pitchOffset = flapVelocity * 0.16 * glideFade;

    if (leftUpperWingRef.current) {
      leftUpperWingRef.current.rotation.z = -upperWingFlapAngle;
      leftUpperWingRef.current.rotation.y = pitchOffset;
      leftUpperWingRef.current.rotation.x = -pitchOffset * 0.4;
    }
    if (rightUpperWingRef.current) {
      rightUpperWingRef.current.rotation.z = upperWingFlapAngle;
      rightUpperWingRef.current.rotation.y = -pitchOffset;
      rightUpperWingRef.current.rotation.x = -pitchOffset * 0.4;
    }
    if (leftLowerWingRef.current) {
      leftLowerWingRef.current.rotation.z = -lowerWingFlapAngle;
      leftLowerWingRef.current.rotation.y = pitchOffset * 0.75;
      leftLowerWingRef.current.rotation.x = -pitchOffset * 0.3;
    }
    if (rightLowerWingRef.current) {
      rightLowerWingRef.current.rotation.z = lowerWingFlapAngle;
      rightLowerWingRef.current.rotation.y = -pitchOffset * 0.75;
      rightLowerWingRef.current.rotation.x = -pitchOffset * 0.3;
    }

    // Abdominal curl
    if (abdomenRef.current) {
      abdomenRef.current.rotation.x =
        (Math.sin(t * 1.6) * 0.05 - 0.12) * flapFreezeMultiplier;
    }

    // Scale interpolation: scale down to 0.38 in game mode so wingspan fits inside lane
    const targetScale = isGameMode ? 0.38 : 1.0;
    currentScaleRef.current = THREE.MathUtils.damp(
      currentScaleRef.current,
      targetScale,
      10.0,
      dt
    );
    if (butterflyGroupRef.current) {
      butterflyGroupRef.current.scale.setScalar(currentScaleRef.current);
    }

    // Telemetry update (showcase only)
    telemetryTickRef.current += dt;
    if (telemetryTickRef.current > 0.1 && !isGameMode) {
      telemetryTickRef.current = 0;
      onTelemetryUpdate?.(flightStateRef.current, speed, distanceToLight);
    }
  });

  const effectiveGearSpeed = gearSpeedMultiplier * (1.0 + displayedTension * 1.8);

  return (
    <group ref={butterflyGroupRef} position={[0, 1.2, 0]}>
      {/* Dynamic Point Light */}
      <pointLight
        position={[0, 0.4, 0.6]}
        intensity={2.8}
        distance={6}
        color="#ffe2a4"
        decay={2}
      />
      <pointLight
        position={[0, -0.5, -0.4]}
        intensity={1.6}
        distance={4.5}
        color="#4ec5d4"
        decay={2}
      />

      {/* Holographic Laser Grid Scan Plane (Active during Diagnostics) */}
      <ScanPlane active={isScanning} currentZ={scanPlaneZ} />

      {/* ==================== 1. THORAX & INTERNAL GEAR TRAIN ==================== */}
      {/* Thorax Engine Capsule */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["thorax-chassis"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "thorax-chassis"}
        onHover={onHover}
        basePosition={[0, 0, 0]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("thorax-chassis")}
        isCurrentlyScanning={activeDiagnosticPartId === "thorax-chassis"}
      >
        <mesh material={materials.steelMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.44, 1.1, 16]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0, 0, 0.32]}>
          <torusGeometry args={[0.42, 0.045, 12, 24]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0, 0, 0]}>
          <torusGeometry args={[0.45, 0.05, 12, 24]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0, 0, -0.32]}>
          <torusGeometry args={[0.42, 0.045, 12, 24]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0, 0.43, 0]}>
          <boxGeometry args={[0.22, 0.06, 1.05]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0, 0.42, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        </mesh>
        <mesh material={materials.jewelMaterial} position={[0, 0.46, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[-0.42, 0.22, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.18, 12]} />
        </mesh>
        <mesh material={materials.brassMaterial} position={[0.42, 0.22, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.18, 12]} />
        </mesh>

        {/* Interactive Mainspring Winding Mechanism & Knurled Pocket-Watch Crown */}
        <WindingMechanism
          windTension={displayedTension}
          onWind={handleWind}
          materials={materials}
          disabled={isScanning || isExploded}
        />
      </ExplodedPart>

      {/* Main Drive Gear */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["main-gear"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "main-gear"}
        onHover={onHover}
        basePosition={[0, 0.08, 0.02]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("main-gear")}
        isCurrentlyScanning={activeDiagnosticPartId === "main-gear"}
      >
        <Gear
          radius={0.34}
          teeth={14}
          speed={0.8}
          thickness={0.04}
          materials={materials}
          gearSpeedMultiplier={effectiveGearSpeed}
          useBrass={true}
        />
      </ExplodedPart>

      {/* Escapement Reduction Pinion */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["pinion-gear"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "pinion-gear"}
        onHover={onHover}
        basePosition={[0, 0.15, -0.22]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("pinion-gear")}
        isCurrentlyScanning={activeDiagnosticPartId === "pinion-gear"}
      >
        <Gear
          radius={0.2}
          teeth={10}
          speed={-1.4}
          thickness={0.035}
          materials={materials}
          gearSpeedMultiplier={effectiveGearSpeed}
          useBrass={false}
        />
      </ExplodedPart>

      {/* Left Wing Bevel Pinion */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["left-bevel-gear"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "left-bevel-gear"}
        onHover={onHover}
        basePosition={[-0.34, 0.18, 0.08]}
        baseRotation={[0, Math.PI / 4, 0]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("left-bevel-gear")}
        isCurrentlyScanning={activeDiagnosticPartId === "left-bevel-gear"}
      >
        <Gear
          radius={0.16}
          teeth={8}
          speed={1.6}
          thickness={0.03}
          materials={materials}
          gearSpeedMultiplier={effectiveGearSpeed}
          useBrass={true}
        />
      </ExplodedPart>

      {/* Right Wing Bevel Pinion */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["right-bevel-gear"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "right-bevel-gear"}
        onHover={onHover}
        basePosition={[0.34, 0.18, 0.08]}
        baseRotation={[0, -Math.PI / 4, 0]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("right-bevel-gear")}
        isCurrentlyScanning={activeDiagnosticPartId === "right-bevel-gear"}
      >
        <Gear
          radius={0.16}
          teeth={8}
          speed={-1.6}
          thickness={0.03}
          materials={materials}
          gearSpeedMultiplier={effectiveGearSpeed}
          useBrass={true}
        />
      </ExplodedPart>

      {/* ==================== 2. ABDOMEN ==================== */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["abdomen"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "abdomen"}
        onHover={onHover}
        basePosition={[0, -0.05, -0.6]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("abdomen")}
        isCurrentlyScanning={activeDiagnosticPartId === "abdomen"}
      >
        <group ref={abdomenRef}>
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const factor = 1 - idx * 0.14;
            const posZ = -idx * 0.28;
            const radius = 0.32 * factor;
            const length = 0.26;

            return (
              <group key={`abd-seg-${idx}`} position={[0, -idx * 0.03, posZ]}>
                <mesh
                  material={idx % 2 === 0 ? materials.steelMaterial : materials.brassMaterial}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[radius * 0.9, radius, length, 14]} />
                </mesh>
                <mesh material={materials.brassMaterial}>
                  <torusGeometry args={[radius * 1.02, 0.025, 8, 16]} />
                </mesh>
                {[0, 1, 2, 3].map((rIdx) => {
                  const rAngle = (rIdx / 4) * Math.PI * 2;
                  return (
                    <mesh
                      key={`rivet-${idx}-${rIdx}`}
                      material={materials.chromeMaterial}
                      position={[
                        Math.cos(rAngle) * radius * 1.04,
                        Math.sin(rAngle) * radius * 1.04,
                        0,
                      ]}
                    >
                      <sphereGeometry args={[0.025, 6, 6]} />
                    </mesh>
                  );
                })}
              </group>
            );
          })}
          <mesh
            material={materials.brassMaterial}
            position={[0, -0.18, -1.82]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <coneGeometry args={[0.08, 0.45, 12]} />
          </mesh>
        </group>
      </ExplodedPart>

      {/* ==================== 3. HEAD & ANTENNAE ==================== */}
      <Head
        materials={materials}
        gearSpeedMultiplier={effectiveGearSpeed}
        easedProgress={easedProgress}
        hoveredPartId={hoveredPartId}
        onHover={onHover}
        isDiagnosticActive={isScanning}
        scannedParts={scannedPartsSet}
        activeDiagnosticPartId={activeDiagnosticPartId}
      />

      {/* ==================== 4. LEGS ==================== */}
      <Legs
        materials={materials}
        easedProgress={easedProgress}
        hoveredPartId={hoveredPartId}
        onHover={onHover}
        isDiagnosticActive={isScanning}
        scannedParts={scannedPartsSet}
        activeDiagnosticPartId={activeDiagnosticPartId}
      />

      {/* ==================== 5. WINGS ==================== */}
      {/* Left Upper Wing */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["left-upper-wing"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "left-upper-wing"}
        onHover={onHover}
        basePosition={[-0.38, 0.22, 0.12]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("left-upper-wing")}
        isCurrentlyScanning={activeDiagnosticPartId === "left-upper-wing"}
      >
        <group ref={leftUpperWingRef}>
          <Wing side="left" position="upper" materials={materials} />
        </group>
      </ExplodedPart>

      {/* Right Upper Wing */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["right-upper-wing"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "right-upper-wing"}
        onHover={onHover}
        basePosition={[0.38, 0.22, 0.12]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("right-upper-wing")}
        isCurrentlyScanning={activeDiagnosticPartId === "right-upper-wing"}
      >
        <group ref={rightUpperWingRef}>
          <Wing side="right" position="upper" materials={materials} />
        </group>
      </ExplodedPart>

      {/* Left Lower Wing */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["left-lower-wing"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "left-lower-wing"}
        onHover={onHover}
        basePosition={[-0.32, 0.1, -0.18]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("left-lower-wing")}
        isCurrentlyScanning={activeDiagnosticPartId === "left-lower-wing"}
      >
        <group ref={leftLowerWingRef}>
          <Wing side="left" position="lower" materials={materials} />
        </group>
      </ExplodedPart>

      {/* Right Lower Wing */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["right-lower-wing"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "right-lower-wing"}
        onHover={onHover}
        basePosition={[0.32, 0.1, -0.18]}
        isDiagnosticActive={isScanning}
        isScanned={scannedPartsSet.has("right-lower-wing")}
        isCurrentlyScanning={activeDiagnosticPartId === "right-lower-wing"}
      >
        <group ref={rightLowerWingRef}>
          <Wing side="right" position="lower" materials={materials} />
        </group>
      </ExplodedPart>
    </group>
  );
};

// ============================================================================
// MAIN EXPORTED CLIENT COMPONENT: MechanicalButterfly
// ============================================================================

export default function MechanicalButterfly({
  flapSpeed: initialFlapSpeed = 1.0,
  gearSpeedMultiplier = 1.0,
  brassColor = "#dfa83e",
  steelColor = "#252830",
  upperGlassColor = "#e59d38",
  lowerGlassColor = "#1fa396",
  bloomIntensity = 0.65,
  enableControls = true,
  autoRotate = false,
  showSparkles = true,
  showControlsOverlay = true,
  initialLightPosition = [0, 2.5, -4],
  initialLightingPreset = "moonlight",
}: MechanicalButterflyProps) {
  // Atmospheric lighting mood preset state
  const [activePresetKey, setActivePresetKey] = useState<PresetKey>(initialLightingPreset);
  const activePreset = LIGHTING_PRESETS[activePresetKey] ?? LIGHTING_PRESETS.moonlight;
  const bloomRef = useRef<any>(null);

  // Flap speed state
  const [flapSpeed, setFlapSpeed] = useState(initialFlapSpeed);

  // Play mode (Light-chasing game) state
  const [isPlaying, setIsPlaying] = useState(false);

  // Active Light Position state
  const [lightPos, setLightPos] = useState<[number, number, number]>(initialLightPosition);

  // Exploded inspection state
  const [isExploded, setIsExploded] = useState(false);

  // Hovered part tracking
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  // Diagnostic Scan state
  const [diagnosticState, setDiagnosticState] = useState<"IDLE" | "SCANNING" | "COMPLETE">("IDLE");
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [activeScanPart, setActiveScanPart] = useState<ButterflyPartSpec | null>(null);
  const [triggerExplode, setTriggerExplode] = useState(false);

  // Mainspring winding tension state (0 to 1)
  const [windTension, setWindTension] = useState(0.0);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<{
    state: "SHOWCASE" | "SEEKING" | "ORBITING" | "INSPECTION";
    speed: number;
    distance: number;
  }>({
    state: "SHOWCASE",
    speed: 0,
    distance: 0,
  });

  const lastInteractionRef = useRef(Date.now());
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------------------------------------------
  // CHRONOS FLIGHT TRIAL MINI-GAME STATE
  // -------------------------------------------------------------
  const [gameMode, setGameMode] = useState<"OFF" | "MENU" | "PLAYING" | "GAME_OVER">("OFF");

  // Dedicated game-mode theme vs showcase lighting preset
  const effectivePreset = useMemo(() => {
    if (gameMode !== "OFF") {
      return GAME_MODE_THEME.lightingPreset;
    }
    return activePreset;
  }, [gameMode, activePreset]);

  const [playerLane, setPlayerLane] = useState<LaneIndex>(0);
  const [gameScore, setGameScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(22);
  const [gameDistance, setGameDistance] = useState(0);
  const [gearsCollected, setGearsCollected] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [cameraShake, setCameraShake] = useState(0);
  const butterflyXRef = useRef(0);
  const [powerupState, setPowerupState] = useState<{
    slowMoRemaining: number;
    hasShield: boolean;
    magnetRemaining: number;
  }>({ slowMoRemaining: 0, hasShield: false, magnetRemaining: 0 });
  const [gameCombo, setGameCombo] = useState(1);
  const [bannerNotification, setBannerNotification] = useState<string | null>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleBannerNotification = useCallback((text: string) => {
    setBannerNotification(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setBannerNotification(null);
    }, 2200);
  }, []);
  const touchStartPosRef = useRef<number | null>(null);

  // Load persisted high score on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chronos_flight_best_score");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) setBestScore(parsed);
      }
    }
  }, []);

  // Lane switching handler with tactile audio feedback
  const handleShiftLane = useCallback((dir: -1 | 1) => {
    setPlayerLane((prev) => {
      const next = (prev + dir) as LaneIndex;
      const clamped = THREE.MathUtils.clamp(next, -1, 1) as LaneIndex;
      if (clamped !== prev) {
        playLaneSwitchSound();
      }
      return clamped;
    });
  }, []);

  // Keyboard navigation for mini-game
  useEffect(() => {
    if (gameMode !== "PLAYING") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent continuous hold repeat
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        handleShiftLane(-1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        handleShiftLane(1);
      } else if (e.key === "Escape") {
        setGameMode("OFF");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameMode, handleShiftLane]);

  // Touch swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameMode !== "PLAYING") return;
    touchStartPosRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (gameMode !== "PLAYING" || touchStartPosRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartPosRef.current;
    if (deltaX < -32) {
      handleShiftLane(-1);
    } else if (deltaX > 32) {
      handleShiftLane(1);
    }
    touchStartPosRef.current = null;
  };

  // Game flow triggers
  const handleStartRun = useCallback(() => {
    if (isPlaying) setIsPlaying(false);
    if (isExploded) setIsExploded(false);
    setPlayerLane(0);
    setGameScore(0);
    setGearsCollected(0);
    setGameDistance(0);
    setGameSpeed(22);
    setIsNewRecord(false);
    setCameraShake(0);
    setGameMode("PLAYING");
  }, [isPlaying, isExploded]);

  const handleRetryRun = useCallback(() => {
    handleStartRun();
  }, [handleStartRun]);

  const handleExitGame = useCallback(() => {
    setGameMode("OFF");
    setCameraShake(0);
  }, []);

  const handleGameCollision = useCallback(() => {
    setGameMode("GAME_OVER");
    setCameraShake(0.5);

    setGameScore((currentScore) => {
      setBestScore((currentBest) => {
        if (currentScore > currentBest) {
          setIsNewRecord(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("chronos_flight_best_score", currentScore.toString());
          }
          return currentScore;
        }
        return currentBest;
      });
      return currentScore;
    });
  }, []);

  const handleGameCollect = useCallback((_points: number) => {
    setGearsCollected((prev) => prev + 1);
  }, []);

  const handleGameScoreTick = useCallback((score: number, speed: number, distance: number) => {
    setGameScore(score);
    setGameSpeed(speed);
    setGameDistance(distance);
  }, []);

  const handleCameraShake = useCallback((intensity: number) => {
    setCameraShake(intensity);
  }, []);

  // Decay camera shake smoothly
  useEffect(() => {
    if (cameraShake <= 0) return;
    const timer = setTimeout(() => {
      setCameraShake(0);
    }, 380);
    return () => clearTimeout(timer);
  }, [cameraShake]);

  const handlePlaceLight = (point: [number, number, number]) => {
    if (isExploded || !isPlaying || diagnosticState === "SCANNING") return;
    setLightPos(point);
    lastInteractionRef.current = Date.now();
  };

  const randomizeLight = () => {
    if (isExploded || !isPlaying || diagnosticState === "SCANNING") return;
    const rx = (Math.random() - 0.5) * 28;
    const ry = 1.0 + Math.random() * 4.5;
    const rz = (Math.random() - 0.5) * 28;
    handlePlaceLight([rx, ry, rz]);
  };

  // Run diagnostics trigger
  const handleRunDiagnostics = useCallback(() => {
    if (diagnosticState === "SCANNING") return;
    if (isPlaying) setIsPlaying(false);
    if (isExploded) setIsExploded(false);

    setDiagnosticProgress(0);
    setScannedCount(0);
    setActiveScanPart(null);
    setDiagnosticState("SCANNING");
  }, [diagnosticState, isPlaying, isExploded]);

  const handleScanProgress = useCallback(
    (progress: number, count: number, activePart: ButterflyPartSpec | null) => {
      setDiagnosticProgress(progress);
      setScannedCount(count);
      if (activePart) {
        setActiveScanPart(activePart);
      }
    },
    []
  );

  const handleScanComplete = useCallback(() => {
    setDiagnosticState("COMPLETE");
    setDiagnosticProgress(1.0);
    setScannedCount(16);

    // If configured to auto-explode upon scan completion, smoothly expand
    if (triggerExplode) {
      setIsExploded(true);
    }

    // Return diagnostic status to IDLE after 4 seconds
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    completeTimerRef.current = setTimeout(() => {
      setDiagnosticState("IDLE");
      setActiveScanPart(null);
    }, 4500);
  }, [triggerExplode]);

  // Autonomous beacon patrol when idle during play mode
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        isPlaying &&
        !isExploded &&
        diagnosticState !== "SCANNING" &&
        Date.now() - lastInteractionRef.current > 15000
      ) {
        randomizeLight();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [isExploded, isPlaying, diagnosticState]);

  // Hardware-aware performance mode state (auto-detected on mount for laptop/integrated GPUs)
  const [performanceMode, setPerformanceMode] = useState<boolean>(false);

  useEffect(() => {
    setPerformanceMode(detectLowSpecHardware());
  }, []);

  const handleTogglePerformanceMode = useCallback(() => {
    setPerformanceMode((prev) => {
      const next = !prev;
      savePerformancePreference(next);
      return next;
    });
  }, []);

  const materials = useClockworkMaterials(
    brassColor,
    steelColor,
    upperGlassColor,
    lowerGlassColor,
    performanceMode || gameMode !== "OFF"
  );

  const hoveredPart =
    isExploded && hoveredPartId ? BUTTERFLY_PARTS[hoveredPartId] ?? null : null;

  return (
    <div
      className={`relative w-full h-full min-h-screen bg-[#030509] overflow-hidden ${
        isPlaying && !isExploded && gameMode === "OFF" ? "cursor-crosshair" : ""
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Showcase Telemetry & Controls HUD (Only active when mini-game is OFF) */}
      {gameMode === "OFF" && showControlsOverlay && (
        <OverlayHUD
          flightState={telemetry.state}
          speed={telemetry.speed}
          distance={telemetry.distance}
          flapSpeed={flapSpeed}
          setFlapSpeed={setFlapSpeed}
          onRandomizeLight={randomizeLight}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          isExploded={isExploded}
          setIsExploded={setIsExploded}
          hoveredPart={hoveredPart}
          diagnosticState={diagnosticState}
          diagnosticProgress={diagnosticProgress}
          scannedCount={scannedCount}
          activeScanPart={activeScanPart}
          triggerExplode={triggerExplode}
          setTriggerExplode={setTriggerExplode}
          onRunDiagnostics={handleRunDiagnostics}
          windTension={windTension}
          activePreset={activePresetKey}
          onSelectPreset={setActivePresetKey}
          performanceMode={performanceMode}
          onTogglePerformanceMode={handleTogglePerformanceMode}
          onStartGame={() => setGameMode("MENU")}
        />
      )}

      {/* Chronos Flight Trial Mini-Game HUD (Active during MENU, PLAYING, or GAME_OVER) */}
      {gameMode !== "OFF" && (
        <GameHUD
          gameState={gameMode}
          score={gameScore}
          bestScore={bestScore}
          speed={gameSpeed}
          distance={gameDistance}
          gearsCollected={gearsCollected}
          currentLane={playerLane}
          isNewRecord={isNewRecord}
          powerupState={powerupState}
          combo={gameCombo}
          bannerText={bannerNotification}
          performanceMode={performanceMode}
          onTogglePerformanceMode={handleTogglePerformanceMode}
          onStartRun={handleStartRun}
          onRetryRun={handleRetryRun}
          onExitGame={handleExitGame}
          onShiftLane={handleShiftLane}
        />
      )}

      {/* WebGL 3D Canvas */}
      <Canvas
        camera={{ position: [0, 2.2, 9.5], fov: 45 }}
        gl={STABLE_GL_CONFIG}
        dpr={performanceMode ? 1.0 : [1.0, 1.5]}
        className="w-full h-full absolute inset-0"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          const ctx = gl.getContext();
          if (ctx) {
            const origGetAttrs = ctx.getContextAttributes?.bind(ctx);
            ctx.getContextAttributes = () => {
              const res = origGetAttrs ? origGetAttrs() : null;
              return res || { alpha: true, depth: true, stencil: false, antialias: true };
            };
          }
        }}
      >
        <AdaptiveDpr pixelated={false} />
        <AdaptiveEvents />
        <color attach="background" args={[effectivePreset.background.color]} />
        <React.Suspense fallback={null}>

        {/* 3D World Environment, Floor Grid & Depth Fog with Ground Click Receiver */}
        <SceneWorld
          preset={effectivePreset}
          onPlaceLight={handlePlaceLight}
          isPlaying={isPlaying && !isExploded && diagnosticState !== "SCANNING" && gameMode === "OFF"}
        />

        {/* Postprocessing Bloom Controller (lerps bloom intensity smoothly on preset change) */}
        <BloomController preset={effectivePreset} bloomRef={bloomRef} />

        {/* Camera Choreography (Showcase, Exploded View, or Chase Cam in Game Mode) */}
        <CameraChoreographer
          isExploded={isExploded}
          isPlaying={isPlaying}
          isGameMode={gameMode !== "OFF"}
          cameraShake={cameraShake}
        />

        {/* Atmospheric Floating Dust (active in showcase mode only to maximize 60 FPS in game) */}
        {showSparkles && gameMode === "OFF" && (
          <Sparkles
            count={performanceMode ? 16 : 50}
            scale={[45, 24, 45]}
            size={2.2}
            speed={0.25}
            opacity={0.3}
            color="#e2aa45"
          />
        )}

        {/* Interactive Click-to-Place Raycast Plane (Active in Play mode only) */}
        <ClickPlane
          onPlaceLight={handlePlaceLight}
          disabled={isExploded || !isPlaying || diagnosticState === "SCANNING" || gameMode !== "OFF"}
        />

        {/* Glowing Beacon Light Source (Visible in Play mode only) */}
        {isPlaying && !isExploded && diagnosticState !== "SCANNING" && gameMode === "OFF" && (
          <LightSource position={lightPos} color="#ffe29c" intensity={4.5} size={0.32} />
        )}

        {/* 3D Hazard Corridor with Pooled Obstacles & Collectibles (Game Mode) */}
        {gameMode !== "OFF" && (
          <GameCorridor
            isPlaying={gameMode === "PLAYING"}
            isGameOver={gameMode === "GAME_OVER"}
            butterflyXRef={butterflyXRef}
            onCollision={handleGameCollision}
            onCollect={handleGameCollect}
            onScoreTick={handleGameScoreTick}
            onCameraShake={handleCameraShake}
            onPowerupUpdate={setPowerupState}
            onComboUpdate={setGameCombo}
            onNotification={handleBannerNotification}
            materialsBrassColor={brassColor}
            materialsSteelColor={steelColor}
            performanceMode={performanceMode}
          />
        )}

        {/* Clockwork Butterfly Rig with Exploded Inspection & Diagnostics Sweep & Mini-Game Flight */}
        <ButterflyRig
          flapSpeed={flapSpeed}
          gearSpeedMultiplier={gearSpeedMultiplier}
          materials={materials}
          targetLightPos={lightPos}
          isPlaying={isPlaying}
          isExploded={isExploded}
          hoveredPartId={hoveredPartId}
          onHover={setHoveredPartId}
          onTelemetryUpdate={(state, speed, distance) => {
            setTelemetry({ state, speed, distance });
          }}
          diagnosticState={diagnosticState}
          onScanProgress={handleScanProgress}
          onScanComplete={handleScanComplete}
          onTensionUpdate={setWindTension}
          isGameMode={gameMode !== "OFF"}
          gameTargetLane={playerLane}
          butterflyXRef={butterflyXRef}
        />

        {/* Camera Orbit Controls (Active only in showcase mode) */}
        {enableControls && gameMode === "OFF" && (
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            target={[0, 1.2, 0]}
            autoRotate={autoRotate && !isExploded && !isPlaying && diagnosticState !== "SCANNING"}
            autoRotateSpeed={0.3}
            minDistance={0.8}
            maxDistance={48.0}
            maxPolarAngle={Math.PI / 2 + 0.15}
            minPolarAngle={Math.PI / 16}
          />
        )}

        {/* Postprocessing Bloom Pass (bypassed in Performance Mode for direct-to-screen 60 FPS) */}
        {!performanceMode && (
          <SafeEffectComposer>
            <EffectComposer multisampling={0}>
              <Bloom
                ref={bloomRef}
                luminanceThreshold={activePreset.bloom.luminanceThreshold}
                luminanceSmoothing={0.25}
                intensity={activePreset.bloom.intensity}
                mipmapBlur
              />
            </EffectComposer>
          </SafeEffectComposer>
        )}
        </React.Suspense>
      </Canvas>
    </div>
  );
}
