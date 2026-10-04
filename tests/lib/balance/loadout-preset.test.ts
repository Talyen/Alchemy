import { describe, expect, it } from "vitest";
import { countUnlockedCombatTalents, resolveSimLoadout, simulateBattle, TIER_GOLD } from "@/lib/balance";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { characters, createEmptyTalentEffectManifest } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";
import { defaultGearEffects } from "@/lib/gear/gear-effect-manifest";

describe("resolveSimLoadout", () => {
  it("seeds gold by tier and omits homestead, gear in bare mode", () => {
    const mid = resolveSimLoadout({ preset: "mid", characterId: "rogue", mode: "bare" });
    expect(mid.gold).toBe(TIER_GOLD.mid);
    expect(mid.gearEffects).toEqual(defaultGearEffects);
    expect(mid.coreTrinketIds).toEqual([]);
    expect(mid.homesteadCombat.runMaxHealthBonus).toBe(0);
    expect(mid.talentPointHealth).toBe(countUnlockedCombatTalents(characters.rogue.keywords, "mid"));
    expect(mid.talentPointHealth).toBeGreaterThan(0);
  });

  it("adds homestead stars, seeded gear, and core trinkets in typical mode", () => {
    const late = resolveSimLoadout({ preset: "late", characterId: "knight", mode: "typical", seed: 11 });
    expect(late.gold).toBe(TIER_GOLD.late);
    expect(late.homesteadCombat.runMaxHealthBonus).toBe(10);
    expect(late.coreTrinketIds).toContain("tattered-pages");
    expect(late.gearEffects).not.toEqual(defaultGearEffects);

    const mid = resolveSimLoadout({ preset: "mid", characterId: "rogue", mode: "typical", seed: 11 });
    expect(mid.homesteadCombat.runMaxHealthBonus).toBe(5);
    expect(mid.coreTrinketIds).toEqual(["groves-favor"]);
  });

  it("rolls the same typical gear for the same seed", () => {
    const first = resolveSimLoadout({ preset: "late", characterId: "wizard", mode: "typical", seed: 42 });
    const second = resolveSimLoadout({ preset: "late", characterId: "wizard", mode: "typical", seed: 42 });
    expect(first.gearEffects).toEqual(second.gearEffects);
  });

  it.each(["bare", "typical"] as const)("keeps %s loadouts independent between fights", (mode) => {
    const options = { preset: "late" as const, characterId: "knight" as const, mode, seed: 11 };
    const first = resolveSimLoadout(options);
    const expected = structuredClone(first);
    first.homesteadCombat.companionBondLevels.wolf = 999;
    first.homesteadCombat.cardHealBonus.apple = 999;
    first.gearEffects.maxHealth = 999;
    first.coreTrinketIds.push("meteorite");
    expect(resolveSimLoadout(options)).toEqual(expected);
  });
});

describe("simulateBattle loadout", () => {
  it("applies the same Companion bonds to direct and nested summon cards in bare simulations", () => {
    const summon = { kind: "summon-companion" as const, companionId: "wolf" as const };
    const card = makeTestCard({ id: "bond-probe", cost: 0, effects: [summon] });
    const options = {
      characterId: "knight" as const,
      enemyId: "skeleton",
      talentPreset: "early" as const,
      loadoutMode: "bare" as const,
      seed: 7,
      maxTurns: 3,
      appliesFightPacing: false,
      trackMetrics: true,
    };
    const direct = simulateBattle({ ...options, deck: [card] });
    const nested = simulateBattle({
      ...options,
      deck: [{ ...card, effects: [{ kind: "chance", probability: 1, successEffects: [summon], failureEffects: [] }] }],
    });
    expect(direct.totalCardsPlayed).toBeGreaterThan(0);
    expect(direct.enemyHealth).toBeLessThan(direct.enemyMaxHealth);
    expect(nested).toEqual(direct);
  });

  it("uses tier Gold when omitted but honors an explicit empty purse in Gold-scaled damage", () => {
    const options = {
      characterId: "knight" as const,
      enemyId: "skeleton",
      talentPreset: "mid" as const,
      loadoutMode: "bare" as const,
      seed: 7,
      maxTurns: 1,
      appliesFightPacing: false,
      talentEffects: { ...createEmptyTalentEffectManifest(), holyGoldPercent: 100 },
      deck: [makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 1 }] })],
    };
    const defaultPurse = simulateBattle(options);
    const emptyPurse = simulateBattle({ ...options, gold: 0 });
    expect(defaultPurse.totalCardsPlayed).toBe(1);
    expect(emptyPurse.totalCardsPlayed).toBe(1);
    expect(defaultPurse).toEqual(simulateBattle({ ...options, gold: TIER_GOLD.mid }));
    expect(emptyPurse.enemyHealth).toBeGreaterThan(defaultPurse.enemyHealth);
  });

  it("applies gearEffects to max health", () => {
    const base = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      loadoutMode: "bare",
      gearEffects: { ...defaultGearEffects },
      seed: 4,
      maxTurns: 1,
      policy: "random-playable",
    });
    const boosted = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      loadoutMode: "bare",
      gearEffects: { ...defaultGearEffects, maxHealth: 25 },
      seed: 4,
      maxTurns: 1,
      policy: "random-playable",
    });
    expect(boosted.playerMaxHealth).toBe(base.playerMaxHealth + 25);
  });

  it("adds talent-point HP on bare mid and full typical HP stack", () => {
    const loadout = resolveSimLoadout({
      preset: "mid",
      characterId: "rogue",
      mode: "typical",
      seed: 4,
    });
    const typical = simulateBattle({
      characterId: "rogue",
      enemyId: "skeleton",
      talentPreset: "mid",
      loadoutMode: "typical",
      seed: 4,
      maxTurns: 1,
      policy: "random-playable",
    });
    expect(typical.playerMaxHealth).toBe(
      MAX_PLAYER_HEALTH +
        loadout.talentPointHealth +
        loadout.homesteadCombat.runMaxHealthBonus +
        loadout.gearEffects.maxHealth,
    );

    const bare = simulateBattle({
      characterId: "rogue",
      enemyId: "skeleton",
      talentPreset: "mid",
      loadoutMode: "bare",
      seed: 4,
      maxTurns: 1,
      policy: "random-playable",
    });
    expect(bare.playerMaxHealth).toBe(MAX_PLAYER_HEALTH + loadout.talentPointHealth);
  });
});
