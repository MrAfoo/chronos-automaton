"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUTTERFLY_PARTS } from "./butterflyData";
import { ExplodedPart } from "./ExplodedPart";

// ============================================================================
// SHARED MATERIALS INTERFACE
// ============================================================================

export interface ClockworkMaterials {
  brassMaterial: THREE.MeshStandardMaterial;
  steelMaterial: THREE.MeshStandardMaterial;
  chromeMaterial: THREE.MeshStandardMaterial;
  jewelMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  upperGlassMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  lowerGlassMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
}

export function useClockworkMaterials(
  brassColor: string,
  steelColor: string,
  upperGlassColor: string,
  lowerGlassColor: string,
  performanceMode = false
): ClockworkMaterials {
  return useMemo(() => {
    const brassMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(brassColor),
      metalness: 0.72,
      roughness: 0.28,
      side: THREE.DoubleSide,
    });

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(steelColor),
      metalness: 0.65,
      roughness: 0.38,
      side: THREE.DoubleSide,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e2e8f0"),
      metalness: 0.85,
      roughness: 0.16,
      side: THREE.DoubleSide,
    });

    // When performanceMode is active, use high-efficiency MeshStandardMaterial with transparent alpha
    // instead of MeshPhysicalMaterial with transmission > 0.
    // This completely prevents Three.js from allocating an offscreen transmission render target
    // and performing expensive framebuffer copy passes every frame, saving massive memory bandwidth on iGPUs!
    const jewelMaterial = performanceMode
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color("#dc2626"),
          emissive: new THREE.Color("#ef4444"),
          emissiveIntensity: 0.45,
          roughness: 0.15,
          metalness: 0.25,
          transparent: true,
          opacity: 0.9,
          side: THREE.FrontSide,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#dc2626"),
          emissive: new THREE.Color("#991b1b"),
          emissiveIntensity: 0.35,
          transmission: 0.65,
          thickness: 0.5,
          roughness: 0.1,
          ior: 1.76,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
        });

    const upperGlassMaterial = performanceMode
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(upperGlassColor),
          emissive: new THREE.Color(upperGlassColor),
          emissiveIntensity: 0.28,
          roughness: 0.15,
          metalness: 0.12,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(upperGlassColor),
          emissive: new THREE.Color(upperGlassColor),
          emissiveIntensity: 0.16,
          transmission: 0.62,
          thickness: 0.35,
          roughness: 0.12,
          ior: 1.52,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

    const lowerGlassMaterial = performanceMode
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(lowerGlassColor),
          emissive: new THREE.Color(lowerGlassColor),
          emissiveIntensity: 0.28,
          roughness: 0.15,
          metalness: 0.12,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(lowerGlassColor),
          emissive: new THREE.Color(lowerGlassColor),
          emissiveIntensity: 0.16,
          transmission: 0.62,
          thickness: 0.35,
          roughness: 0.12,
          ior: 1.52,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

    return {
      brassMaterial,
      steelMaterial,
      chromeMaterial,
      jewelMaterial,
      upperGlassMaterial,
      lowerGlassMaterial,
    };
  }, [brassColor, steelColor, upperGlassColor, lowerGlassColor, performanceMode]);
}

// ============================================================================
// PROCEDURAL CLOCKWORK GEAR COMPONENT
// ============================================================================

export interface GearProps {
  radius: number;
  teeth: number;
  speed: number;
  thickness?: number;
  axis?: "x" | "y" | "z";
  spokes?: number;
  gearSpeedMultiplier?: number;
  materials: ClockworkMaterials;
  useBrass?: boolean;
}

