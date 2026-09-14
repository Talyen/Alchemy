import { describe, expect, it } from "vitest";
import { countUnlockedCombatTalents, resolveSimLoadout, simulateBattle, TIER_GOLD } from "@/lib/balance";
import { buildTypicalGearEffects } from "@/lib/balance/gear-preset";
import { buildSimCompanionBondLevels, companionIdsFromDeck } from "@/lib/balance/homestead-preset";
import { createSeededRng } from "@/lib/utils";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { characters, getStartingDeck } from "@/lib/game-data";
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
});

describe("buildTypicalGearEffects", () => {
  it("returns empty gear for early", () => {
    expect(buildTypicalGearEffects("rogue", "early", createSeededRng(1))).toEqual(defaultGearEffects);
  });

  it("rolls affinity-matching gear that is stable for a given rng seed", () => {
    const first = buildTypicalGearEffects("ranger", "late", createSeededRng(88));
    const second = buildTypicalGearEffects("ranger", "late", createSeededRng(88));
    expect(first).toEqual(second);
    expect(first).not.toEqual(defaultGearEffects);
  });
});

describe("simulateBattle loadout", () => {
  it("uses mid-tier gold when gold is omitted", () => {
    const result = simulateBattle({
      characterId: "rogue",
      enemyId: "skeleton",
      talentPreset: "mid",
      loadoutMode: "bare",
      seed: 7,
      maxTurns: 2,
      policy: "random-playable",
    });
    expect(result.outcome).toBeDefined();
  });

  it("honors an explicit gold override of 0", () => {
    const withGold = simulateBattle({
      characterId: "wizard",
      enemyId: "skeleton",
      talentPreset: "late",
      loadoutMode: "bare",
      gold: 80,
      seed: 3,
      maxTurns: 4,
      policy: "random-playable",
    });
    const zeroGold = simulateBattle({
      characterId: "wizard",
      enemyId: "skeleton",
      talentPreset: "late",
      loadoutMode: "bare",
      gold: 0,
      seed: 3,
      maxTurns: 4,
      policy: "random-playable",
    });
    expect(withGold.seed).toBe(zeroGold.seed);
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

describe("buildSimCompanionBondLevels", () => {
  it("bonds companions found in the deck by preset tier", () => {
    const deck = getStartingDeck("ranger");
    const ids = companionIdsFromDeck(deck);
    expect(ids.length).toBeGreaterThan(0);

    const early = buildSimCompanionBondLevels(deck, "early");
    const late = buildSimCompanionBondLevels(deck, "late");
    for (const id of ids) {
      expect(early[id]).toBe(1);
      expect(late[id]).toBe(3);
    }
  });

  it("leaves bond at zero for companions not in the deck", () => {
    const deck = getStartingDeck("knight");
    const bonds = buildSimCompanionBondLevels(deck, "late");
    expect(bonds.wolf).toBe(0);
  });
});
