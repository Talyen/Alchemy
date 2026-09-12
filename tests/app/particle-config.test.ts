import { describe, expect, it } from "vitest";
import { getScreenParticleConfig } from "@/app/screen-particle-config";
import {
  BATTLE_PARTICLE_COUNT,
  BATTLE_PARTICLE_INTENSITY_BOSS,
  BATTLE_PARTICLE_INTENSITY_NORMAL,
} from "@/lib/game-constants";

describe("getScreenParticleConfig", () => {
  it.each([
    ["boss", true, BATTLE_PARTICLE_INTENSITY_BOSS],
    ["normal", false, BATTLE_PARTICLE_INTENSITY_NORMAL],
  ] as const)("returns %s battle intensity and count", (_, isBossBattle, expectedIntensity) => {
    const config = getScreenParticleConfig("battle", isBossBattle);
    expect(config.particleAlphaMultiplier).toBe(expectedIntensity);
    expect(config.particleCount).toBe(BATTLE_PARTICLE_COUNT);
  });

  it("ignores the boss flag off the battle screen", () => {
    const boss = getScreenParticleConfig("menu", true);
    const normal = getScreenParticleConfig("menu", false);
    expect(boss.particleAlphaMultiplier).toBe(normal.particleAlphaMultiplier);
    expect(boss.particleCount).toBeUndefined();
  });
});
