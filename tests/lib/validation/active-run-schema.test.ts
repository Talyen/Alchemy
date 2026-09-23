import { describe, it, expect } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { enemyById } from "@/lib/game-data";
import { GEAR_EFFECT_KEYS } from "@/lib/gear";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

describe("ActiveRunDataSchema persisted session payloads", () => {
  const run = (overrides: Record<string, unknown> = {}) =>
    makeMinimalActiveRunInput({ runGold: 0, selectedDifficulty: null, labyrinthMap: null, ...overrides });

  it("parses a valid run", () => {
    const result = ActiveRunDataSchema.safeParse(run());
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual([]);
    }
  });

  it("preserves valid destination offer history when one saved counter is invalid", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({ destinationRoundsSinceOffered: { Campfire: 3, Mystery: "broken" } }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destinationRoundsSinceOffered).toEqual({ Campfire: 3 });
  });

  it("keeps valid run cards when one saved card is malformed", () => {
    const result = ActiveRunDataSchema.safeParse(run({ runDeck: [{ id: "slash" }, { id: 42 }, { id: "block" }] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.runDeck.map((card) => card.id)).toEqual(["slash", "block"]);
  });

  it("still rejects a run without a deck array", () => {
    expect(ActiveRunDataSchema.safeParse(run({ runDeck: "broken" })).success).toBe(false);
  });

  it("parses destination resume fields", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        currentScreen: "rewards",
        interruptedFlow: {
          kind: "destination",
          destinations: ["Campfire"],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBe("rewards");
      expect(result.data.interruptedFlow).toEqual({
        kind: "destination",
        destinations: ["Campfire"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      });
    }
  });

  it("rejects invalid resume screens", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({ currentScreen: "not-a-screen", interruptedFlow: { kind: "none" } }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentScreen).toBeNull();
    }
  });

  it("normalizes encountered run enemy IDs", () => {
    const result = ActiveRunDataSchema.safeParse(run({ encounteredRunEnemyIds: ["goblin", "goblin", 1] }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual(["goblin"]);
    }
  });

  it("merges partial legacy gearEffects with defaults on mid-combat hydrate", () => {
    const defaults = defaultBattleState();
    const legacyGearEffects = {
      flatPhysicalDamage: 4,
      flatStunDamage: 2,
    };
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: {
            ...defaults,
            gearEffects: legacyGearEffects,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    const gearEffects = result.data.activeCombat!.battleState.gearEffects;
    expect(gearEffects.flatPhysicalDamage).toBe(4);
    expect(gearEffects.flatStunDamage).toBe(2);
    for (const key of GEAR_EFFECT_KEYS) {
      if (key === "flatPhysicalDamage" || key === "flatStunDamage") continue;
      expect(gearEffects[key]).toBe(0);
    }
  });

  it("defaults missing battle transition metadata and accepts resumable enemy turns", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: { ...defaults, turnPhase: "enemy", hand: [] },
          pendingBattleTransition: {
            kind: "enemy-turn",
            resultState: defaults,
            playerTurnSkipped: false,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition?.kind).toBe("enemy-turn");
  });

  it("accepts legacy-enemy-turn pending transition markers", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: { ...defaults, turnPhase: "enemy", hand: [] },
          pendingBattleTransition: { kind: "legacy-enemy-turn" },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition).toEqual({ kind: "legacy-enemy-turn" });
  });

  it("accepts a resumable opening draw transition", () => {
    const defaults = defaultBattleState();
    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: { ...defaults, hand: [] },
          pendingBattleTransition: {
            kind: "opening-draw",
            resultState: defaults,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.activeCombat?.pendingBattleTransition?.kind).toBe("opening-draw");
  });

  it("retains a pending battle result when one saved card is malformed", () => {
    const battleState = defaultBattleState();
    const result = ActiveRunDataSchema.parse(
      run({
        activeCombat: {
          battleState,
          pendingBattleTransition: {
            kind: "opening-draw",
            resultState: { ...battleState, hand: [{ id: "slash" }, null, { id: "block" }] },
          },
        },
      }),
    );
    const transition = result.activeCombat?.pendingBattleTransition;
    expect(transition?.kind).toBe("opening-draw");
    if (transition?.kind === "opening-draw") {
      expect(transition.resultState.hand.map((card) => card.id)).toEqual(["slash", "block"]);
    }
  });

  it("normalizes enemy-turn resultState manifests and Traits without replaying resolved outcomes", () => {
    const defaults = {
      ...defaultBattleState(),
      currentEnemy: {
        ...enemyById.goblin,
        traits: [
          { id: "trinket-hoarder", title: "Trinket Hoarder", description: "Receives 30% more Burn damage" },
          { id: "combustible", title: "Combustible", description: "Enemy deals 1 Burn damage each turn" },
        ],
      },
      enemyMitigation: { block: 1, armor: 0, forge: 0 },
      lastEnemyAbilityId: "stab",
    };
    const strippedResultState = JSON.parse(
      JSON.stringify({
        ...defaults,
        turn: 3,
        playerHealth: 20,
        gearEffects: { flatPhysicalDamage: 2 },
        flags: { divineAegisTriggered: true },
      }),
    );
    const strippedBattleState = JSON.parse(JSON.stringify({ ...defaults, turnPhase: "enemy", hand: [], turn: 2 }));

    const result = ActiveRunDataSchema.safeParse(
      run({
        roomsEncountered: 1,
        activeCombat: {
          battleState: strippedBattleState,
          pendingBattleTransition: {
            kind: "enemy-turn",
            resultState: strippedResultState,
            playerTurnSkipped: false,
          },
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      }),
    );

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;

    const transition = result.data.activeCombat?.pendingBattleTransition;
    expect(transition?.kind).toBe("enemy-turn");
    if (transition?.kind !== "enemy-turn") return;

    for (const state of [result.data.activeCombat!.battleState, transition.resultState]) {
      expect(state.currentEnemy.traits.map((trait) => trait.title)).toEqual(["Scavenged Shield", "Scorching"]);
      expect(state.enemyMitigation.block).toBe(1);
      expect(state.lastEnemyAbilityId).toBe("stab");
    }
    expect(transition.resultState.turn).toBe(3);
    expect(transition.resultState.playerHealth).toBe(20);
    expect(transition.resultState.gearEffects.flatPhysicalDamage).toBe(2);
    expect(transition.resultState.gearEffects.flatStunDamage).toBe(0);
    expect(transition.resultState.flags.divineAegisTriggered).toBe(true);
    expect(transition.resultState.flags.firstHolyCardFreeUsed).toBe(false);
  });

  it("preserves run deck array for unstarted run", () => {
    const legacyDeck = [
      {
        id: "slash",
        title: "Slash",
        descriptionLines: [],
        art: "",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      },
    ];
    const result = ActiveRunDataSchema.safeParse(run({ runDeck: legacyDeck }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runDeck.length).toBe(1);
    }
  });

  it("parses persisted shop slices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        runGold: 50,
        roomsEncountered: 2,
        destinationIndexInAct: 1,
        currentScreen: "trinket-shop",
        trinketShopState: {
          trinketIds: ["lucky-clover"],
          refreshesLeft: 2,
          firstPurchaseUsed: true,
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.trinketShopState?.trinketIds).toEqual(["lucky-clover"]);
      expect(result.data.trinketShopState?.refreshesLeft).toBe(2);
    }
  });

  it("defaults companion reward ids for legacy pending rewards", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
            rewardType: "card",
            choiceIds: ["slash"],
            selectedId: null,
            gold: 0,
            materials: { wood: 0, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 },
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: null,
            lastVictoryContentSystem: null,
          },
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success && result.data.interruptedFlow.kind === "primary-reward") {
      expect(result.data.interruptedFlow.pending.companionChoiceIds).toEqual([]);
    }
  });

  it("rejects pending gear rewards with no valid choices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
            rewardType: "gear",
            gearChoices: [],
            selectedId: null,
            gold: 0,
            materials: { wood: 0, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 },
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: null,
            lastVictoryContentSystem: null,
          },
        },
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interruptedFlow).toEqual({ kind: "none" });
    }
  });

  it("keeps Wildwood rewards on interruptedFlow without nested draft reward fields", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        contentSystemType: "wildwood",
        currentScreen: "rewards",
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
            rewardType: "card",
            choiceIds: ["slash", "bash", "block"],
            companionChoiceIds: [],
            selectedId: null,
            gold: 0,
            materials: {},
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: "boss",
            lastVictoryContentSystem: "wildwood",
          },
        },
        wildwoodDraft: {
          phase: "reward",
          draftChoices: [],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.wildwoodDraft).toMatchObject({ phase: "reward" });
    expect(result.data.wildwoodDraft).not.toHaveProperty("rewardType");
    expect(result.data.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({ rewardType: "card", choiceIds: ["slash", "bash", "block"] }),
      }),
    );
  });
});
