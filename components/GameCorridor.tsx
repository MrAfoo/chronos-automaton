"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  playCollectSound,
  playPowerupSound,
  playShieldDeflectSound,
  playCrashSound,
} from "./soundFX";
import { PresetKey } from "./lightingPresets";
import { GAME_MODE_THEME } from "./gameTheme";

// Preload all three Kenney CC0 models at module scope outside render loop to eliminate pop-in
useGLTF.preload("/models/coin.glb");
useGLTF.preload("/models/trap.glb");
useGLTF.preload("/models/column.glb");

export const LANE_WIDTH = 2.2;
export const LANE_COORDS = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export type LaneIndex = -1 | 0 | 1;

// Calibration constants based on Box3 model inspection:
// 1. Coin: diameter ~0.415, height ~0.417. Scaling by 2.0 -> ~0.83 diameter.
// Center Y offset = -0.208 (local origin centered at geometric middle).
const COIN_SCALE: [number, number, number] = [2.0, 2.0, 2.0];
const COIN_LOCAL_OFFSET: [number, number, number] = [0, -0.208, 0];

// 2. Trap (Obstacle Type 1): width 0.79, height 0.283.
// Scaling X/Z by 2.4 -> width 1.90 across 2.2-wide lane.
// Scaling Y by 4.5 -> height 1.27, lethal spikes rising through player's 0.85 flight altitude.
const TRAP_SCALE: [number, number, number] = [2.4, 4.5, 2.4];
const TRAP_LOCAL_OFFSET: [number, number, number] = [0, 0, 0];

// 3. Column (Obstacle Type 2): width 0.5, height 1.10.
// Scaling X/Z by 2.2 -> width 1.10 across 2.2-wide lane.
// Scaling Y by 3.4 -> height 3.74, towering stone/metal pillar rising from floor past flight altitude.
const COLUMN_SCALE: [number, number, number] = [2.2, 3.4, 2.2];
const COLUMN_LOCAL_OFFSET: [number, number, number] = [0, 0, 0];

export interface PowerupState {
  slowMoRemaining: number;
  hasShield: boolean;
  magnetRemaining: number;
}

export interface GameCorridorProps {
  isPlaying: boolean;
  isGameOver: boolean;
  butterflyXRef?: React.MutableRefObject<number>;
  butterflyX?: number;
  corridorTheme?: PresetKey;
  onCollision: () => void;
  onCollect: (points: number) => void;
  onScoreTick: (score: number, speed: number, distance: number) => void;
  onCameraShake: (intensity: number) => void;
  onPowerupUpdate?: (state: PowerupState) => void;
  onComboUpdate?: (combo: number) => void;
  onNotification?: (text: string) => void;
  materialsBrassColor?: string;
  materialsSteelColor?: string;
  performanceMode?: boolean;
}

interface ObstaclePoolItem {
  active: boolean;
  lane: LaneIndex;
  z: number;
  type: 1 | 2; // 1 = Spiked Floor Trap, 2 = Towering Dungeon Column
}

interface CollectiblePoolItem {
  active: boolean;
  lane: LaneIndex;
  x: number;
  z: number;
  collected: boolean;
  popScale: number;
  rotation: number;
  itemType: 0 | 1 | 2 | 3; // 0 = Golden Coin, 1 = Hourglass SlowMo, 2 = Aegis Shield, 3 = Magnet
}

const POOL_OBSTACLES_COUNT = 15;
const POOL_COLLECTIBLES_COUNT = 14;
const SPAWN_Z = -54;
const DESPAWN_Z = 6.5;

