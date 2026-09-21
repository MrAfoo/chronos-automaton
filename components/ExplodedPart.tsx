"use client";

import React, { useRef, useMemo, useEffect, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ButterflyPartSpec, CONDITION_CONFIG } from "./butterflyData";

// ============================================================================
// REUSABLE CONDITION MATERIALS (ONE PER STATUS LEVEL TO MINIMIZE DRAW CALLS)
// ============================================================================

const SHARED_SPHERE_MATERIALS = {
  nominal: new THREE.MeshStandardMaterial({
    color: new THREE.Color(CONDITION_CONFIG.nominal.color),
    emissive: new THREE.Color("#16a34a"),
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.35,
    transparent: true,
  }),
  advisory: new THREE.MeshStandardMaterial({
    color: new THREE.Color(CONDITION_CONFIG.advisory.color),
    emissive: new THREE.Color("#d97706"),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.35,
    transparent: true,
  }),
  critical: new THREE.MeshStandardMaterial({
    color: new THREE.Color(CONDITION_CONFIG.critical.color),
    emissive: new THREE.Color("#dc2626"),
    emissiveIntensity: 1.25,
    roughness: 0.25,
    metalness: 0.35,
    transparent: true,
  }),
};

const SHARED_HALO_MATERIALS = {
  nominal: new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONDITION_CONFIG.nominal.color),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  advisory: new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONDITION_CONFIG.advisory.color),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  critical: new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONDITION_CONFIG.critical.color),
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
};

// ============================================================================
// EXPLODED PART WRAPPER COMPONENT
// ============================================================================

export interface ExplodedPartProps {
  part: ButterflyPartSpec;
  easedProgress: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  children: ReactNode;
  basePosition?: [number, number, number];
  baseRotation?: [number, number, number];
  // Diagnostics mode props
  isDiagnosticActive?: boolean;
  isScanned?: boolean;
  isCurrentlyScanning?: boolean;
}

