import { expect, it } from "vitest";
import { createRandomPerformanceAccount } from "../../performance/random-account";
import { selectCase } from "../../performance/case-selection.mjs";
import { createCareerRuntime } from "@/app/playthrough/career-runtime";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { snapshotCareer } from "@/app/playthrough/career";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { restoreSessionSave } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readBattle, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import {
  canUnlockTalent,
  computeTalentEffects,
  type CharacterId,
  type KeywordId,
  type UnlockedTalents,
} from "@/lib/game-data";
import { computeGearManifest, gearDefinitions, normalizeGearInstance, pruneOrphanGearLoadouts } from "@/lib/gear";
import { computeTrinketManifest } from "@/lib/trinkets";

it("generates reproducible, diverse accounts for every hero without save repair or illegal talent purchases", async () => {
  const runtime = createCareerRuntime(0);
  const talents = new Set<string>();
  const trinkets = new Set<string>();
  const rarities = new Set<string>();
  const heroes = new Set<string>();
  try {
    for (let seed = 0; seed < 16; seed++) {
      const hero = selectCase("seeded-discovery", seed).hero as CharacterId;
      const before = runtime.snapshot();
      const save = createRandomPerformanceAccount(seed, hero, runtime.session);
      expect(createRandomPerformanceAccount(seed, hero, runtime.session)).toEqual(save);
      expect(runtime.snapshot()).toEqual(before);
      expect(evaluateSaveCandidates([JSON.stringify({ ...save, lastSavedAt: 1 })]).status).toEqual({ kind: "ok" });
      const inventory = save.gearInventories[hero];
      expect(pruneOrphanGearLoadouts(inventory, save.gearLoadouts)).toEqual(save.gearLoadouts);
      expect(new Set(Object.values(save.gearLoadouts[hero]).filter(Boolean))).toEqual(
        new Set(inventory.map((item) => item.instanceId)),
      );
      expect(inventory.length).toBeGreaterThanOrEqual(4);
      const uniques = inventory.filter((item) => gearDefinitions[item.definitionId]!.rarity === "unique");
      expect(new Set(uniques.map((item) => item.definitionId)).size).toBe(uniques.length);
      for (const item of inventory) {
        expect(normalizeGearInstance(item)).toEqual(item);
        rarities.add(gearDefinitions[item.definitionId]!.rarity);
      }
      let purchased: UnlockedTalents = {};
      for (const [keyword, ids] of Object.entries(save.unlockedTalents)) {
        for (const id of ids) {
          expect(canUnlockTalent(keyword as KeywordId, id, save.talentXP, purchased).ok).toBe(true);
          purchased = { ...purchased, [keyword]: [...(purchased[keyword as KeywordId] ?? []), id] };
        }
      }
      talents.add(JSON.stringify(save.unlockedTalents));
      trinkets.add(save.equippedTrinkets[hero]!);
      heroes.add(hero);
      // A different world seed must also vary the same hero's build.
      const other = createRandomPerformanceAccount(seed + 100, hero, runtime.session);
      expect(other.gearInventories[hero]).not.toEqual(inventory);
      expect(other.unlockedTalents).not.toEqual(save.unlockedTalents);
    }
    expect(heroes.size).toBe(8);
    expect(rarities).toEqual(new Set(["basic", "astral", "unique"]));
    expect(talents.size).toBeGreaterThan(1);
    expect(trinkets.size).toBeGreaterThan(1);
  } finally {
    await runtime.session.dispose();
  }
});

it("applies randomized gear, trinkets, and talents through real battle setup and preserves them on resume", async () => {
  for (let seed = 0; seed < 8; seed++) {
    const hero = selectCase("seeded-discovery", seed).hero as CharacterId;
    const runtime = createCareerRuntime(seed);
    const resumed = createCareerRuntime(seed);
    try {
      const save = createRandomPerformanceAccount(seed, hero, runtime.session);
      restoreSessionSave(save, runtime.session);
      const { flow } = createPlaythroughController(runtime.session);
      flow.goToScreen("game-mode-select");
      flow.beginCampaign();
      flow.handleCharacterSelect(hero);
      if (hero === "wildcard") {
        for (let pick = 0; pick < 20; pick++) {
          const card = readRunSession(runtime.session).starterDraftChoices?.[0];
          if (!card) break;
          flow.handleStarterDraftPick(card.id);
        }
        flow.handleStandardDraftComplete();
      }
      flow.handleDifficultySelect("difficulty-1");
      const battle = readBattle(runtime.session);
      expect(battle.hasActiveBattle, hero).toBe(true);
      const expected = {
        gearEffects: computeGearManifest(hero, save.gearInventories[hero], save.gearLoadouts),
        talentEffects: computeTalentEffects(save.unlockedTalents),
        trinketEffects: computeTrinketManifest([save.equippedTrinkets[hero]!]),
      };
      expect(battle.battleState, hero).toMatchObject(expected);
      const checkpoint = snapshotCareer(runtime.session);
      expect(checkpoint.activeRun?.characterId).toBe(hero);
      restoreSessionSave(checkpoint, resumed.session);
      expect(readBattle(resumed.session).battleState, hero).toMatchObject(expected);
      expect(snapshotCareer(resumed.session).gearLoadouts).toEqual(checkpoint.gearLoadouts);
      expect(snapshotCareer(resumed.session).unlockedTalents).toEqual(checkpoint.unlockedTalents);
    } finally {
      await runtime.session.dispose();
      await resumed.session.dispose();
    }
  }
});
