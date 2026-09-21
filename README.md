# ⏱️ Chronos Automaton — Mechanical Papillon

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-v8+-black?style=for-the-badge&logo=three.js)](https://docs.pmnd.rs/react-three-fiber)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-black?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber?style=for-the-badge)](LICENSE)

> A museum-grade, interactive 3D mechanical automaton butterfly and horology simulator built with **React Three Fiber**, **Three.js**, and **Next.js**. Explore intricate clockwork gearing, escapement mechanics, realistic glass refraction, interactive flight pursuit, and a 3-lane endless runner mini-game.

---

## ✨ Features

### ⚙️ 1. Horological Mechanical Automaton
- **Interlocking Gear Trains**: Meshed brass gears, pinions, and balance wheels driven by physics-informed kinematic linkages.
- **Mainspring Crown Mechanism**: Interactive winding crown on the thorax with tactile spring tension calculation, auditory ratchet winding clicks, and spring unwind physics.
- **Parametric Wing Kinematics**: Dual-axis wing stroke with leading-edge twist, adjustable flapping cadence (0.6 Hz – 1.6 Hz), and stained-glass refractive wings.

### 🔬 2. Exploded Horology & Diagnostics
- **Interactive Exploded View**: Smoothly disassembles the automaton into 16 distinct horological assemblies (balance wheels, escapements, spring barrels, wing struts, thorax chassis).
- **Holographic Diagnostics Sweep**: Sweeping laser scanner inspecting each component's operational health, gear alignment, and stress tolerances in real-time.
- **Telemetry HUD**: Detailed telemetry displaying airspeed, flap frequency, spring tension, and part condition diagnostics.

### 🎮 3. Interactive Flight Simulation & Mini-Game
- **Play with Fly (Beacon Pursuit)**: An interactive light-seeking flight mode where the mechanical papillon organically pursues and orbits an adjustable, glowing light beacon.
- **Chronos Corridor (Flight Trial)**: A fast-paced 3-lane endless runner mini-game:
  - Procedurally generated obstacle corridors with swinging clockwork pendulums, lethal floor spikes, and column arches.
  - Collectible golden gears and chronos coins with emissive rim lighting.
  - Invulnerability energy shields, score multipliers, combo chains, and game-over state telemetry.
  - Dedicated high-contrast gameplay visual theme optimized for lane clarity.

### 🎨 4. Atmospheric Lighting Studio
- Real-time cinematic lighting moods featuring curated environment HDRI maps and tone-mapped post-processing:
  - 🌙 **Moonlight**: Starlit night ambiance with deep indigo contrast and subtle metallic rim highlights *(Default)*.
  - 🌅 **Golden Hour**: Warm sunset grazing light emphasizing polished brass and copper bevels.
  - ☀️ **Daylight**: Crisp natural studio daylight highlighting stained-glass wing transmission.
  - 🌆 **Cyberpunk**: Moody neon-soaked palette with high-contrast dual-tone rim lights.
  - 💡 **Studio**: Clean gallery illumination for mechanical inspection.

### ⚡ 5. Dual Performance Architecture (60 FPS on Any Device)
- **Ultra Quality Mode**: Full physically-based glass transmission (`MeshPhysicalMaterial`), refractive caustics, and multi-pass bloom blur pyramids *(Default)*.
- **Performance Mode (60 FPS)**: Designed for laptops with integrated GPUs and mobile devices:
  - Bypasses heavy transmission FBO copies, swapping to high-efficiency transparent standard shaders.
  - Bypasses full-screen bloom passes, rendering directly to canvas backbuffers.
  - Clamps DPR dynamically via `@react-three/drei`'s `<AdaptiveDpr />` and `<AdaptiveEvents />`.
  - Single-click toggle directly in the HUD control dock.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **3D & WebGL Engine**: [Three.js](https://threejs.org/) & [React Three Fiber (R3F)](https://docs.pmnd.rs/react-three-fiber)
- **3D Helpers & Shaders**: [@react-three/drei](https://github.com/pmndrs/drei) & [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Audio Synthesis**: Web Audio API (procedural tick sounds, gear ratchet clicks, flap whooshes, coin chimes)
- **Language**: TypeScript

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm, yarn, or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MrAfoo/chronos-automaton.git
   cd chronos-automaton
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🕹️ Controls & Keybindings

| Action | Control |
|---|---|
| **Rotate Camera** | Left-Click + Drag |
| **Pan Camera** | Right-Click + Drag |
| **Zoom** | Mouse Scroll Wheel / Pinch |
| **Wind Mainspring** | Click & Drag brass crown on the butterfly's thorax |
| **Move in Mini-Game** | `A` / `D` or `←` / `→` arrow keys |
| **Activate Shield** | `Spacebar` (when shield power-up is available) |
| **Reposition Beacon** | Click "Randomize Beacon" in Play Mode |
| **Toggle Controls Dock** | Click `[ ✕ ]` to minimize, `[ ⚙️ Controls ▲ ]` to expand |

---

## 📁 Project Structure

```
├── app/
│   ├── globals.css           # Global typography, color tokens, and scroll utilities
│   ├── layout.tsx            # Root Next.js layout & font optimization
│   └── page.tsx              # Application entry point
├── components/
│   ├── MechanicalButterfly.tsx # Core 3D Canvas, lighting environments & camera rigging
│   ├── ButterflyParts.tsx    # Clockwork mesh definitions & PBR physical materials
│   ├── ExplodedPart.tsx      # Part explosion animations & holographic inspection shaders
│   ├── GameCorridor.tsx      # Chronos Corridor 3-lane procedural endless runner
│   ├── GameHUD.tsx           # Flight Trial mini-game overlay (Score, Multiplier, Shields)
│   ├── OverlayHUD.tsx        # Two-tier glassmorphism HUD & controls bar
│   ├── WindingMechanism.tsx  # Spring barrel, ratchets, and interactive crown dragging
│   ├── audioManager.ts       # Web Audio API sound generator (gear ticks, whooshes, chimes)
│   ├── butterflyData.ts      # Horology specifications & condition definitions (16 parts)
│   ├── lightingPresets.ts    # Atmospheric lighting configurations & HDRIs
│   └── performanceConfig.ts  # Hardware capability detection & quality presets
└── public/
    ├── models/               # Kenney CC0 3D assets (coins, traps, columns)
    └── Textures/             # Stained-glass wing masks & gear normal maps
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
