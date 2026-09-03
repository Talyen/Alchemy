import { describe, expect, it } from "vitest";
import {
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
  createNextRewardState,
  getActiveRewardModifiersForContentSystem,
  getCompanionCardChoices,
  getGenerousGoldBonus,
  getWealthyGoldBonus,
  getWellProvisionedHealing,
  getRandomPotionCard,
  finalizeRewardState,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
} from "@/features/alchemy/run-loop/navigation/reward-flow";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { executeRewardRouteTransition } from "@/features/alchemy/run-loop/run/run-flow-rewards";
import { createEmptyRewardState, type BoonRewardState } from "@/lib/active-run-session";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeRewardRouteDeps } from "../../../../helpers/destination-route-handlers";
import { ROUTE_SCREENS } from "@/lib/routing";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";

describe("reward flow orchestration", () => {
  describe("createEmptyRewardState", () => {
    it("accepts optional destinations", () => {
      const result = createEmptyRewardState(["Campfire", "Mystery"]);
      expect(result.destinations).toEqual(["Campfire", "Mystery"]);
    });
  });

  describe("createNextRewardState", () => {
    it("clears choices, gold, and selection but keeps destinations and selectedBossId", () => {
      const previous = {
        ...createEmptyRewardState(["Normal Combat", "Campfire"]),
        choices: [{ id: "card-a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: {} }],
        gold: 12,
        selectedId: "card-a",
        rewardType: "trinket" as const,
        selectedBossId: "boss-1",
      };

      const next = createNextRewardState(previous);

      expect(next.choices).toEqual([]);
      expect(next.gold).toBe(0);
      expect(next.selectedId).toBeNull();
      expect(next.rewardType).toBe("card");
      expect(next.destinations).toEqual(["Normal Combat", "Campfire"]);
      expect(next.selectedBossId).toBe("boss-1");
      expect(next.materials).toEqual(emptyInventory());
    });
  });

  describe("computeVictoryGold unmultiplied total", () => {
    function unmultipliedTotal(
      input: Omit<Parameters<typeof computeVictoryGold>[0], "purseGold" | "goldMultiplier" | "wealthyBonus"> & {
        wealthyBonus?: number;
      },
    ) {
      return computeVictoryGold({
        wealthyBonus: 0,
        ...input,
        purseGold: 0,
        goldMultiplier: 1,
      }).persistedGold;
    }

    it("sums all gold sources", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 15 },
        runBoons: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        wealthyBonus: 12,
        bossBonus: 5,
        talentGoldPerCombat: 2,
      });
      expect(result).toBe(47);
    });

    it("handles zero gold sources", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 0 },
        runBoons: [],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(0);
    });

    it("includes Smuggler's Map boon gold bonus", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: ["smugglers-map"],
        gold: 5,
        eliteBonus: 1,
        generousBonus: 0,
        bossBonus: 2,
        talentGoldPerCombat: 1,
      });
      expect(result).toBeGreaterThan(19);
    });

    it("handles nonexistent boon gracefully", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: ["bad-id"],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(10);
    });

    it("includes generous bonus by name", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: [],
        gold: 5,
        eliteBonus: 0,
        generousBonus: 4,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(19);
    });
  });

  describe("Labyrinth reward modifier helpers", () => {
    it("exposes reward traits for encounter modes but not campaign", () => {
      const modifiers = ["alchemist", "generous"] as Array<"companion" | "alchemist" | "generous" | "scavenger">;

      expect(getActiveRewardModifiersForContentSystem("labyrinth", modifiers)).toBe(modifiers);
      expect(getActiveRewardModifiersForContentSystem("campaign", modifiers)).toEqual([]);
      expect(getActiveRewardModifiersForContentSystem("wildwood", modifiers)).toBe(modifiers);
    });

    it("computes generous gold bonus from base reward gold", () => {
      expect(getGenerousGoldBonus(["generous"], 11)).toBe(6);
      expect(getGenerousGoldBonus([], 11)).toBe(0);
    });

    it("computes wealthy gold bonus from config", () => {
      expect(getWealthyGoldBonus(["wealthy"])).toBe(LABYRINTH_REWARD_CONFIG.wealthyGoldBonus);
      expect(getWealthyGoldBonus([])).toBe(0);
    });

    it("computes well-provisioned healing from max health", () => {
      expect(getWellProvisionedHealing(["wellProvisioned"], 100)).toBe(15);
      expect(getWellProvisionedHealing(["wellProvisioned"], 1)).toBe(1);
      expect(getWellProvisionedHealing([], 100)).toBe(0);
    });

    it("doubles materials for scavenger without mutating the source inventory", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger"]);

      expect(result).toEqual({ wood: 2, iron: 4, herbs: 6, food: 8, gems: 10 });
      expect(materials).toEqual({ wood: 1, iron: 2, herbs: 3, food: 4, gems: 5 });
    });

    it("adds herbalist herbs after scavenger doubling", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger", "herbalist"]);

      expect(result.herbs).toBe(6 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
      expect(result.wood).toBe(2);
    });

    it("adds herbalist herbs when scavenger is inactive", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["herbalist"]);
      expect(result.herbs).toBe(3 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
    });

    it("leaves materials unchanged when scavenger is inactive", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5 };
      expect(applyLabyrinthRewardMaterialModifiers(materials, [])).toBe(materials);
    });

    it("maps reward modifier kinds to reward behavior flags", () => {
      const modifiers = ["companion", "alchemist"] as Array<"companion" | "alchemist" | "generous" | "scavenger">;

      expect(shouldGrantCompanionReward(modifiers)).toBe(true);
      expect(shouldGrantAlchemistReward(modifiers)).toBe(true);
      expect(shouldGrantCompanionReward([])).toBe(false);
      expect(shouldGrantAlchemistReward([])).toBe(false);
    });
  });

  describe("getCompanionCardChoices", () => {
    it("returns three unique companion cards", () => {
      const choices = getCompanionCardChoices(() => 0);

      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((card) => card.id)).size).toBe(3);
      expect(choices.every((card) => card.effects.some((effect) => effect.kind === "summon-companion"))).toBe(true);
    });

    it("uses Fisher-Yates ordering with injected rng", () => {
      const choices = getCompanionCardChoices(() => 0).map((card) => card.id);

      expect(choices).toEqual(["lizard-scout-companion", "frost-whelp-companion", "bear-companion"]);
    });
  });

  describe("finalizeRewardState", () => {
    const cardChoice: BattleCard = {
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal damage"],
      art: "",
      cost: 1,
      effects: [],
    };
    const companionChoice: BattleCard = {
      id: "wolf-companion",
      title: "Wolf",
      descriptionLines: ["Summon wolf"],
      art: "",
      cost: 1,
      effects: [],
    };
    const boonChoice: TrinketEntry = {
      id: "bone-charm",
      title: "Bone Charm",
      descriptionLines: ["Heal on kill"],
      art: "",
      effects: {},
    };

    function stampedRewardState(
      overrides: Partial<ReturnType<typeof createEmptyRewardState>> = {},
      victory: {
        enemyType: "normal" | "elite" | "boss";
        contentSystem: "campaign" | "labyrinth" | "wildwood";
      } = {
        enemyType: "normal",
        contentSystem: "campaign",
      },
    ) {
      return {
        ...createEmptyRewardState(),
        ...overrides,
        lastVictoryEnemyType: victory.enemyType,
        lastVictoryContentSystem: victory.contentSystem,
      };
    }

    it("returns the selected card reward and routes normal campaign fights to destination", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({
          choices: [cardChoice],
          gold: 10,
          materials: emptyInventory(),
          selectedId: "slash",
          destinations: ["Campfire"],
          rewardType: "card",
        }),
        companionRewardCards: null,
      });

      expect(result.selectedReward).toEqual({ rewardType: "card", choice: cardChoice });
      expect(result.route).toBe("destination");
      expect(result.nextRewardState).toEqual(expect.objectContaining({ choices: [], destinations: ["Campfire"] }));
    });

    it("preserves selected boss metadata for the destination preview", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({
          choices: [cardChoice],
          gold: 10,
          materials: emptyInventory(),
          selectedId: "slash",
          destinations: ["Boss Combat"],
          rewardType: "card",
          selectedBossId: "frostwarden",
        }),
        companionRewardCards: null,
      });

      expect(result.nextRewardState.selectedBossId).toBe("frostwarden");
    });

    it("returns the selected boon reward", () => {
      const rewardState = {
        ...stampedRewardState({}),
        rewardType: "boon",
        choices: [boonChoice],
        gold: 10,
        materials: emptyInventory(),
        selectedId: "bone-charm",
      } satisfies BoonRewardState;
      const result = finalizeRewardState({
        rewardState,
        companionRewardCards: null,
      });

      expect(result.selectedReward).toEqual({ rewardType: "boon", choice: boonChoice });
    });

    it("creates the companion reward step before routing onward", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState(
          {
            choices: [cardChoice],
            gold: 10,
            materials: emptyInventory(),
            selectedId: "slash",
            destinations: ["Mystery"],
            rewardType: "card",
          },
          { enemyType: "normal", contentSystem: "labyrinth" },
        ),
        companionRewardCards: [companionChoice],
      });

      expect(result.route).toBe("companion-reward");
      expect(result.clearCompanionRewardCards).toBe(true);
      expect(result.nextRewardState).toEqual(
        expect.objectContaining({
          choices: [companionChoice],
          gold: 0,
          materials: emptyInventory(),
          selectedId: null,
          destinations: ["Mystery"],
          rewardType: "card",
          lastVictoryEnemyType: "normal",
          lastVictoryContentSystem: "labyrinth",
        }),
      );
    });

    it("routes labyrinth non-boss rewards back to the labyrinth map", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({}, { enemyType: "elite", contentSystem: "labyrinth" }),
        companionRewardCards: null,
      });

      expect(result.route).toBe("labyrinth-map");
    });

    it("routes labyrinth boss rewards back to the map", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({}, { enemyType: "boss", contentSystem: "labyrinth" }),
        companionRewardCards: null,
      });

      expect(result.route).toBe("labyrinth-map");
    });

    it("routes campaign boss rewards to act completion", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({}, { enemyType: "boss", contentSystem: "campaign" }),
        companionRewardCards: null,
      });

      expect(result.route).toBe("act-complete");
    });

    it("routes wildwood rewards to wildwood victory", () => {
      const result = finalizeRewardState({
        rewardState: stampedRewardState({}, { enemyType: "normal", contentSystem: "wildwood" }),
        companionRewardCards: null,
      });

      expect(result.route).toBe("wildwood-victory");
    });
  });

  describe("getRandomPotionCard", () => {
    it("returns a standard potion from the shared pool", () => {
      const pool = getStandardPotionPool();
      const card = getRandomPotionCard(() => 0);
      expect(card.id).toBe(pool[0]?.id);
      expect(card.id).toMatch(/-potion$/);
      expect(card.id).not.toBe("mixed-potion");
    });

    it("uses injectable rng for stable selection", () => {
      const pool = getStandardPotionPool();
      const card = getRandomPotionCard(() => 0.99);
      expect(card.id).toBe(pool[pool.length - 1]?.id);
    });
  });

  describe("computeVictoryGold", () => {
    it("applies gold multiplier to earned gold only", () => {
      const result = computeVictoryGold({
        battleState: { currentEnemy: { enemyType: "normal" }, gold: 20 } as never,
        purseGold: 10,
        runBoons: [],
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
        goldMultiplier: 2,
      });
      expect(result.earnedBeforeMultiplier).toBe(25);
      expect(result.persistedGold).toBe(10 + Math.round(25 * 2));
    });
  });

  describe("executeRewardRouteTransition", () => {
    function makeHandlers() {
      return makeRewardRouteDeps();
    }

    it("routes companion rewards back to the rewards screen with the settle hook", () => {
      const handlers = makeHandlers();
      executeRewardRouteTransition("companion-reward", handlers);
      expect(handlers.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS, handlers.settleClaimSurface);
    });

    it("routes labyrinth map rewards to the labyrinth screen", () => {
      const handlers = makeHandlers();
      executeRewardRouteTransition("labyrinth-map", handlers);
      expect(handlers.labyrinthClearNode).toHaveBeenCalledOnce();
      expect(handlers.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.LABYRINTH_MAP, handlers.settleClaimSurface);
    });

    it("routes wildwood victory through completeRunVictory", () => {
      const handlers = makeHandlers();
      executeRewardRouteTransition("wildwood-victory", handlers);
      expect(handlers.completeRunVictory).toHaveBeenCalledWith(handlers.settleClaimSurface);
      expect(handlers.navigateTo).not.toHaveBeenCalled();
    });

    it("routes act completion without navigation, releasing only the claim", () => {
      const handlers = makeHandlers();
      executeRewardRouteTransition("act-complete", handlers);
      expect(handlers.handleActComplete).toHaveBeenCalledWith(handlers.releaseClaim);
      expect(handlers.settleClaimSurface).not.toHaveBeenCalled();
      expect(handlers.navigateTo).not.toHaveBeenCalled();
    });

    it("routes campaign rewards to destination", () => {
      const handlers = makeHandlers();
      executeRewardRouteTransition("destination", handlers);
      expect(handlers.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.DESTINATION, handlers.settleClaimSurface);
    });
  });
});