const GameCorridorComponent: React.FC<GameCorridorProps> = ({
  isPlaying,
  isGameOver,
  butterflyXRef,
  butterflyX = 0,
  corridorTheme = "studio",
  onCollision,
  onCollect,
  onScoreTick,
  onCameraShake,
  onPowerupUpdate,
  onComboUpdate,
  onNotification,
  materialsBrassColor,
  materialsSteelColor,
  performanceMode = false,
}) => {
  // -------------------------------------------------------------
  // 1. REFS & STATE FOR GAMEPLAY LOOP
  // -------------------------------------------------------------
  const speedRef = useRef(22.0);
  const scoreRef = useRef(0);
  const distanceRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const telemetryTimerRef = useRef(0);

  // Power-up timers & state
  const slowMoTimerRef = useRef(0);
  const hasShieldRef = useRef(false);
  const magnetTimerRef = useRef(0);
  const invulnTimerRef = useRef(0);
  const comboStreakRef = useRef(1);

  // Mesh Refs for pre-allocated pooled objects
  const obstacleGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const obsTrapRefs = useRef<(THREE.Group | null)[]>([]);
  const obsColumnRefs = useRef<(THREE.Group | null)[]>([]);

  // Collectibles sub-mesh refs
  const collectibleGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const collCoinRefs = useRef<(THREE.Group | null)[]>([]);
  const collHourglassRefs = useRef<(THREE.Group | null)[]>([]);
  const collShieldRefs = useRef<(THREE.Group | null)[]>([]);
  const collMagnetRefs = useRef<(THREE.Group | null)[]>([]);

  const trackStripesRef = useRef<THREE.Group>(null);
  const archesGroupRef = useRef<THREE.Group>(null);
  const shieldAuraRef = useRef<THREE.Group>(null);

  // Load glTF models via useGLTF hook
  const coinGLTF = useGLTF("/models/coin.glb");
  const trapGLTF = useGLTF("/models/trap.glb");
  const columnGLTF = useGLTF("/models/column.glb");

  // Inspect models' bounding boxes after loading for verification & calibration
  useEffect(() => {
    if (coinGLTF.scene && trapGLTF.scene && columnGLTF.scene) {
      const coinBox = new THREE.Box3().setFromObject(coinGLTF.scene);
      const trapBox = new THREE.Box3().setFromObject(trapGLTF.scene);
      const columnBox = new THREE.Box3().setFromObject(columnGLTF.scene);
      const coinSize = new THREE.Vector3();
      const trapSize = new THREE.Vector3();
      const columnSize = new THREE.Vector3();
      coinBox.getSize(coinSize);
      trapBox.getSize(trapSize);
      columnBox.getSize(columnSize);
      console.log("[GameCorridor] Kenney Models Bounding Boxes:", {
        coin: { min: coinBox.min.toArray(), max: coinBox.max.toArray(), size: coinSize.toArray() },
        trap: { min: trapBox.min.toArray(), max: trapBox.max.toArray(), size: trapSize.toArray() },
        column: { min: columnBox.min.toArray(), max: columnBox.max.toArray(), size: columnSize.toArray() },
      });
    }
  }, [coinGLTF.scene, trapGLTF.scene, columnGLTF.scene]);

  // Dedicated game-theme materials:
  // 1. Coin: warm brass/gold with vibrant emissive core for clear "collect me" readability
  const coinMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(GAME_MODE_THEME.coinColor),
      metalness: 0.9,
      roughness: 0.28,
      emissive: new THREE.Color(GAME_MODE_THEME.coinEmissive),
      emissiveIntensity: 0.75,
      side: THREE.FrontSide,
    });
  }, []);

  // 2. Obstacle Base (trap frame & column base): dark gunmetal with warm hazard red-orange rim
  const obstacleBaseMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(GAME_MODE_THEME.hazardBaseColor),
      metalness: 0.85,
      roughness: 0.35,
      emissive: new THREE.Color(GAME_MODE_THEME.hazardEmissive),
      emissiveIntensity: GAME_MODE_THEME.hazardEmissiveIntensity,
      side: THREE.FrontSide,
    });
  }, []);

  // 3. Lethal Trap Spikes: glowing warning red for unmistakable hazard recognition
  const spikeHazardMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#450a0a"),
      metalness: 0.6,
      roughness: 0.25,
      emissive: new THREE.Color(GAME_MODE_THEME.spikeEmissive),
      emissiveIntensity: GAME_MODE_THEME.spikeEmissiveIntensity,
      side: THREE.FrontSide,
    });
  }, []);

  // Pre-clone glTF scenes once per pooled instance at pool-creation time (plain .clone() for static props)
  const pooledObstacleScenes = useMemo(() => {
    return Array.from({ length: POOL_OBSTACLES_COUNT }, () => {
      // Clone trap (obstacle type 1)
      const trapClone = trapGLTF.scene.clone(true);
      trapClone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          if (child.name.toLowerCase().includes("spike")) {
            (child as THREE.Mesh).material = spikeHazardMaterial;
          } else {
            (child as THREE.Mesh).material = obstacleBaseMaterial;
          }
        }
      });

      // Clone column (obstacle type 2)
      const columnClone = columnGLTF.scene.clone(true);
      columnClone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = obstacleBaseMaterial;
        }
      });

      return { trap: trapClone, column: columnClone };
    });
  }, [trapGLTF.scene, columnGLTF.scene, obstacleBaseMaterial, spikeHazardMaterial]);

  const pooledCoinScenes = useMemo(() => {
    return Array.from({ length: POOL_COLLECTIBLES_COUNT }, () => {
      const coinClone = coinGLTF.scene.clone(true);
      coinClone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = coinMaterial;
        }
      });
      return coinClone;
    });
  }, [coinGLTF.scene, coinMaterial]);

  // Object pool data (zero per-frame garbage collection)
  const obstaclesData = useRef<ObstaclePoolItem[]>(
    Array.from({ length: POOL_OBSTACLES_COUNT }, () => ({
      active: false,
      lane: 0,
      z: 100,
      type: 1,
    }))
  );

  const collectiblesData = useRef<CollectiblePoolItem[]>(
    Array.from({ length: POOL_COLLECTIBLES_COUNT }, () => ({
      active: false,
      lane: 0,
      x: 0,
      z: 100,
      collected: false,
      popScale: 1,
      rotation: 0,
      itemType: 0,
    }))
  );

  // Reset pools and state when a new game starts
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      speedRef.current = 22.0;
      scoreRef.current = 0;
      distanceRef.current = 0;
      spawnTimerRef.current = 0.5;
      slowMoTimerRef.current = 0;
      hasShieldRef.current = false;
      magnetTimerRef.current = 0;
      invulnTimerRef.current = 0;
      comboStreakRef.current = 1;

      onPowerupUpdate?.({ slowMoRemaining: 0, hasShield: false, magnetRemaining: 0 });
      onComboUpdate?.(1);

      for (let i = 0; i < POOL_OBSTACLES_COUNT; i++) {
        obstaclesData.current[i].active = false;
        obstaclesData.current[i].z = 100;
        const grp = obstacleGroupRefs.current[i];
        if (grp) grp.visible = false;
      }

      for (let i = 0; i < POOL_COLLECTIBLES_COUNT; i++) {
        collectiblesData.current[i].active = false;
        collectiblesData.current[i].z = 100;
        collectiblesData.current[i].collected = false;
        collectiblesData.current[i].popScale = 1;
        const grp = collectibleGroupRefs.current[i];
        if (grp) {
          grp.visible = false;
          grp.scale.set(1, 1, 1);
        }
      }
    }
  }, [isPlaying, isGameOver, onPowerupUpdate, onComboUpdate]);

  // -------------------------------------------------------------
  // 2. PROCEDURAL HIGH-PERFORMANCE EMISSIVE MATERIALS (GAME MODE)
  // -------------------------------------------------------------
  const materials = useMemo(() => {
    return {
      // Vivid Amber outer rails defining corridor bounds
      railMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(GAME_MODE_THEME.railColor),
        transparent: true,
        opacity: 0.95,
      }),
      // Bright, crisp lane divider lines
      dividerMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(GAME_MODE_THEME.dividerColor),
        transparent: true,
        opacity: 0.8,
      }),
      // Scrolling ground hazard ties
      stripeMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(GAME_MODE_THEME.stripeColor),
        transparent: true,
        opacity: 0.35,
      }),
      // Grand caliber archways
      archMaterial: new THREE.MeshStandardMaterial({
        color: new THREE.Color(GAME_MODE_THEME.archColor),
        metalness: 0.85,
        roughness: 0.3,
      }),
      archGlowMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(GAME_MODE_THEME.archGlowColor),
      }),
      hourglassMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color("#00f5ff"),
      }),
      shieldMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color("#a855f7"),
      }),
      magnetMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color("#10b981"),
      }),
      shieldAuraMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color("#a855f7"),
        transparent: true,
        opacity: 0.45,
        wireframe: true,
      }),
      // Warning perimeter ring decal on the track beneath obstacles
      hazardPerimeterMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(GAME_MODE_THEME.hazardEmissive),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    };
  }, []);

  // Pre-allocated shared geometries & materials to eliminate per-frame garbage collection
  const hazardPerimeterGeo = useMemo(() => new THREE.RingGeometry(0.78, 0.94, 20), []);
  const coinHaloGeo = useMemo(() => new THREE.RingGeometry(0.38, 0.44, 16), []);
  const coinHaloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fef08a",
        transparent: true,
        opacity: 0.35,
        side: THREE.FrontSide,
      }),
    []
  );
  const stripeGeo = useMemo(() => new THREE.PlaneGeometry(6.6, 0.14), []);
  const archColumnGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.22, 4.4, 8), []);
  const archBeamGeo = useMemo(() => new THREE.BoxGeometry(7.8, 0.24, 0.35), []);
  const archRingGeo = useMemo(() => new THREE.RingGeometry(0.32, 0.42, 16), []);

  // -------------------------------------------------------------
  // 3. MAIN GAME FRAME LOOP
  // -------------------------------------------------------------
  useFrame((state, delta) => {
    if (!isPlaying || isGameOver) return;
    const rawDt = Math.min(delta, 0.05);
    const curX = butterflyXRef ? butterflyXRef.current : butterflyX;

    // Power-up countdowns
    if (slowMoTimerRef.current > 0) {
      slowMoTimerRef.current = Math.max(0, slowMoTimerRef.current - rawDt);
    }
    if (magnetTimerRef.current > 0) {
      magnetTimerRef.current = Math.max(0, magnetTimerRef.current - rawDt);
    }
    if (invulnTimerRef.current > 0) {
      invulnTimerRef.current = Math.max(0, invulnTimerRef.current - rawDt);
    }

    // Temporal dilation slow-motion: speed is halved during slow-mo!
    const isSlowMo = slowMoTimerRef.current > 0;
    const timeScale = isSlowMo ? 0.52 : 1.0;
    const dt = rawDt * timeScale;

    // Speed ramp: increases from 22 up to 46 units/sec
    const baseSpeed = THREE.MathUtils.clamp(
      22.0 + scoreRef.current * 0.005 + distanceRef.current * 0.01,
      22.0,
      46.0
    );
    const currentSpeed = baseSpeed * timeScale;
    speedRef.current = currentSpeed;

    // Distance & passive survival score
    distanceRef.current += currentSpeed * dt;
    scoreRef.current += Math.round(currentSpeed * dt * 2.2);

    // Throttled UI Telemetry (~8 updates/sec for smooth main-thread budget)
    telemetryTimerRef.current += rawDt;
    if (telemetryTimerRef.current > 0.12) {
      telemetryTimerRef.current = 0;
      onScoreTick(scoreRef.current, Math.round(currentSpeed), Math.round(distanceRef.current));
      onPowerupUpdate?.({
        slowMoRemaining: Math.ceil(slowMoTimerRef.current),
        hasShield: hasShieldRef.current,
        magnetRemaining: Math.ceil(magnetTimerRef.current),
      });
      onComboUpdate?.(comboStreakRef.current);
    }

    // Scroll floor hazard stripes
    if (trackStripesRef.current) {
      trackStripesRef.current.position.z = (distanceRef.current * 0.8) % 6.0;
    }

    // Scroll overhead archways
    if (archesGroupRef.current) {
      archesGroupRef.current.position.z = (distanceRef.current * 0.8) % 24.0;
    }

    // Animate Shield Aura on butterfly if active
    if (shieldAuraRef.current) {
      shieldAuraRef.current.visible = hasShieldRef.current;
      if (hasShieldRef.current) {
        shieldAuraRef.current.position.set(curX, 0.85, 0);
        shieldAuraRef.current.rotation.y += rawDt * 3.5;
        shieldAuraRef.current.rotation.z += rawDt * 2.0;
      }
    }

    // -----------------------------------------------------------
    // A. SPAWN MANAGEMENT (PROCEDURAL WAVE GENERATOR)
    // -----------------------------------------------------------
    spawnTimerRef.current -= dt;
    if (spawnTimerRef.current <= 0) {
      const nextInterval = THREE.MathUtils.lerp(
        1.4,
        0.8,
        (baseSpeed - 22.0) / 24.0
      );
      spawnTimerRef.current = nextInterval;

      // Determine wave configuration: 1 or 2 obstacles (NEVER all 3)
      const isDoubleObstacle = Math.random() < 0.42;
      const allLanes: LaneIndex[] = [-1, 0, 1];
      const shuffledLanes = [...allLanes].sort(() => Math.random() - 0.5);

      const obstacleLanes: LaneIndex[] = isDoubleObstacle
        ? [shuffledLanes[0], shuffledLanes[1]]
        : [shuffledLanes[0]];

      // Spawn obstacles
      for (const lane of obstacleLanes) {
        const poolIdx = obstaclesData.current.findIndex((o) => !o.active);
        if (poolIdx !== -1) {
          const item = obstaclesData.current[poolIdx];
          item.active = true;
          item.lane = lane;
          item.z = SPAWN_Z;
          // Randomly choose between 2 obstacle types: 1 = Spiked Floor Trap, 2 = Towering Pillar Column
          item.type = (Math.random() < 0.5 ? 1 : 2) as 1 | 2;

          const grp = obstacleGroupRefs.current[poolIdx];
          if (grp) {
            grp.position.set(lane * LANE_WIDTH, 0, item.z);
            grp.visible = true;

            // Toggle active visual subtype
            if (obsTrapRefs.current[poolIdx]) obsTrapRefs.current[poolIdx]!.visible = item.type === 1;
            if (obsColumnRefs.current[poolIdx]) obsColumnRefs.current[poolIdx]!.visible = item.type === 2;
          }
        }
      }

      // Collectible Spawn: 60% chance to spawn in an open lane
      const openLanes = allLanes.filter((l) => !obstacleLanes.includes(l));
      if (openLanes.length > 0 && Math.random() < 0.6) {
        const targetCollectLane = openLanes[Math.floor(Math.random() * openLanes.length)];
        const collIdx = collectiblesData.current.findIndex((c) => !c.active);
        if (collIdx !== -1) {
          const coll = collectiblesData.current[collIdx];
          coll.active = true;
          coll.lane = targetCollectLane;
          coll.x = targetCollectLane * LANE_WIDTH;
          coll.z = SPAWN_Z;
          coll.collected = false;
          coll.popScale = 1;

          // Powerup type roll: 75% Coin, 10% SlowMo, 8% Shield, 7% Magnet
          const roll = Math.random();
          if (roll < 0.75) coll.itemType = 0; // Coin
          else if (roll < 0.85) coll.itemType = 1; // Hourglass
          else if (roll < 0.93) coll.itemType = 2; // Shield
          else coll.itemType = 3; // Magnet

          const grp = collectibleGroupRefs.current[collIdx];
          if (grp) {
            grp.position.set(coll.x, 0.92, coll.z);
            grp.scale.set(1, 1, 1);
            grp.visible = true;

            // Toggle visual meshes for collectible type
            if (collCoinRefs.current[collIdx]) collCoinRefs.current[collIdx]!.visible = coll.itemType === 0;
            if (collHourglassRefs.current[collIdx]) collHourglassRefs.current[collIdx]!.visible = coll.itemType === 1;
            if (collShieldRefs.current[collIdx]) collShieldRefs.current[collIdx]!.visible = coll.itemType === 2;
            if (collMagnetRefs.current[collIdx]) collMagnetRefs.current[collIdx]!.visible = coll.itemType === 3;
          }
        }
      }
    }

    // -----------------------------------------------------------
    // B. UPDATE ACTIVE OBSTACLES & DETECT COLLISIONS
    // -----------------------------------------------------------
    const timeNow = state.clock.getElapsedTime();

    for (let i = 0; i < POOL_OBSTACLES_COUNT; i++) {
      const obs = obstaclesData.current[i];
      if (!obs.active) continue;

      obs.z += currentSpeed * dt;
      const grp = obstacleGroupRefs.current[i];
      if (grp) {
        grp.position.z = obs.z;
      }

      // Check collision near z = 0 (butterfly's forward position)
      if (Math.abs(obs.z - 0) < 0.72) {
        const obstacleX = obs.lane * LANE_WIDTH;
        const xDist = Math.abs(curX - obstacleX);
        if (xDist < 0.92) {
          // Check if shielded or invulnerable
          if (invulnTimerRef.current > 0) {
            // Passthrough during brief post-deflection invulnerability
          } else if (hasShieldRef.current) {
            // SHIELD ABSORPTION SAVE!
            hasShieldRef.current = false;
            invulnTimerRef.current = 1.4;
            playShieldDeflectSound();
            onCameraShake(0.55);
            onNotification?.("AEGIS SHIELD ABSORPTION - DEFLECTED!");
            // Deactivate this obstacle so it doesn't double hit
            obs.active = false;
            if (grp) grp.visible = false;
          } else {
            // FATAL COLLISION
            playCrashSound();
            onCameraShake(0.65);
            comboStreakRef.current = 1;
            onCollision();
            return;
          }
        }
      }

      // Recycle if passed behind the camera
      if (obs.z > DESPAWN_Z) {
        obs.active = false;
        if (grp) grp.visible = false;
      }
    }

    // -----------------------------------------------------------
    // C. UPDATE ACTIVE COLLECTIBLES & MAGNET ATTRACTION
    // -----------------------------------------------------------
    const isMagnetActive = magnetTimerRef.current > 0;

    for (let i = 0; i < POOL_COLLECTIBLES_COUNT; i++) {
      const coll = collectiblesData.current[i];
      if (!coll.active) continue;

      coll.z += currentSpeed * dt;
      coll.rotation += rawDt * 4.0;
      const grp = collectibleGroupRefs.current[i];

      // Magnet attraction physics
      if (isMagnetActive && !coll.collected && coll.z > -28 && coll.z < 2) {
        coll.x = THREE.MathUtils.damp(coll.x, curX, 8.0, rawDt);
      }

      if (coll.collected) {
        // Pop expansion animation on pickup
        coll.popScale += rawDt * 7.0;
        if (grp) {
          grp.scale.setScalar(coll.popScale);
          if (coll.popScale > 2.4 || coll.z > DESPAWN_Z) {
            coll.active = false;
            grp.visible = false;
          }
        }
      } else {
        if (grp) {
          const bobY = 0.92 + Math.sin(timeNow * 4.0 + i * 0.7) * 0.08;
          grp.position.set(coll.x, bobY, coll.z);
          grp.rotation.y = coll.rotation;
        }

        // Check pickup near z = 0
        if (Math.abs(coll.z - 0) < 0.95) {
          const xDist = Math.abs(curX - coll.x);
          if (xDist < 1.1) {
            // PICKUP!
            coll.collected = true;
            coll.popScale = 1.0;

            if (coll.itemType === 0) {
              // Standard Chronos Cog
              const currentCombo = comboStreakRef.current;
              const pointsEarned = 150 * currentCombo;
              scoreRef.current += pointsEarned;
              comboStreakRef.current = Math.min(5, currentCombo + 1);
              onCollect(pointsEarned);
              playCollectSound(currentCombo);
              onCameraShake(0.08);
            } else if (coll.itemType === 1) {
              // Temporal Hourglass (Slow-Mo)
              slowMoTimerRef.current = 6.0;
              scoreRef.current += 300;
              onCollect(300);
              playPowerupSound("slowmo");
              onNotification?.("TEMPORAL DILATION ACTIVE • SLOW-MO");
              onCameraShake(0.18);
            } else if (coll.itemType === 2) {
              // Aegis Shield
              hasShieldRef.current = true;
              scoreRef.current += 300;
              onCollect(300);
              playPowerupSound("shield");
              onNotification?.("AEGIS CHRONO-SHIELD EQUIPPED");
              onCameraShake(0.18);
            } else if (coll.itemType === 3) {
              // Chrono Magnet
              magnetTimerRef.current = 8.0;
              scoreRef.current += 300;
              onCollect(300);
              playPowerupSound("magnet");
              onNotification?.("CHRONO-MAGNET ACTIVE");
              onCameraShake(0.18);
            }
          }
        }

        // Recycle if missed
        if (coll.z > DESPAWN_Z) {
          coll.active = false;
          if (grp) grp.visible = false;
        }
      }
    }
  });

  return (
    <group>
      {/* =====================================================================
          1. HAZARD CORRIDOR RAILS & TRACK MARKINGS
      ====================================================================== */}
      {/* 4 Longitudinal Track Rails */}
      {[-3.3, -1.1, 1.1, 3.3].map((rx, idx) => {
        const isOuter = idx === 0 || idx === 3;
        return (
          <mesh
            key={`rail-${idx}`}
            position={[rx, -0.05, -25]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[isOuter ? 0.11 : 0.055, 80]} />
            <primitive object={isOuter ? materials.railMaterial : materials.dividerMaterial} />
          </mesh>
        );
      })}

      {/* Scrolling Hazard Ground Stripes */}
      <group ref={trackStripesRef}>
        {Array.from({ length: 14 }).map((_, idx) => (
          <mesh
            key={`stripe-${idx}`}
            position={[0, -0.06, -idx * 5.0]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={stripeGeo}
          >
            <primitive object={materials.stripeMaterial} />
          </mesh>
        ))}
      </group>

      {/* Scrolling Grand Clockwork Caliber Archways */}
      <group ref={archesGroupRef}>
        {[-72, -48, -24, 0, 24].map((az, idx) => (
          <group key={`arch-${idx}`} position={[0, 0, az]}>
            {/* Left Column */}
            <mesh position={[-3.8, 2.2, 0]} geometry={archColumnGeo}>
              <primitive object={materials.archMaterial} />
            </mesh>
            {/* Right Column */}
            <mesh position={[3.8, 2.2, 0]} geometry={archColumnGeo}>
              <primitive object={materials.archMaterial} />
            </mesh>
            {/* Overhead Transverse Beam */}
            <mesh position={[0, 4.3, 0]} geometry={archBeamGeo}>
              <primitive object={materials.archMaterial} />
            </mesh>
            {/* Glowing Horology Indicator Ring */}
            <mesh position={[0, 4.3, 0.2]} geometry={archRingGeo}>
              <primitive object={materials.archGlowMaterial} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Dynamic Aegis Shield Aura on Butterfly */}
      <group ref={shieldAuraRef} visible={false}>
        <mesh>
          <icosahedronGeometry args={[0.72, 1]} />
          <primitive object={materials.shieldAuraMaterial} />
        </mesh>
      </group>

      {/* =====================================================================
          2. POOLED OBSTACLES (KENNEY GLTF DUNGEON MODELS: TRAP & COLUMN)
      ====================================================================== */}
      {Array.from({ length: POOL_OBSTACLES_COUNT }).map((_, i) => (
        <group
          key={`obs-${i}`}
          ref={(el) => {
            obstacleGroupRefs.current[i] = el;
          }}
          visible={false}
          position={[0, 0, 100]}
        >
          {/* Warning perimeter decal on track beneath obstacle */}
          <mesh
            position={[0, 0.015, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={hazardPerimeterGeo}
          >
            <primitive object={materials.hazardPerimeterMaterial} />
          </mesh>

          {/* TYPE 1: Spiked Floor Trap (Obstacle Type 1) */}
          <group
            ref={(el) => {
              obsTrapRefs.current[i] = el;
            }}
            scale={TRAP_SCALE}
            position={TRAP_LOCAL_OFFSET}
            visible={false}
          >
            <primitive object={pooledObstacleScenes[i].trap} />
          </group>

          {/* TYPE 2: Towering Dungeon Pillar Column (Obstacle Type 2) */}
          <group
            ref={(el) => {
              obsColumnRefs.current[i] = el;
            }}
            scale={COLUMN_SCALE}
            position={COLUMN_LOCAL_OFFSET}
            visible={false}
          >
            <primitive object={pooledObstacleScenes[i].column} />
          </group>
        </group>
      ))}

      {/* =====================================================================
          3. POOLED COLLECTIBLES & POWERUPS (KENNEY GLTF COIN & POWERUP PROPS)
      ====================================================================== */}
      {Array.from({ length: POOL_COLLECTIBLES_COUNT }).map((_, i) => (
        <group
          key={`coll-${i}`}
          ref={(el) => {
            collectibleGroupRefs.current[i] = el;
          }}
          visible={false}
          position={[0, 0.92, 100]}
        >
          {/* TYPE 0: Golden Coin Collectible (Kenney CC0 Coin with Emissive Rim Glow) */}
          <group
            ref={(el) => {
              collCoinRefs.current[i] = el;
            }}
          >
            <group scale={COIN_SCALE} position={COIN_LOCAL_OFFSET}>
              <primitive object={pooledCoinScenes[i]} />
            </group>
            {/* Emissive blooming rim halo behind/around the coin */}
            <mesh rotation={[0, 0, 0]} geometry={coinHaloGeo} material={coinHaloMat} />
          </group>

          {/* TYPE 1: Temporal Hourglass (Slow-Mo) */}
          <group
            ref={(el) => {
              collHourglassRefs.current[i] = el;
            }}
            visible={false}
          >
            <mesh position={[0, 0.16, 0]}>
              <coneGeometry args={[0.22, 0.32, 12]} />
              <primitive object={materials.hourglassMaterial} />
            </mesh>
            <mesh position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.22, 0.32, 12]} />
              <primitive object={materials.hourglassMaterial} />
            </mesh>
          </group>

          {/* TYPE 2: Aegis Shield */}
          <group
            ref={(el) => {
              collShieldRefs.current[i] = el;
            }}
            visible={false}
          >
            <mesh>
              <dodecahedronGeometry args={[0.26, 0]} />
              <primitive object={materials.shieldMaterial} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.36, 0.035, 8, 16]} />
              <primitive object={materials.shieldMaterial} />
            </mesh>
          </group>

          {/* TYPE 3: Chrono Magnet */}
          <group
            ref={(el) => {
              collMagnetRefs.current[i] = el;
            }}
            visible={false}
          >
            <mesh rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.26, 0.06, 8, 16, Math.PI]} />
              <primitive object={materials.magnetMaterial} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

export const GameCorridor = React.memo(GameCorridorComponent);
