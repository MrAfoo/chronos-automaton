"use client";

import React, { useMemo, useState } from "react";
import {
  ButterflyPartSpec,
  getPartConditionSummary,
  CONDITION_CONFIG,
} from "./butterflyData";
import { PresetKey, LIGHTING_PRESET_LIST } from "./lightingPresets";

export interface OverlayHUDProps {
  flightState: "SHOWCASE" | "SEEKING" | "ORBITING" | "INSPECTION";
  speed: number;
  distance: number;
  flapSpeed: number;
  setFlapSpeed: React.Dispatch<React.SetStateAction<number>>;
  onRandomizeLight: () => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isExploded: boolean;
  setIsExploded: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredPart: ButterflyPartSpec | null;
  // Diagnostic Scan props
  diagnosticState: "IDLE" | "SCANNING" | "COMPLETE";
  diagnosticProgress: number;
  scannedCount: number;
  activeScanPart: ButterflyPartSpec | null;
  triggerExplode: boolean;
  setTriggerExplode: React.Dispatch<React.SetStateAction<boolean>>;
  onRunDiagnostics: () => void;
  // Mainspring winding tension prop
  windTension: number;
  // Lighting mood preset switcher props
  activePreset: PresetKey;
  onSelectPreset: (preset: PresetKey) => void;
  // Performance mode props
  performanceMode: boolean;
  onTogglePerformanceMode: () => void;
  // Mini-game flight trial entry
  onStartGame: () => void;
}

