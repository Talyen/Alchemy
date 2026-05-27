// Background particle tint presets per screen.
import type { Screen } from "@/features/alchemy/types";

export const SCREEN_PARTICLE_COLORS: Partial<Record<Screen, readonly string[]>> = {
  battle: ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"],
  campfire: ["rgba(255, 180, 60, X)", "rgba(240, 120, 40, X)"],
  corruption: ["rgba(255, 90, 70, X)", "rgba(230, 60, 50, X)"],
  "run-victory": ["rgba(245, 196, 93, X)", "rgba(255, 220, 120, X)"],
};

export const SCREEN_PARTICLE_ALPHA: Partial<Record<Screen, number>> = {
  battle: 1.7,
  corruption: 2.0,
};

export const BOSS_PARTICLE_ALPHA_MULTIPLIER = 2.5;
