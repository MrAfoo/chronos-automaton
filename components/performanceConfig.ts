"use client";

/**
 * Performance & Quality Mode Configuration
 * Default mode is Ultra Quality (full shaders, bloom, and refractive stained glass).
 * Users can toggle to Performance Mode (60 FPS optimized) at any time.
 */

const STORAGE_KEY = "fly_performance_mode_v2";

export function detectLowSpecHardware(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Check if the user previously explicitly chose a mode in localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
  } catch (e) {
    console.warn("[PerformanceConfig] Failed to read preference:", e);
  }

  // Default: Ultra Quality (performanceMode = false)
  return false;
}

export function savePerformancePreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch (e) {
    console.warn("[PerformanceConfig] Failed to save preference:", e);
  }
}
