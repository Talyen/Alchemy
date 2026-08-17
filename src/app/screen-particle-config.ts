import { BATTLE_PARTICLE_ALPHA_BOSS, BATTLE_PARTICLE_ALPHA_NORMAL } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";

const SCREEN_PARTICLE_COLORS: Partial<Record<Screen, readonly string[]>> = {
  battle: ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"],
  campfire: ["rgba(255, 180, 60, X)", "rgba(240, 120, 40, X)"],
  corruption: ["rgba(255, 90, 70, X)", "rgba(230, 60, 50, X)"],
  "run-victory": ["rgba(245, 196, 93, X)", "rgba(255, 220, 120, X)"],
};

const SCREEN_PARTICLE_ALPHA: Partial<Record<Screen, number>> = {
  battle: BATTLE_PARTICLE_ALPHA_NORMAL,
  corruption: 2.0,
};

export function getScreenParticleConfig(renderedScreen: Screen, isBossBattle: boolean) {
  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const particleAlphaMultiplier = isBossBattle ? BATTLE_PARTICLE_ALPHA_BOSS : SCREEN_PARTICLE_ALPHA[renderedScreen];
  return { particleColors, particleAlphaMultiplier };
}
