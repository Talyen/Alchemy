import { describe, expect, it } from "vitest";
import { getScreenParticleConfig } from "@/app/screen-particle-config";
import {
  BATTLE_PARTICLE_COUNT,
  BATTLE_PARTICLE_INTENSITY_BOSS,
  BATTLE_PARTICLE_INTENSITY_NORMAL,
} from "@/lib/game-constants";

describe("getScreenParticleConfig", () => {
  it("returns boss intensity and count for boss battles", () => {
    const config = getScreenParticleConfig("battle", true);
    expect(config.particleAlphaMultiplier).toBe(BATTLE_PARTICLE_INTENSITY_BOSS);
    expect(config.particleCount).toBe(BATTLE_PARTICLE_COUNT);
    expect(config.particleColors).toBeDefined();
  });

  it("returns normal intensity and count for non-boss battles", () => {
    const config = getScreenParticleConfig("battle", false);
    expect(config.particleAlphaMultiplier).toBe(BATTLE_PARTICLE_INTENSITY_NORMAL);
    expect(config.particleCount).toBe(BATTLE_PARTICLE_COUNT);
  });

  it("ignores the boss flag off the battle screen", () => {
    const boss = getScreenParticleConfig("menu", true);
    const normal = getScreenParticleConfig("menu", false);
    expect(boss.particleAlphaMultiplier).toBe(normal.particleAlphaMultiplier);
    expect(boss.particleCount).toBeUndefined();
  });

  it("returns undefined colors for screens without a palette", () => {
    expect(getScreenParticleConfig("menu", false).particleColors).toBeUndefined();
    expect(getScreenParticleConfig("campfire", false).particleColors).toBeDefined();
  });
});