export const Gear: React.FC<GearProps> = ({
  radius,
  teeth,
  speed,
  thickness = 0.04,
  axis = "z",
  spokes = 4,
  gearSpeedMultiplier = 1.0,
  materials,
  useBrass = true,
}) => {
  const gearRef = useRef<THREE.Group>(null);
  const toothWidth = (Math.PI * 2 * radius) / (teeth * 2.2);
  const toothDepth = radius * 0.18;

  useFrame((_, delta) => {
    if (gearRef.current) {
      gearRef.current.rotation[axis] += speed * gearSpeedMultiplier * delta;
    }
  });

  const mat = useBrass ? materials.brassMaterial : materials.steelMaterial;
  const hubMat = useBrass ? materials.steelMaterial : materials.brassMaterial;

  const toothAngles = useMemo(() => {
    const angles: number[] = [];
    for (let i = 0; i < teeth; i++) {
      angles.push((i / teeth) * Math.PI * 2);
    }
    return angles;
  }, [teeth]);

  const spokeAngles = useMemo(() => {
    const angles: number[] = [];
    for (let i = 0; i < spokes; i++) {
      angles.push((i / spokes) * Math.PI * 2);
    }
    return angles;
  }, [spokes]);

  return (
    <group ref={gearRef}>
      {/* Central Hub Collar */}
      <mesh material={hubMat} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.28, radius * 0.28, thickness * 1.5, 16]} />
      </mesh>

      {/* Center Brass Axle Pin & Fastener Nut */}
      <mesh material={materials.chromeMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.12, radius * 0.12, thickness * 2.2, 12]} />
      </mesh>
      <mesh material={materials.brassMaterial} position={[0, 0, thickness * 1.1]}>
        <cylinderGeometry args={[radius * 0.16, radius * 0.16, thickness * 0.4, 6]} />
      </mesh>

      {/* Outer Rim Ring */}
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius * 0.82, thickness, 24, 1, true]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, 0]}>
        <torusGeometry args={[radius * 0.9, thickness * 0.45, 8, 24]} />
      </mesh>

      {/* Gear Radial Spokes */}
      {spokeAngles.map((angle, idx) => (
        <mesh
          key={`spoke-${idx}`}
          material={mat}
          rotation={[0, 0, angle]}
          position={[0, 0, 0]}
        >
          <boxGeometry args={[radius * 1.65, thickness * 0.65, thickness * 0.7]} />
        </mesh>
      ))}

      {/* Peripheral Gear Involute Teeth */}
      {toothAngles.map((angle, idx) => {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <mesh
            key={`tooth-${idx}`}
            material={mat}
            position={[x, y, 0]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[toothDepth, toothWidth, thickness * 0.9]} />
          </mesh>
        );
      })}
    </group>
  );
};

// ============================================================================
// PROCEDURAL STAINED-GLASS CLOCKWORK WING
// ============================================================================

export interface WingProps {
  side: "left" | "right";
  position: "upper" | "lower";
  materials: ClockworkMaterials;
}

