import { BOSS_PARTICLE_ALPHA_MULTIPLIER, SCREEN_PARTICLE_ALPHA, SCREEN_PARTICLE_COLORS } from "@/app/screen-particles";
import type { Screen } from "@/lib/routing";

export function useScreenParticleConfig(renderedScreen: Screen, isBossBattle: boolean) {
  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const particleAlphaMultiplier = isBossBattle ? BOSS_PARTICLE_ALPHA_MULTIPLIER : SCREEN_PARTICLE_ALPHA[renderedScreen];
  return { particleColors, particleAlphaMultiplier };
}
