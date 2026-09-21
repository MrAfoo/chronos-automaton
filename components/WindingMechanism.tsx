"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import * as THREE from "three";
import { ClockworkMaterials } from "./ButterflyParts";

interface WindingMechanismProps {
  windTension: number;
  onWind: (deltaTension: number) => void;
  materials: ClockworkMaterials;
  disabled?: boolean;
}

export const WindingMechanism: React.FC<WindingMechanismProps> = ({
  windTension,
  onWind,
  materials,
  disabled = false,
}) => {
  const crownGroupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const keyAngleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Dynamically change cursor over canvas using @react-three/drei hook
  useCursor(isHovered && !disabled, "grab", "auto");

  // --------------------------------------------------------------------------
  // 1. DRAG TO WIND EVENT LISTENERS
  // --------------------------------------------------------------------------
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (disabled) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    try {
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
  };

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || disabled) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      // Dragging vertically or horizontally drives crown rotation
      const dragStep = Math.abs(dy) > Math.abs(dx) ? -dy : dx;
      if (Math.abs(dragStep) > 0.5) {
        const deltaAngle = dragStep * 0.045;
        keyAngleRef.current += deltaAngle;

        // ~3 full 360° revolutions (6*PI) winds to 100%
        const addedTension = Math.abs(deltaAngle) / (Math.PI * 6.0);
        onWind(addedTension);
      }
    };

    const handleWindowPointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [disabled, onWind]);

  // --------------------------------------------------------------------------
  // 2. MAINSPRING PARAMETRIC SPIRAL RIBBON GEOMETRY
  // --------------------------------------------------------------------------
  const NUM_SPRING_SEGMENTS = 70;
  const SPRING_WIDTH = 0.075;

  const { springGeometry, posAttribute } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((NUM_SPRING_SEGMENTS + 1) * 2 * 3);
    const indices: number[] = [];

    for (let i = 0; i < NUM_SPRING_SEGMENTS; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      // Two triangles per ribbon quad
      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
      // Double sided indices
      indices.push(v2, v1, v0);
      indices.push(v2, v3, v1);
    }

    geo.setIndex(indices);
    const posAttr = new THREE.BufferAttribute(positions, 3);
    geo.setAttribute("position", posAttr);
    return { springGeometry: geo, posAttribute: posAttr };
  }, [NUM_SPRING_SEGMENTS]);

  // Tempered Spring Steel blade material (Deep blued horology steel)
  const springBladeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e293b"),
      metalness: 0.88,
      roughness: 0.22,
      side: THREE.DoubleSide,
    });
  }, []);

  // Knurled Crown Grip Ridges
  const knurlAngles = useMemo(() => {
    const angles: number[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      angles.push((i / count) * Math.PI * 2);
    }
    return angles;
  }, []);

  // --------------------------------------------------------------------------
  // 3. FRAME UPDATES: 1:1 KEY ROTATION & MAINSPRING COILING
  // --------------------------------------------------------------------------
  useFrame((_, delta) => {
    // 1:1 rotation on crown key
    if (crownGroupRef.current) {
      crownGroupRef.current.rotation.x = keyAngleRef.current;
    }

    // Idle pulse ring on crown to signal interactivity
    if (haloRef.current) {
      const t = Date.now() * 0.003;
      const pulse = isHovered ? 1.25 : 1.0 + Math.sin(t * 2.5) * 0.12;
      haloRef.current.scale.set(pulse, pulse, pulse);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = disabled ? 0 : isHovered ? 0.85 : 0.45 + Math.sin(t * 2.5) * 0.2;
      }
    }

    // Dynamically deform the mainspring ribbon to visibly tighten or relax
    const tension = THREE.MathUtils.clamp(windTension, 0, 1);
    const posArray = posAttribute.array as Float32Array;

    // Archimedean spiral parameters
    const rInner = 0.07;
    // Outer radius shrinks from 0.30 (relaxed) to 0.18 (tightly coiled around arbor)
    const rOuter = THREE.MathUtils.lerp(0.30, 0.18, tension);
    // Number of coiled turns tightens from 3.8 turns to 6.2 turns
    const totalTurns = THREE.MathUtils.lerp(3.8, 6.2, tension);
    const totalAngle = totalTurns * Math.PI * 2;
    // Dynamic winding angle offset so spring visibly turns as wound
    const windAngularOffset = tension * Math.PI * 4;

    for (let i = 0; i <= NUM_SPRING_SEGMENTS; i++) {
      const t = i / NUM_SPRING_SEGMENTS;
      const angle = t * totalAngle + windAngularOffset;
      // Power curve causes coils to pack densely towards the inner arbor as tension rises
      const radius = rInner + (rOuter - rInner) * Math.pow(t, THREE.MathUtils.lerp(0.85, 1.45, tension));

      // Local coordinate plane (YZ plane, perpendicular to axle X)
      const py = Math.sin(angle) * radius;
      const pz = Math.cos(angle) * radius;
      // Slight axial offset along X to prevent planar z-fighting
      const pxBase = (t - 0.5) * 0.015;

      const idx0 = i * 2 * 3;
      const idx1 = (i * 2 + 1) * 3;

      // Edge 1 of flat ribbon
      posArray[idx0 + 0] = pxBase - SPRING_WIDTH * 0.5;
      posArray[idx0 + 1] = py;
      posArray[idx0 + 2] = pz;

      // Edge 2 of flat ribbon
      posArray[idx1 + 0] = pxBase + SPRING_WIDTH * 0.5;
      posArray[idx1 + 1] = py;
      posArray[idx1 + 2] = pz;
    }

    posAttribute.needsUpdate = true;
    springGeometry.computeVertexNormals();
  });

  return (
    <group position={[0.42, 0.14, 0.06]}>
      {/* =====================================================================
          1. MAINSPRING BARREL ASSEMBLY (SKELETAL HOROLOGY CAGE & SPIRAL)
      ====================================================================== */}
      <group position={[-0.14, 0, 0]}>
        {/* Central Winding Arbor Axle */}
        <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.16, 14]} />
        </mesh>

        {/* Polished Chrome Mainspring Winding Pawl Click */}
        <mesh material={materials.chromeMaterial} position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.08, 0.02, 0.02]} />
        </mesh>

        {/* Skeletal Mainspring Barrel Housing Rim */}
        <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.31, 0.018, 8, 32]} />
        </mesh>

        {/* Dynamic Tempered Steel Ribbon Mainspring */}
        <mesh geometry={springGeometry} material={springBladeMaterial} />

        {/* Tension Energy Glow Point Light */}
        {windTension > 0.05 && (
          <pointLight
            color="#fbbf24"
            intensity={windTension * 2.4}
            distance={1.5}
            decay={2}
          />
        )}
      </group>

      {/* =====================================================================
          2. KNURLED POCKET-WATCH CROWN KEY (DRAGGABLE TO WIND)
      ====================================================================== */}
      <group
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setIsHovered(true);
        }}
        onPointerOut={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setIsHovered(false);
        }}
      >
        {/* Interactive Idle Pulse Halo Ring */}
        <mesh
          ref={haloRef}
          position={[0.18, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <ringGeometry args={[0.14, 0.17, 24]} />
          <meshBasicMaterial
            color={isHovered ? "#ffe082" : "#fbbf24"}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Rotating Crown Key Mesh */}
        <group ref={crownGroupRef}>
          {/* Stem Shaft protruding from Thorax */}
          <mesh material={materials.steelMaterial} rotation={[0, 0, Math.PI / 2]} position={[0.05, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.12, 16]} />
          </mesh>

          {/* Knurled Crown Collar Bezel */}
          <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]} position={[0.11, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.11, 0.04, 20]} />
          </mesh>

          {/* Crown Cylindrical Barrel */}
          <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
            <cylinderGeometry args={[0.115, 0.115, 0.11, 24]} />
          </mesh>

          {/* Radial Knurling Grip Teeth around Crown Rim */}
          {knurlAngles.map((angle, idx) => (
            <mesh
              key={`knurl-${idx}`}
              material={materials.steelMaterial}
              position={[
                0.16,
                Math.sin(angle) * 0.118,
                Math.cos(angle) * 0.118,
              ]}
              rotation={[angle, 0, 0]}
            >
              <boxGeometry args={[0.105, 0.016, 0.016]} />
            </mesh>
          ))}

          {/* Crown Finial Cap & Polished Chrome Stud */}
          <mesh material={materials.brassMaterial} rotation={[0, 0, Math.PI / 2]} position={[0.22, 0, 0]}>
            <cylinderGeometry args={[0.105, 0.04, 0.04, 20]} />
          </mesh>
          <mesh material={materials.chromeMaterial} position={[0.245, 0, 0]}>
            <sphereGeometry args={[0.048, 12, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