export const OverlayHUD: React.FC<OverlayHUDProps> = ({
  flightState,
  speed,
  distance,
  flapSpeed,
  setFlapSpeed,
  onRandomizeLight,
  isPlaying,
  setIsPlaying,
  isExploded,
  setIsExploded,
  hoveredPart,
  diagnosticState,
  diagnosticProgress,
  scannedCount,
  activeScanPart,
  triggerExplode,
  setTriggerExplode,
  onRunDiagnostics,
  windTension,
  activePreset,
  onSelectPreset,
  performanceMode,
  onTogglePerformanceMode,
  onStartGame,
}) => {
  const isScanning = diagnosticState === "SCANNING";
  const isScanComplete = diagnosticState === "COMPLETE";
  const isShowcase = flightState === "SHOWCASE" && !isScanning && !isScanComplete;
  const isSeeking = flightState === "SEEKING" && !isScanning;
  const isInspection = flightState === "INSPECTION" && !isScanning;

  const [isBarClosed, setIsBarClosed] = useState(false);

  const conditionSummary = useMemo(() => getPartConditionSummary(), []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-6 md:p-10 select-none z-10 text-white font-sans overflow-hidden">
      {/* Top Header & Horology Title */}
      <div className="flex justify-between items-start gap-4">
        {/* Top Header & Horology Title (Hidden during Exploded Horology Inspection or Play Mode) */}
        {!isExploded && !isPlaying ? (
          <div className="flex flex-col gap-1 backdrop-blur-md bg-black/55 border border-amber-500/25 rounded-2xl p-5 shadow-2xl max-w-sm pointer-events-auto animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isScanning
                    ? "bg-cyan-400 animate-ping shadow-[0_0_12px_#06b6d4]"
                    : isScanComplete
                    ? "bg-cyan-300 shadow-[0_0_8px_#22d3ee]"
                    : isInspection
                    ? "bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]"
                    : isShowcase
                    ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"
                    : isSeeking
                    ? "bg-amber-400 animate-ping"
                    : "bg-teal-400 animate-pulse"
                }`}
              />
              <span
                className={`text-[11px] font-mono tracking-widest uppercase font-semibold ${
                  isScanning
                    ? "text-cyan-300"
                    : isScanComplete
                    ? "text-cyan-200"
                    : isInspection
                    ? "text-amber-300"
                    : isShowcase
                    ? "text-emerald-300"
                    : isSeeking
                    ? "text-amber-300"
                    : "text-teal-300"
                }`}
              >
                {isScanning
                  ? "Optoelectronic Diagnostic Sweep"
                  : isScanComplete
                  ? "Diagnostics Complete • Nominal"
                  : isInspection
                  ? "Exploded Horology Inspection"
                  : isShowcase
                  ? "Showcase Hover Mode"
                  : isSeeking
                  ? "Tracking Light Beacon"
                  : "Orbiting Active Beacon"}
              </span>
              {performanceMode && (
                <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full ml-auto">
                  ⚡ 60 FPS
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white/95 mt-1 font-serif">
              Mechanical Papillon
            </h1>
            <p className="text-xs text-white/60 leading-relaxed mt-1">
              {isScanning
                ? "High-precision laser grid sweeping along longitudinal caliber axis. Sub-assemblies undergoing sequential telemetry inspection."
                : isScanComplete
                ? "All 16 clockwork assemblies passed calibration. Escapement tolerances and gear mesh friction verified nominal."
                : isInspection
                ? "Mechanism expanded radially for horology inspection. Color-coded condition markers identify component wear and service urgency."
                : isShowcase
                ? "Autonomous clockwork automaton hovering in showcase mode. Click 'Play with Fly' or 'Run Diagnostics'."
                : "Active light pursuit game. Click anywhere in 3D to reposition the beacon; the fly will actively chase and orbit it."}
            </p>
          </div>
        ) : (
          <div />
        )}

        {/* Live Telemetry Pill / Hovered Part Inspector Card / Diagnostics Telemetry */}
        <div className="hidden md:flex flex-col gap-2 backdrop-blur-md bg-black/60 border border-white/10 rounded-2xl p-4 text-xs font-mono text-white/80 pointer-events-auto shadow-xl min-w-[300px] max-w-sm transition-all">
          {isScanning ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1.5">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-[10px] uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  LASER TELEMETRY HUD
                </div>
                <span className="text-[10px] text-cyan-400 font-bold">
                  {Math.round(diagnosticProgress * 100)}%
                </span>
              </div>
              <div className="w-full bg-cyan-950/60 rounded-full h-1.5 overflow-hidden border border-cyan-500/30">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round(diagnosticProgress * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/40">VERIFIED PARTS</span>
                <span className="text-cyan-300 font-semibold">{scannedCount} / 16</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/40">ACTIVE SUBSYSTEM</span>
                <span className="text-white font-medium truncate max-w-[150px] text-right">
                  {activeScanPart ? activeScanPart.label : "SWEEPING AXIS..."}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/40">BUS HARMONIC</span>
                <span className="text-emerald-400 font-semibold">28,800 VPH OK</span>
              </div>
            </div>
          ) : hoveredPart ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hoveredPart.condition === "critical"
                        ? "bg-red-400 animate-ping"
                        : hoveredPart.condition === "advisory"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={
                      hoveredPart.condition === "critical"
                        ? "text-red-400"
                        : hoveredPart.condition === "advisory"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {hoveredPart.condition.toUpperCase()} STATUS
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    hoveredPart.condition === "critical"
                      ? "bg-red-950/80 border-red-500/40 text-red-300"
                      : hoveredPart.condition === "advisory"
                      ? "bg-amber-950/80 border-amber-500/40 text-amber-300"
                      : "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {hoveredPart.tolerance}
                </span>
              </div>
              <div className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider">
                {hoveredPart.subtitle}
              </div>
              <div className="font-semibold text-white text-sm">{hoveredPart.label}</div>
              <div className="text-[11px] text-white/70 leading-snug">{hoveredPart.specs}</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/40">MODE</span>
                <span
                  className={`font-semibold ${
                    isInspection
                      ? "text-amber-400"
                      : isShowcase
                      ? "text-emerald-300"
                      : isSeeking
                      ? "text-amber-400"
                      : "text-teal-300"
                  }`}
                >
                  {flightState}
                </span>
              </div>
              {!isInspection && !isShowcase && (
                <>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-white/40">BEACON RANGE</span>
                    <span className="text-white/95 font-medium">
                      {distance.toFixed(1)} m
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-white/40">FLIGHT VELOCITY</span>
                    <span className="text-amber-300 font-medium">
                      {speed.toFixed(1)} m/s
                    </span>
                  </div>
                </>
              )}
              {isShowcase && (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-white/40">WING CADENCE</span>
                  <span className="text-emerald-300 font-medium">
                    {(flapSpeed * 3.8).toFixed(1)} Hz
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/40">CALIBER</span>
                <span className="text-white/60">CAL-8840 HOROLOGY</span>
              </div>

              {/* Mainspring Winding Tension Gauge */}
              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/50 tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        windTension > 0.08
                          ? "bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]"
                          : "bg-white/20"
                      }`}
                    />
                    MAINSPRING TENSION
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      windTension > 0.08 ? "text-amber-300" : "text-white/40"
                    }`}
                  >
                    {Math.round(windTension * 100)}%
                    {windTension > 0.05 && (
                      <span className="text-amber-400 font-normal ml-1">
                        ({(1.0 + windTension * 1.8).toFixed(1)}x RPM)
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 h-full transition-all duration-100"
                    style={{ width: `${Math.round(windTension * 100)}%` }}
                  />
                </div>
              </div>

              {/* Exploded View Part Condition Summary Readout */}
              {isInspection && (
                <div className="pt-2 border-t border-white/10 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] text-white/50 tracking-wider">
                    <span>COMPONENT WEAR INSPECTION</span>
                    <span className="text-amber-400 font-semibold">{conditionSummary.total} UNITS</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/45 px-2.5 py-1.5 rounded-lg border border-white/10 font-mono text-[10px]">
                    <span className="text-white/50 uppercase tracking-wider">STATUS:</span>
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="text-red-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        {conditionSummary.critical} CRIT
                      </span>
                      <span className="text-white/20">/</span>
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {conditionSummary.advisory} ADV
                      </span>
                      <span className="text-white/20">/</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {conditionSummary.nominal} NOM
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Center Scan Banner during Diagnostic Sweep */}
      {isScanning && (
        <div className="self-center backdrop-blur-lg bg-black/80 border border-cyan-400/60 rounded-2xl px-6 py-3 shadow-[0_0_40px_rgba(6,182,212,0.35)] pointer-events-auto flex items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <div className="flex flex-col text-left font-mono">
            <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider">
              TECH INSPECTION IN PROGRESS • {Math.round(diagnosticProgress * 100)}%
            </span>
            <span className="text-[11px] text-white/70">
              {activeScanPart ? `Calibrating ${activeScanPart.label}` : "Harmonic sweep active"}
            </span>
          </div>
          <div className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/40">
            {scannedCount}/16 OK
          </div>
        </div>
      )}

      {/* Bottom Interactive Controls Bar */}
      <div className="flex items-center justify-between gap-4 mt-auto">
        {isBarClosed ? (
          <button
            onClick={() => setIsBarClosed(false)}
            className="backdrop-blur-md bg-black/75 hover:bg-black/90 border border-white/20 hover:border-amber-400/60 rounded-2xl px-4 py-2 pointer-events-auto shadow-2xl flex items-center gap-2 text-xs font-mono text-white/80 hover:text-white transition-all cursor-pointer group animate-in fade-in zoom-in-95 duration-200"
            title="Open floating controls bar"
          >
            <span className="text-amber-400 group-hover:scale-110 transition-transform text-sm">⚙️</span>
            <span className="font-semibold tracking-wide">Controls</span>
            <span className="text-white/40 text-[10px] group-hover:text-amber-300">▲</span>
          </button>
        ) : (
          <div className="relative flex flex-col gap-2.5 backdrop-blur-md bg-black/75 border border-white/10 rounded-2xl p-2.5 pointer-events-auto shadow-2xl animate-in fade-in duration-200">
            {/* ROW 1: PRIMARY ACTION BUTTONS + CLOSE BUTTON */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* RUN DIAGNOSTICS BUTTON (Hidden when playing) */}
                {!isPlaying && (
                  <button
                    onClick={onRunDiagnostics}
                    disabled={isScanning}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 border cursor-pointer whitespace-nowrap ${
                      isScanning
                        ? "bg-cyan-500/30 text-cyan-200 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-not-allowed"
                        : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                    }`}
                    title="Trigger sweeping holographic diagnostics scan"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isScanning ? "bg-cyan-400 animate-ping" : "bg-cyan-400"
                      }`}
                    />
                    {isScanning ? "Diagnostics Running..." : "Run Diagnostics"}
                  </button>
                )}

                {/* PLAY WITH FLY / LIGHT GAME BUTTON */}
                {!isExploded && !isScanning && (
                  <button
                    onClick={() => setIsPlaying((prev) => !prev)}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer border whitespace-nowrap ${
                      isPlaying
                        ? "bg-emerald-500/30 text-emerald-200 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                        : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                    }`}
                    title="Toggle interactive light pursuit game"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isPlaying ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                      }`}
                    />
                    {isPlaying ? "Stop Playing" : "Play with Fly"}
                  </button>
                )}

                {/* PLAY MINI-GAME FLIGHT TRIAL BUTTON (Hidden when in Exploded View, Diagnostics, or Playing) */}
                {!isExploded && !isScanning && !isPlaying && (
                  <button
                    onClick={onStartGame}
                    className="px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer border bg-amber-500/25 hover:bg-amber-500/35 active:bg-amber-500/50 text-amber-200 border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.3)] whitespace-nowrap"
                    title="Launch Chronos Corridor 3-lane endless runner mini-game"
                  >
                    <span className="text-sm">🎮</span>
                    Flight Trial
                  </button>
                )}

                {/* EXPAND / ASSEMBLE TOGGLE BUTTON (Hidden during Diagnostics or Playing) */}
                {!isScanning && !isPlaying && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isExploded && isPlaying) setIsPlaying(false);
                      setIsExploded((prev) => !prev);
                    }}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer border whitespace-nowrap ${
                      isExploded
                        ? "bg-amber-500/30 text-amber-200 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                        : "bg-white/10 text-white/90 hover:bg-white/20 border-white/15"
                    }`}
                    title="Toggle exploded-view mechanism inspection"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-sm transition-transform duration-300 ${
                        isExploded ? "bg-amber-400 rotate-45" : "bg-white/70"
                      }`}
                    />
                    {isExploded ? "Assemble Mechanism" : "Exploded View"}
                  </button>
                )}

                {/* Flap Cadence Button (Active only when assembled and not scanning) */}
                {!isExploded && !isScanning && (
                  <button
                    onClick={() => setFlapSpeed((prev) => (prev >= 1.6 ? 0.6 : prev + 0.4))}
                    className="px-3.5 py-2 text-xs font-mono rounded-xl bg-white/5 hover:bg-white/15 active:bg-amber-500/30 text-white/80 transition-all flex items-center gap-2 cursor-pointer border border-white/5 whitespace-nowrap"
                    title="Adjust wing flapping cadence"
                  >
                    <span className="text-amber-400 font-bold">Hz</span>
                    Flap: {flapSpeed.toFixed(1)}x
                  </button>
                )}

                {/* Randomize Light Position Button (Active only during play) */}
                {!isExploded && isPlaying && !isScanning && (
                  <button
                    onClick={onRandomizeLight}
                    className="px-3.5 py-2 text-xs font-mono rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-amber-200 transition-all flex items-center gap-2 cursor-pointer border border-amber-500/30 animate-in fade-in whitespace-nowrap"
                    title="Shift beacon light to a new random location"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Randomize Beacon
                  </button>
                )}
              </div>

              {/* DOCKED CLOSE BUTTON */}
              <button
                onClick={() => setIsBarClosed(true)}
                className="px-2.5 py-1.5 text-xs font-mono rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-400 hover:text-red-300 active:bg-red-500/30 transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-none ml-auto"
                title="Close controls panel"
                aria-label="Close controls panel"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ROW 2: LIGHTING PRESETS + PERFORMANCE MODE TOGGLE */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 flex-wrap">
              {/* LIGHTING PRESET SWITCHER */}
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 shadow-inner flex-wrap">
                {LIGHTING_PRESET_LIST.map((preset) => {
                  const isActive = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => onSelectPreset(preset.id)}
                      className={`px-2.5 py-1.5 text-xs font-mono rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                        isActive
                          ? "bg-amber-500/25 text-amber-200 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)] font-semibold"
                          : "bg-white/5 text-white/60 hover:text-white/90 hover:bg-white/10 border-transparent"
                      }`}
                      title={`Atmospheric Lighting Mood: ${preset.name} (${preset.subtitle})`}
                    >
                      <span className="text-sm leading-none">{preset.icon}</span>
                      <span className="hidden sm:inline text-[11px]">{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* PERFORMANCE / LAPTOP 60 FPS TOGGLE */}
              <button
                onClick={onTogglePerformanceMode}
                className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                  performanceMode
                    ? "bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.25)] font-semibold"
                    : "bg-white/5 hover:bg-white/10 text-white/70 border-white/10"
                }`}
                title={
                  performanceMode
                    ? "Performance Mode Active (Locked 60 FPS, DPR 1.0, zero transmission overhead) - Click for Ultra Quality"
                    : "Ultra Quality Active (Refractive Glass & Bloom passes) - Click for Laptop 60 FPS Performance Mode"
                }
              >
                <span className="text-sm leading-none">{performanceMode ? "⚡" : "💎"}</span>
                <span className="hidden sm:inline text-[11px]">
                  {performanceMode ? "Performance (60 FPS)" : "Ultra Quality"}
                </span>
                <span className="sm:hidden text-[11px]">
                  {performanceMode ? "60 FPS" : "Ultra"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