export const Wing: React.FC<WingProps> = ({ side, position, materials }) => {
  const isLeft = side === "left";
  const isUpper = position === "upper";
  const flipSign = isLeft ? -1 : 1;

  const wingShape = useMemo(() => {
    const shape = new THREE.Shape();
    if (isUpper) {
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.6, 0.8, 1.8, 1.9, 3.2, 2.1);
      shape.bezierCurveTo(3.4, 1.5, 3.2, 0.6, 2.6, -0.15);
      shape.bezierCurveTo(2.1, -0.65, 1.2, -0.55, 0.4, -0.3);
      shape.bezierCurveTo(0.2, -0.2, 0.1, -0.1, 0, 0);
    } else {
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.5, -0.2, 1.6, -0.4, 2.1, -1.1);
      shape.bezierCurveTo(2.2, -1.7, 1.6, -2.4, 1.25, -2.2);
      shape.bezierCurveTo(0.85, -2.0, 0.55, -1.3, 0.25, -0.6);
      shape.bezierCurveTo(0.1, -0.3, 0.05, -0.15, 0, 0);
    }
    return shape;
  }, [isUpper]);

  const veinData = useMemo(() => {
    if (isUpper) {
      return [
        { angle: 0.58, length: 3.5, taper: 0.045 },
        { angle: 0.38, length: 3.3, taper: 0.035 },
        { angle: 0.15, length: 2.8, taper: 0.03 },
        { angle: -0.12, length: 2.3, taper: 0.025 },
        { angle: -0.35, length: 1.6, taper: 0.022 },
      ];
    } else {
      return [
        { angle: -0.42, length: 2.3, taper: 0.038 },
        { angle: -0.85, length: 2.6, taper: 0.032 },
        { angle: -1.25, length: 2.2, taper: 0.028 },
        { angle: -1.58, length: 1.4, taper: 0.022 },
      ];
    }
  }, [isUpper]);

  const crossStruts = useMemo(() => {
    if (isUpper) {
      return [
        { pos: [1.4, 0.7, 0.02], rot: 0.8, len: 0.75 },
        { pos: [2.2, 1.1, 0.02], rot: 0.9, len: 0.95 },
        { pos: [1.8, 0.1, 0.02], rot: -0.6, len: 0.85 },
        { pos: [1.1, -0.15, 0.02], rot: -0.4, len: 0.65 },
        { pos: [2.5, 0.45, 0.02], rot: 1.2, len: 0.8 },
      ];
    } else {
      return [
        { pos: [1.1, -0.75, 0.02], rot: -0.9, len: 0.7 },
        { pos: [1.5, -1.4, 0.02], rot: -0.4, len: 0.8 },
        { pos: [0.75, -1.2, 0.02], rot: 0.5, len: 0.6 },
      ];
    }
  }, [isUpper]);

  const edgesGeometry = useMemo(() => {
    const shapeGeo = new THREE.ShapeGeometry(wingShape);
    return new THREE.EdgesGeometry(shapeGeo);
  }, [wingShape]);

  const glassMat = isUpper ? materials.upperGlassMaterial : materials.lowerGlassMaterial;

  return (
    <group scale={[flipSign, 1, 1]}>
      {/* Translucent Stained-Glass Membrane */}
      <mesh material={glassMat} position={[0, 0, 0]}>
        <shapeGeometry args={[wingShape]} />
      </mesh>

      {/* Wing Hinge Bracket */}
      <group position={[0, 0, 0.02]}>
        <mesh material={materials.brassMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.08, 12]} />
        </mesh>
        <mesh material={materials.chromeMaterial}>
          <sphereGeometry args={[0.07, 8, 8]} />
        </mesh>
        <mesh material={materials.brassMaterial} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.18, 0.02, 6, 16]} />
        </mesh>
      </group>

      {/* Radiating Vein Spars */}
      {veinData.map((vein, idx) => {
        const halfLen = vein.length / 2;
        return (
          <group
            key={`vein-${idx}`}
            rotation={[0, 0, vein.angle]}
            position={[0, 0, 0.015]}
          >
            <mesh
              material={materials.brassMaterial}
              position={[halfLen, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry
                args={[vein.taper * 0.45, vein.taper, vein.length, 8]}
              />
            </mesh>
            <mesh
              material={materials.steelMaterial}
              position={[vein.length * 0.4, 0, 0.01]}
            >
              <sphereGeometry args={[vein.taper * 1.2, 6, 6]} />
            </mesh>
            <mesh
              material={materials.chromeMaterial}
              position={[vein.length * 0.8, 0, 0.01]}
            >
              <sphereGeometry args={[vein.taper * 0.9, 6, 6]} />
            </mesh>
          </group>
        );
      })}

      {/* Cross-Truss Struts */}
      {crossStruts.map((strut, idx) => (
        <group
          key={`strut-${idx}`}
          position={strut.pos as [number, number, number]}
          rotation={[0, 0, strut.rot]}
        >
          <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, strut.len, 6]} />
          </mesh>
          <mesh material={materials.chromeMaterial} position={[0, 0, 0.01]}>
            <sphereGeometry args={[0.028, 6, 6]} />
          </mesh>
        </group>
      ))}

      {/* Outer Scalloped Brass Rim Bezel */}
      <lineSegments geometry={edgesGeometry} position={[0, 0, 0.005]}>
        <lineBasicMaterial color={materials.brassMaterial.color} linewidth={2} />
      </lineSegments>
    </group>
  );
};

// ============================================================================
// HEAD & ANTENNAE COMPONENT
// ============================================================================

