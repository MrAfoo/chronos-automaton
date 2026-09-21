"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ScanPlaneProps {
  active: boolean;
  currentZ: number;
  width?: number;
  height?: number;
  opacity?: number;
}

const ScanShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.85 },
    uLaserColor: { value: new THREE.Color("#00f5ff") },
    uGridColor: { value: new THREE.Color("#0ea5e9") },
    uCoreColor: { value: new THREE.Color("#ffffff") },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uLaserColor;
    uniform vec3 uGridColor;
    uniform vec3 uCoreColor;

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // 1. Soft vignette edge falloff on all 4 borders
      float edgeX = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
      float edgeY = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);
      float borderFade = edgeX * edgeY;

      // 2. High-tech fine holographic grid
      float gridY = step(0.93, fract(vUv.y * 32.0 - uTime * 0.4));
      float gridX = step(0.93, fract(vUv.x * 48.0));
      float gridIntensity = max(gridX * 0.4, gridY * 0.6);

      // 3. Central bright laser core sweep line across height
      float centerDist = abs(vUv.y - 0.5);
      float centerBand = exp(-centerDist * 16.0);
      float tightCore = exp(-centerDist * 64.0);

      // 4. Traveling secondary harmonic ripples
      float pulseWave = sin(vUv.x * 24.0 + uTime * 8.0) * cos(vUv.y * 18.0 - uTime * 5.0);
      pulseWave = 0.5 + 0.5 * pulseWave;

      // 5. Subtle hexagonal / diamond digital noise pattern
      float diag1 = sin((vUv.x + vUv.y) * 40.0 + uTime * 2.0);
      float diag2 = cos((vUv.x - vUv.y) * 40.0 - uTime * 2.0);
      float shimmer = max(0.0, diag1 * diag2) * 0.15;

      // Combine color components
      vec3 finalColor = uLaserColor * (gridIntensity * 0.6 + centerBand * 0.5 + shimmer);
      finalColor += uGridColor * (pulseWave * 0.25 + 0.1);
      finalColor += uCoreColor * tightCore * 1.4;

      // Alpha accumulation with edge attenuation
      float alpha = (tightCore * 0.95 + centerBand * 0.65 + gridIntensity * 0.45 + 0.12) * borderFade * uOpacity;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

export const ScanPlane: React.FC<ScanPlaneProps> = ({
  active,
  currentZ,
  width = 9.2,
  height = 4.6,
  opacity = 0.9,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Custom shader material instance with additive blending
  const shaderMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ScanShaderMaterial.uniforms),
      vertexShader: ScanShaderMaterial.vertexShader,
      fragmentShader: ScanShaderMaterial.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((_, delta) => {
    if (!active) return;
    shaderMat.uniforms.uTime.value += delta;
    shaderMat.uniforms.uOpacity.value = opacity;
  });

  if (!active) return null;

  return (
    <group position={[0, 1.2, currentZ]}>
      {/* Sweeping Laser & Grid Plane */}
      <mesh ref={meshRef} material={shaderMat}>
        <planeGeometry args={[width, height, 1, 1]} />
      </mesh>

      {/* Top and Bottom Optical Laser Guide Rods */}
      <mesh position={[0, height / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, width * 0.96, 8]} />
        <meshBasicMaterial
          color="#00f5ff"
          transparent
          opacity={0.8 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -height / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, width * 0.96, 8]} />
        <meshBasicMaterial
          color="#00f5ff"
          transparent
          opacity={0.8 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Focused Horizontal Core Laser Beam */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, width * 0.98, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Moving Holographic Point Light across scan line */}
      <pointLight
        position={[0, 0, 0.1]}
        color="#00f5ff"
        intensity={3.5 * opacity}
        distance={4.8}
        decay={2}
      />
    </group>
  );
};
