"use client";

import React from "react";
import { LaneIndex } from "./GameCorridor";
import { PresetKey } from "./lightingPresets";

export interface GameHUDProps {
  gameState: "MENU" | "PLAYING" | "GAME_OVER";
  score: number;
  bestScore: number;
  speed: number;
  distance: number;
  gearsCollected: number;
  currentLane: LaneIndex;
  isNewRecord: boolean;
  powerupState?: {
    slowMoRemaining: number;
    hasShield: boolean;
    magnetRemaining: number;
  };
  combo?: number;
  bannerText?: string | null;
  performanceMode?: boolean;
  onTogglePerformanceMode?: () => void;
  onStartRun: () => void;
  onRetryRun: () => void;
  onExitGame: () => void;
  onShiftLane: (dir: -1 | 1) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameState,
  score,
  bestScore,
  speed,
  distance,
  gearsCollected,
  currentLane,
  isNewRecord,
  powerupState = { slowMoRemaining: 0, hasShield: false, magnetRemaining: 0 },
  combo = 1,
  bannerText = null,
  performanceMode = false,
  onTogglePerformanceMode,
  onStartRun,
  onRetryRun,
  onExitGame,
  onShiftLane,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-8 select-none z-20 text-white font-sans">
      {/* =====================================================================
          1. MENU / START OVERLAY SCREEN
      ====================================================================== */}
      {gameState === "MENU" && (
        <div className="m-auto pointer-events-auto max-w-lg w-full backdrop-blur-xl bg-black/75 border border-amber-500/35 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f59e0b]" />
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-amber-300">
              Horology Flight Trial • Endless Corridor
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-serif font-light text-white tracking-tight mt-1">
            Chronos Corridor
          </h2>

          <p className="text-xs text-white/70 leading-relaxed mt-2 font-sans">
            Maneuver the compact mechanical papillon through the high-velocity caliber shaft. Dodge steam
            pistons, swinging scythe pendulums, and ground saw gears while collecting power-ups and chronos cogs!
          </p>

          {/* Controls & Powerups Instruction Card */}
          <div className="my-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-white/90">
              <span className="text-white/60">CONTROLS:</span>
              <span className="text-amber-300 font-semibold">
                [ ← ] [ → ] or [ A ] [ D ] / Swipe
              </span>
            </div>
            <div className="flex items-center justify-between text-white/90 border-t border-white/10 pt-2">
              <span className="text-white/60">POWER-UPS:</span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-cyan-300 font-semibold">⏳ Slow-Mo</span>
                <span className="text-purple-300 font-semibold">🛡️ Shield</span>
                <span className="text-emerald-300 font-semibold">🧲 Magnet</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-white/90 border-t border-white/10 pt-2">
              <span className="text-white/60">COMBO:</span>
              <span className="text-yellow-300 font-semibold">Gather cogs in cadence for up to 5x PTS!</span>
            </div>
          </div>

          {/* Best Record Display */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 mb-3">
            <span className="text-xs font-mono text-amber-300/80">BEST TRIAL RECORD</span>
            <span className="text-sm font-mono font-bold text-amber-200">
              {bestScore.toLocaleString()} PTS
            </span>
          </div>

          {/* Quick Laptop Performance Toggle */}
          {onTogglePerformanceMode && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 mb-5 font-mono text-xs">
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-amber-400">{performanceMode ? "⚡" : "💎"}</span>
                <span className="text-[11px] font-medium">
                  {performanceMode ? "LAPTOP 60 FPS MODE:" : "DISPLAY QUALITY:"}
                </span>
              </div>
              <button
                type="button"
                onClick={onTogglePerformanceMode}
                className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer border ${
                  performanceMode
                    ? "bg-amber-500/25 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                    : "bg-white/10 text-white/60 hover:text-white border-transparent"
                }`}
              >
                {performanceMode ? "⚡ 60 FPS ACTIVE" : "💎 ULTRA QUALITY"}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStartRun}
              className="flex-1 py-3 px-6 rounded-2xl font-mono text-xs font-bold tracking-wider uppercase text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚡</span> Start Run
            </button>
            <button
              onClick={onExitGame}
              className="py-3 px-5 rounded-2xl font-mono text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Return to Showcase
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. ACTIVE PLAYING HUD OVERLAY
      ====================================================================== */}
      {gameState === "PLAYING" && (
        <>
          {/* Top Bar: Live Telemetry & Exit Button */}
          <div className="flex items-start justify-between gap-4 pointer-events-auto">
            <div className="flex items-center flex-wrap gap-2.5 backdrop-blur-md bg-black/60 border border-white/10 rounded-2xl p-2.5 shadow-xl">
              {/* Score Display */}
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center gap-2">
                <span className="text-[10px] font-mono text-amber-300">SCORE</span>
                <span className="text-sm sm:text-base font-mono font-bold text-amber-200 min-w-[70px]">
                  {score.toLocaleString()}
                </span>
              </div>

              {/* Dynamic Combo Multiplier Badge */}
              {combo > 1 && (
                <div className="px-2.5 py-1.5 rounded-xl bg-yellow-500/25 border border-yellow-400/60 font-mono text-xs font-bold text-yellow-200 flex items-center gap-1 shadow-[0_0_12px_rgba(234,179,8,0.4)] animate-pulse">
                  <span>⚡</span>
                  <span>x{combo} COMBO</span>
                </div>
              )}

              {/* Velocity */}
              <div className="hidden sm:flex px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 items-center gap-2">
                <span className="text-[10px] font-mono text-white/50">SPEED</span>
                <span className="text-xs font-mono font-semibold text-white/90">
                  {speed} M/S
                </span>
              </div>

              {/* Distance */}
              <div className="hidden sm:flex px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 items-center gap-2">
                <span className="text-[10px] font-mono text-white/50">DIST</span>
                <span className="text-xs font-mono font-semibold text-white/90">
                  {distance} M
                </span>
              </div>

              {/* Collectibles */}
              <div className="px-3 py-1.5 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center gap-1.5">
                <span className="text-yellow-400 text-xs">⚙️</span>
                <span className="text-xs font-mono font-bold text-yellow-200">
                  {gearsCollected}
                </span>
              </div>
            </div>

            {/* Exit Trial Button */}
            <button
              onClick={onExitGame}
              className="px-3.5 py-2 rounded-xl backdrop-blur-md bg-black/60 border border-white/15 text-xs font-mono text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer shadow-lg"
              title="Pause and return to normal showcase mode"
            >
              Exit Trial
            </button>
          </div>

          {/* Active Power-up Status Pills */}
          <div className="flex items-center gap-2 mt-2 pointer-events-none">
            {powerupState.slowMoRemaining > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-400/60 text-cyan-200 text-xs font-mono font-semibold flex items-center gap-2 shadow-[0_0_14px_rgba(6,182,212,0.4)] animate-in fade-in">
                <span className="animate-spin">⏳</span>
                <span>SLOW-MO ({powerupState.slowMoRemaining}s)</span>
              </div>
            )}
            {powerupState.hasShield && (
              <div className="px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-400/70 text-purple-200 text-xs font-mono font-semibold flex items-center gap-2 shadow-[0_0_14px_rgba(168,85,247,0.4)] animate-pulse">
                <span>🛡️</span>
                <span>AEGIS SHIELD ACTIVE</span>
              </div>
            )}
            {powerupState.magnetRemaining > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-400/60 text-emerald-200 text-xs font-mono font-semibold flex items-center gap-2 shadow-[0_0_14px_rgba(16,185,129,0.4)] animate-in fade-in">
                <span>🧲</span>
                <span>MAGNET ({powerupState.magnetRemaining}s)</span>
              </div>
            )}
          </div>

          {/* Floating Event Notification Toast - Positioned at top to never obstruct the flight corridor */}
          {bannerText && (
            <div className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-in fade-in slide-in-from-top-3 duration-200">
              <div
                className={`px-4 py-1.5 rounded-full backdrop-blur-xl bg-black/85 border text-xs font-mono font-bold tracking-wide shadow-2xl flex items-center gap-2 whitespace-nowrap uppercase ${
                  bannerText.includes("SHIELD")
                    ? "border-purple-400/80 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                    : bannerText.includes("SLOW-MO") || bannerText.includes("TEMPORAL")
                    ? "border-cyan-400/80 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                    : bannerText.includes("MAGNET")
                    ? "border-emerald-400/80 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                    : "border-amber-400/80 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                }`}
              >
                <span>
                  {bannerText.includes("SHIELD")
                    ? "🛡️"
                    : bannerText.includes("SLOW-MO") || bannerText.includes("TEMPORAL")
                    ? "⏳"
                    : bannerText.includes("MAGNET")
                    ? "🧲"
                    : bannerText.includes("DEFLECT")
                    ? "💥"
                    : "✨"}
                </span>
                <span>{bannerText}</span>
              </div>
            </div>
          )}

          {/* Bottom Bar: Lane Position Tracker & Touch Shift Buttons */}
          <div className="flex flex-col items-center gap-3 mt-auto pointer-events-auto">
            {/* 3-Lane Position Indicators */}
            <div className="flex items-center gap-2 backdrop-blur-md bg-black/60 border border-white/10 rounded-2xl p-2 shadow-2xl">
              <span
                className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all ${
                  currentLane === -1
                    ? "bg-amber-500/30 text-amber-200 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] font-bold scale-105"
                    : "bg-white/5 text-white/40 border border-transparent"
                }`}
              >
                ◀ LEFT
              </span>
              <span
                className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all ${
                  currentLane === 0
                    ? "bg-amber-500/30 text-amber-200 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] font-bold scale-105"
                    : "bg-white/5 text-white/40 border border-transparent"
                }`}
              >
                ● CENTER
              </span>
              <span
                className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all ${
                  currentLane === 1
                    ? "bg-amber-500/30 text-amber-200 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.4)] font-bold scale-105"
                    : "bg-white/5 text-white/40 border border-transparent"
                }`}
              >
                RIGHT ▶
              </span>
            </div>

            {/* Mobile Touch Shift Tap Zones */}
            <div className="flex sm:hidden w-full gap-4 max-w-xs">
              <button
                onClick={() => onShiftLane(-1)}
                className="flex-1 py-3 bg-white/10 active:bg-amber-500/30 border border-white/15 rounded-2xl font-mono text-xs font-bold text-white text-center cursor-pointer shadow-lg"
              >
                ◀ TAP LEFT
              </button>
              <button
                onClick={() => onShiftLane(1)}
                className="flex-1 py-3 bg-white/10 active:bg-amber-500/30 border border-white/15 rounded-2xl font-mono text-xs font-bold text-white text-center cursor-pointer shadow-lg"
              >
                TAP RIGHT ▶
              </button>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          3. GAME OVER OVERLAY SCREEN
      ====================================================================== */}
      {gameState === "GAME_OVER" && (
        <div className="m-auto pointer-events-auto max-w-md w-full backdrop-blur-xl bg-black/85 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping shadow-[0_0_12px_#ef4444]" />
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-red-300">
              Caliber Impact Detected
            </span>
          </div>

          <h2 className="text-3xl font-serif font-light text-white tracking-tight mt-1">
            Trial Terminated
          </h2>

          {/* New Record Banner */}
          {isNewRecord && (
            <div className="my-3 py-2 px-4 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center gap-2 animate-bounce">
              <span className="text-base">🏆</span>
              <span className="text-xs font-mono font-bold text-amber-200 tracking-wider">
                NEW PERSONAL BEST RECORD!
              </span>
            </div>
          )}

          {/* Performance Summary Card */}
          <div className="my-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-white/60">FINAL SCORE:</span>
              <span className="text-xl font-bold text-amber-300">
                {score.toLocaleString()} PTS
              </span>
            </div>
            <div className="flex items-center justify-between text-white/80">
              <span className="text-white/60">BEST RECORD:</span>
              <span className="font-semibold text-white">
                {bestScore.toLocaleString()} PTS
              </span>
            </div>
            <div className="flex items-center justify-between text-white/80">
              <span className="text-white/60">CHRONOS COGS:</span>
              <span className="text-yellow-300 font-semibold">
                ⚙️ {gearsCollected} harvested
              </span>
            </div>
            <div className="flex items-center justify-between text-white/80">
              <span className="text-white/60">DISTANCE FLOWN:</span>
              <span className="text-white/90 font-semibold">{distance} meters</span>
            </div>
          </div>

          {/* Quick Laptop Performance Toggle on Game Over */}
          {onTogglePerformanceMode && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 mb-4 font-mono text-xs">
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-amber-400">{performanceMode ? "⚡" : "💎"}</span>
                <span className="text-[11px] font-medium">
                  {performanceMode ? "LAPTOP 60 FPS MODE:" : "DISPLAY QUALITY:"}
                </span>
              </div>
              <button
                type="button"
                onClick={onTogglePerformanceMode}
                className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer border ${
                  performanceMode
                    ? "bg-amber-500/25 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                    : "bg-white/10 text-white/60 hover:text-white border-transparent"
                }`}
              >
                {performanceMode ? "⚡ 60 FPS ACTIVE" : "💎 ULTRA QUALITY"}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={onRetryRun}
              className="flex-1 py-3 px-6 rounded-2xl font-mono text-xs font-bold tracking-wider uppercase text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🔄</span> Retry Trial
            </button>
            <button
              onClick={onExitGame}
              className="py-3 px-5 rounded-2xl font-mono text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Exit to Showcase
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