export interface HeadProps {
  materials: ClockworkMaterials;
  gearSpeedMultiplier?: number;
  easedProgress: number;
  hoveredPartId: string | null;
  onHover: (id: string | null) => void;
  // Diagnostics
  isDiagnosticActive?: boolean;
  scannedParts?: Set<string>;
  activeDiagnosticPartId?: string | null;
}

export const Head: React.FC<HeadProps> = ({
  materials,
  gearSpeedMultiplier = 1.0,
  easedProgress,
  hoveredPartId,
  onHover,
  isDiagnosticActive = false,
  scannedParts,
  activeDiagnosticPartId,
}) => {
  const leftAntennaRef = useRef<THREE.Group>(null);
  const rightAntennaRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    // Only sway when not exploded and not in diagnostic freeze
    if (easedProgress < 0.2 && !isDiagnosticActive) {
      timeRef.current += delta;
      const t = timeRef.current;
      const sway = Math.sin(t * 3.2) * 0.06;
      if (leftAntennaRef.current) {
        leftAntennaRef.current.rotation.z = 0.28 + sway;
        leftAntennaRef.current.rotation.x = 0.2 + Math.cos(t * 2.8) * 0.04;
      }
      if (rightAntennaRef.current) {
        rightAntennaRef.current.rotation.z = -0.28 - sway;
        rightAntennaRef.current.rotation.x = 0.2 + Math.cos(t * 2.8) * 0.04;
      }
    }
  });

  return (
    <>
      {/* 1. Head Core Capsule */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["head"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "head"}
        onHover={onHover}
        basePosition={[0, 0.12, 0.62]}
        isDiagnosticActive={isDiagnosticActive}
        isScanned={scannedParts?.has("head")}
        isCurrentlyScanning={activeDiagnosticPartId === "head"}
      >
        <mesh material={materials.brassMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.12, 14]} />
        </mesh>

        <mesh material={materials.steelMaterial} position={[0, 0.08, 0.18]}>
          <icosahedronGeometry args={[0.26, 1]} />
        </mesh>

        <mesh material={materials.brassMaterial} position={[0, 0.24, 0.2]}>
          <boxGeometry args={[0.24, 0.05, 0.18]} />
        </mesh>

        <group position={[-0.2, 0.08, 0.26]} rotation={[0, -0.4, 0.2]}>
          <mesh material={materials.brassMaterial}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
          </mesh>
          <mesh material={materials.jewelMaterial} position={[0, 0.04, 0]}>
            <icosahedronGeometry args={[0.11, 1]} />
          </mesh>
        </group>

        <group position={[0.2, 0.08, 0.26]} rotation={[0, 0.4, -0.2]}>
          <mesh material={materials.brassMaterial}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
          </mesh>
          <mesh material={materials.jewelMaterial} position={[0, 0.04, 0]}>
            <icosahedronGeometry args={[0.11, 1]} />
          </mesh>
        </group>

        <group position={[0, -0.16, 0.28]} rotation={[0, 0, 0]}>
          <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.1, 0.02, 10, 24, Math.PI * 1.6]} />
          </mesh>
          <mesh material={materials.chromeMaterial} position={[0, -0.05, -0.02]}>
            <sphereGeometry args={[0.035, 8, 8]} />
          </mesh>
        </group>
      </ExplodedPart>

      {/* 2. Left Antenna Array */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["left-antenna"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "left-antenna"}
        onHover={onHover}
        basePosition={[-0.08, 0.38, 0.87]}
        isDiagnosticActive={isDiagnosticActive}
        isScanned={scannedParts?.has("left-antenna")}
        isCurrentlyScanning={activeDiagnosticPartId === "left-antenna"}
      >
        <group ref={leftAntennaRef}>
          <mesh material={materials.brassMaterial}>
            <sphereGeometry args={[0.045, 8, 8]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((seg) => {
            const segZ = seg * 0.14;
            const segY = seg * 0.16 + Math.pow(seg * 0.22, 1.8);
            const segX = -seg * 0.08 - Math.pow(seg * 0.15, 1.6);
            return (
              <group key={`ant-l-${seg}`} position={[segX, segY, segZ]}>
                <mesh material={materials.brassMaterial}>
                  <cylinderGeometry args={[0.02, 0.028, 0.16, 8]} />
                </mesh>
                <mesh material={materials.steelMaterial} position={[0, 0.08, 0]}>
                  <sphereGeometry args={[0.03, 6, 6]} />
                </mesh>
              </group>
            );
          })}
          <group position={[-0.6, 0.95, 0.8]} rotation={[0.4, -0.3, 0]}>
            <Gear
              radius={0.09}
              teeth={8}
              speed={2.2}
              thickness={0.02}
              materials={materials}
              gearSpeedMultiplier={gearSpeedMultiplier}
              useBrass={true}
            />
            <mesh material={materials.chromeMaterial} position={[0, 0.1, 0]}>
              <coneGeometry args={[0.025, 0.12, 8]} />
            </mesh>
          </group>
        </group>
      </ExplodedPart>

      {/* 3. Right Antenna Array */}
      <ExplodedPart
        part={BUTTERFLY_PARTS["right-antenna"]}
        easedProgress={easedProgress}
        isHovered={hoveredPartId === "right-antenna"}
        onHover={onHover}
        basePosition={[0.08, 0.38, 0.87]}
        isDiagnosticActive={isDiagnosticActive}
        isScanned={scannedParts?.has("right-antenna")}
        isCurrentlyScanning={activeDiagnosticPartId === "right-antenna"}
      >
        <group ref={rightAntennaRef}>
          <mesh material={materials.brassMaterial}>
            <sphereGeometry args={[0.045, 8, 8]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((seg) => {
            const segZ = seg * 0.14;
            const segY = seg * 0.16 + Math.pow(seg * 0.22, 1.8);
            const segX = seg * 0.08 + Math.pow(seg * 0.15, 1.6);
            return (
              <group key={`ant-r-${seg}`} position={[segX, segY, segZ]}>
                <mesh material={materials.brassMaterial}>
                  <cylinderGeometry args={[0.02, 0.028, 0.16, 8]} />
                </mesh>
                <mesh material={materials.steelMaterial} position={[0, 0.08, 0]}>
                  <sphereGeometry args={[0.03, 6, 6]} />
                </mesh>
              </group>
            );
          })}
          <group position={[0.6, 0.95, 0.8]} rotation={[0.4, 0.3, 0]}>
            <Gear
              radius={0.09}
              teeth={8}
              speed={-2.2}
              thickness={0.02}
              materials={materials}
              gearSpeedMultiplier={gearSpeedMultiplier}
              useBrass={true}
            />
            <mesh material={materials.chromeMaterial} position={[0, 0.1, 0]}>
              <coneGeometry args={[0.025, 0.12, 8]} />
            </mesh>
          </group>
        </group>
      </ExplodedPart>
    </>
  );
};