export const ExplodedPart: React.FC<ExplodedPartProps> = ({
  part,
  easedProgress,
  isHovered,
  onHover,
  children,
  basePosition = [0, 0, 0],
  baseRotation = [0, 0, 0],
  isDiagnosticActive = false,
  isScanned = false,
  isCurrentlyScanning = false,
}) => {
  const indicatorGroupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Current interpolated position based on exploded progress
  const posX = basePosition[0] + part.explodedOffset[0] * easedProgress;
  const posY = basePosition[1] + part.explodedOffset[1] * easedProgress;
  const posZ = basePosition[2] + part.explodedOffset[2] * easedProgress;

  // Hover badges are only active when mechanism is in exploded state
  const isExplodedActive = easedProgress > 0.15;
  const showInspectionHover = isHovered && isExplodedActive;

  const isCritical = part.condition === "critical";
  const isAdvisory = part.condition === "advisory";
  const isNominal = part.condition === "nominal";

  // Scale bump when hovered in exploded view or actively scanned
  const scale = showInspectionHover
    ? 1.05
    : isCurrentlyScanning
    ? 1.06
    : isScanned && isDiagnosticActive
    ? 1.02
    : 1.0;

  // Connector line color reflecting condition urgency
  const connectorLineColor = useMemo(() => {
    if (isCritical) return "#f87171";
    if (isAdvisory) return "#fbbf24";
    return "#e5a93b";
  }, [isCritical, isAdvisory]);

  // Pre-allocated technical blueprint connector line (allocated once, zero per-frame GC churn)
  const lineGeomRef = useRef<THREE.BufferGeometry | null>(null);
  const posAttrRef = useRef<THREE.BufferAttribute | null>(null);

  if (!lineGeomRef.current) {
    const positions = new Float32Array([
      basePosition[0],
      basePosition[1],
      basePosition[2],
      basePosition[0],
      basePosition[1],
      basePosition[2],
    ]);
    const geom = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    geom.setAttribute("position", attr);
    lineGeomRef.current = geom;
    posAttrRef.current = attr;
  }

  useEffect(() => {
    return () => {
      lineGeomRef.current?.dispose();
    };
  }, []);

  // Animate condition indicator visibility and non-nominal pulsing
  useFrame((_, delta) => {
    // In-place buffer coordinate updates without geometry reallocation
    if (posAttrRef.current && easedProgress > 0.04) {
      const arr = posAttrRef.current.array as Float32Array;
      arr[0] = basePosition[0];
      arr[1] = basePosition[1];
      arr[2] = basePosition[2];
      arr[3] = basePosition[0] + part.explodedOffset[0] * easedProgress;
      arr[4] = basePosition[1] + part.explodedOffset[1] * easedProgress;
      arr[5] = basePosition[2] + part.explodedOffset[2] * easedProgress;
      posAttrRef.current.needsUpdate = true;
    }

    if (indicatorGroupRef.current) {
      // Smoothly fade in/out with exploded progress rather than popping instantly
      const fadeFactor = Math.max(0, Math.min(1, (easedProgress - 0.08) / 0.55));
      const isVisible = fadeFactor > 0.01;
      indicatorGroupRef.current.visible = isVisible;

      if (isVisible) {
        timeRef.current += delta;
        const t = timeRef.current;

        // Non-nominal pulse animation to draw inspector attention
        if (isCritical) {
          const pulse = (1.0 + Math.sin(t * 4.8) * 0.28) * fadeFactor;
          indicatorGroupRef.current.scale.set(pulse, pulse, pulse);
        } else if (isAdvisory) {
          const pulse = (1.0 + Math.sin(t * 3.2) * 0.18) * fadeFactor;
          indicatorGroupRef.current.scale.set(pulse, pulse, pulse);
        } else {
          indicatorGroupRef.current.scale.set(fadeFactor, fadeFactor, fadeFactor);
        }
      }
    }
  });

  return (
    <>
      {/* Blueprint connector line in Exploded View */}
      {easedProgress > 0.04 && lineGeomRef.current && (
        <lineSegments geometry={lineGeomRef.current}>
          <lineBasicMaterial
            color={connectorLineColor}
            transparent
            opacity={Math.min(
              isCritical ? 0.6 : isAdvisory ? 0.5 : 0.42,
              easedProgress * 0.48
            )}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* Part mesh/group */}
      <group
        position={[posX, posY, posZ]}
        rotation={baseRotation}
        scale={[scale, scale, scale]}
        onPointerOver={(e) => {
          if (!isExplodedActive) return;
          e.stopPropagation();
          onHover(part.id);
        }}
        onPointerOut={(e) => {
          if (!isExplodedActive) return;
          e.stopPropagation();
          onHover(null);
        }}
      >
        {children}

        {/* 3D Condition Marker Dot (Visible primarily in exploded view) */}
        <group ref={indicatorGroupRef} position={[0, 0.42, 0]}>
          {/* Inner core status sphere */}
          <mesh material={SHARED_SPHERE_MATERIALS[part.condition]}>
            <sphereGeometry args={[0.048, 12, 12]} />
          </mesh>

          {/* Outer glowing halo ring for non-nominal warnings */}
          {!isNominal && (
            <mesh
              material={SHARED_HALO_MATERIALS[part.condition]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.065, 0.11, 20]} />
            </mesh>
          )}

        </group>

        {/* Localized Cyan Flash Point Light when scanning this part */}
        {isCurrentlyScanning && (
          <pointLight
            color="#00f5ff"
            intensity={4.5}
            distance={1.6}
            decay={2}
          />
        )}

        {/* 1. Exploded View Spec Badge (Horology Condition HUD) */}
        {showInspectionHover && !isDiagnosticActive && (
          <Html
            position={[0, 0.5, 0]}
            center
            distanceFactor={11}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`backdrop-blur-md bg-black/92 border rounded-xl p-3.5 shadow-2xl min-w-[260px] max-w-[300px] text-left pointer-events-none transform -translate-y-8 select-none animate-in fade-in zoom-in-95 duration-150 ${
                isCritical
                  ? "border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.45)]"
                  : isAdvisory
                  ? "border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
                  : "border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
              }`}
            >
              {/* Condition & Status Header */}
              <div className="flex items-center justify-between gap-1.5 mb-1.5 border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCritical
                        ? "bg-red-400 animate-ping"
                        : isAdvisory
                        ? "bg-amber-400 animate-pulse"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                      isCritical
                        ? "text-red-400"
                        : isAdvisory
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {part.condition.toUpperCase()} STATUS
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    isCritical
                      ? "bg-red-950/80 border-red-500/40 text-red-300"
                      : isAdvisory
                      ? "bg-amber-950/80 border-amber-500/40 text-amber-300"
                      : "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {part.tolerance}
                </span>
              </div>

              <div className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider">
                {part.subtitle}
              </div>
              <div className="text-sm font-semibold text-white tracking-wide mt-0.5">
                {part.label}
              </div>
              <div className="text-[11px] font-mono text-white/75 mt-1 leading-snug">
                {part.specs}
              </div>
            </div>
          </Html>
        )}

        {/* 2. Diagnostics Inspection Readout Badge (Cyan Holographic HUD) */}
        {isCurrentlyScanning && (
          <Html
            position={[0, 0.55, 0]}
            center
            distanceFactor={10.5}
            style={{ pointerEvents: "none" }}
          >
            <div className="backdrop-blur-lg bg-cyan-950/90 border border-cyan-400/80 rounded-xl p-3 shadow-[0_0_30px_rgba(6,182,212,0.45)] min-w-[250px] max-w-[290px] text-left pointer-events-none transform -translate-y-8 select-none animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-1.5 mb-1.5 border-b border-cyan-500/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-widest">
                    CALIBRATING
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    isCritical
                      ? "bg-red-950/70 border-red-400/50 text-red-300"
                      : isAdvisory
                      ? "bg-amber-950/70 border-amber-400/50 text-amber-300"
                      : "bg-cyan-900/60 border-cyan-400/40 text-cyan-300"
                  }`}
                >
                  {isCritical ? "CRITICAL ALERT" : isAdvisory ? "ADVISORY" : "PASS // 100%"}
                </span>
              </div>
              <div className="text-sm font-semibold text-white tracking-wide flex items-center justify-between">
                <span>{part.label}</span>
              </div>
              <div className="text-[9px] font-mono text-cyan-300/80 mt-0.5">
                {part.subtitle}
              </div>
              <div className="text-[10px] font-mono text-white/80 mt-1.5 leading-snug bg-black/40 p-1.5 rounded border border-cyan-500/20">
                {part.specs}
              </div>
            </div>
          </Html>
        )}
      </group>
    </>
  );
};