// ============================================================================
// PROCEDURAL JOINTED CLOCKWORK LEGS
// ============================================================================

export interface LegsProps {
  materials: ClockworkMaterials;
  easedProgress: number;
  hoveredPartId: string | null;
  onHover: (id: string | null) => void;
  // Diagnostics
  isDiagnosticActive?: boolean;
  scannedParts?: Set<string>;
  activeDiagnosticPartId?: string | null;
}

export const Legs: React.FC<LegsProps> = ({
  materials,
  easedProgress,
  hoveredPartId,
  onHover,
  isDiagnosticActive = false,
  scannedParts,
  activeDiagnosticPartId,
}) => {
  const legConfigs = useMemo(
    () => [
      { partId: "fore-legs", zPos: 0.22, angleY: 0.35, foldScale: 0.85 },
      { partId: "mid-legs", zPos: -0.02, angleY: 0.0, foldScale: 1.0 },
      { partId: "hind-legs", zPos: -0.26, angleY: -0.4, foldScale: 1.15 },
    ],
    []
  );

  return (
    <>
      {legConfigs.map((config) => (
        <ExplodedPart
          key={config.partId}
          part={BUTTERFLY_PARTS[config.partId]}
          easedProgress={easedProgress}
          isHovered={hoveredPartId === config.partId}
          onHover={onHover}
          basePosition={[0, -0.22, 0]}
          isDiagnosticActive={isDiagnosticActive}
          isScanned={scannedParts?.has(config.partId)}
          isCurrentlyScanning={activeDiagnosticPartId === config.partId}
        >
          {/* Left Leg */}
          <group
            position={[-0.26, 0, config.zPos]}
            rotation={[0.3, config.angleY, 0.6]}
            scale={config.foldScale}
          >
            <mesh material={materials.brassMaterial}>
              <sphereGeometry args={[0.05, 8, 8]} />
            </mesh>
            <mesh
              material={materials.steelMaterial}
              position={[-0.22, -0.2, 0]}
              rotation={[0, 0, -0.8]}
            >
              <cylinderGeometry args={[0.022, 0.028, 0.45, 8]} />
            </mesh>
            <mesh material={materials.brassMaterial} position={[-0.4, -0.38, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
            </mesh>
            <mesh
              material={materials.brassMaterial}
              position={[-0.45, -0.7, 0.05]}
              rotation={[0.2, 0, 0.2]}
            >
              <cylinderGeometry args={[0.018, 0.022, 0.55, 8]} />
            </mesh>
            <mesh
              material={materials.chromeMaterial}
              position={[-0.48, -1.02, 0.1]}
              rotation={[0.5, 0, 0.4]}
            >
              <coneGeometry args={[0.025, 0.18, 6]} />
            </mesh>
          </group>

          {/* Right Leg */}
          <group
            position={[0.26, 0, config.zPos]}
            rotation={[0.3, -config.angleY, -0.6]}
            scale={config.foldScale}
          >
            <mesh material={materials.brassMaterial}>
              <sphereGeometry args={[0.05, 8, 8]} />
            </mesh>
            <mesh
              material={materials.steelMaterial}
              position={[0.22, -0.2, 0]}
              rotation={[0, 0, 0.8]}
            >
              <cylinderGeometry args={[0.022, 0.028, 0.45, 8]} />
            </mesh>
            <mesh material={materials.brassMaterial} position={[0.4, -0.38, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
            </mesh>
            <mesh
              material={materials.brassMaterial}
              position={[0.45, -0.7, 0.05]}
              rotation={[0.2, 0, -0.2]}
            >
              <cylinderGeometry args={[0.018, 0.022, 0.55, 8]} />
            </mesh>
            <mesh
              material={materials.chromeMaterial}
              position={[0.48, -1.02, 0.1]}
              rotation={[0.5, 0, -0.4]}
            >
              <coneGeometry args={[0.025, 0.18, 6]} />
            </mesh>
          </group>
        </ExplodedPart>
      ))}
    </>
  );
};

// ============================================================================
// INTERACTIVE LIGHT SOURCE COMPONENT (<LightSource />)
// ============================================================================

export interface LightSourceProps {
  position: [number, number, number];
  color?: string;
  intensity?: number;
  size?: number;
}

export const LightSource: React.FC<LightSourceProps> = ({
  position,
  color = "#ffdd85",
  intensity = 4.2,
  size = 0.28,
}) => {
  const lightGroupRef = useRef<THREE.Group>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const pulseAgeRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    pulseAgeRef.current = 0;
  }, [position[0], position[1], position[2]]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (lightGroupRef.current) {
      const hoverY = targetPos.y + Math.sin(t * 2.2) * 0.15;
      const targetWithHover = new THREE.Vector3(targetPos.x, hoverY, targetPos.z);
      lightGroupRef.current.position.lerp(targetWithHover, Math.min(1, delta * 6.0));
    }

    if (pulseRingRef.current) {
      pulseAgeRef.current += delta * 2.5;
      const p = Math.min(1, pulseAgeRef.current);
      const ringScale = 1.0 + p * 3.5;
      pulseRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, (1 - p) * 0.7);
      }
    }
  });

  return (
    <group ref={lightGroupRef} position={position}>
      {/* Core Glowing Orb */}
      <mesh>
        <sphereGeometry args={[size, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 2.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 4.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Placement Pulse Ring */}
      <mesh ref={pulseRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 1.8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={color} intensity={intensity} distance={25} decay={2} />
    </group>
  );
};
