import { describe, expect, it } from "vitest";
import { selectSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { defaultBattleState } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { cardById } from "@/lib/game-data";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { createRunRngState, createRunStateRng, createRunStreamRng } from "@/lib/rng";
import { ActiveRunDataSchema, parseActiveRun, SaveDataSchema } from "@/lib/validation";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { saveEnvelopeFixture } from "../../fixtures/saves";

function battle(patch: Record<string, unknown> = {}) {
  return { ...defaultBattleState(), hand: [{ ...cardById.slash!, uid: 1 }], ...patch };
}

function battleSave(patch: Record<string, unknown> = {}) {
  return saveEnvelopeFixture({
    gold: 77,
    activeRun: makeMinimalActiveRunInput({ activity: { kind: "battle", data: { battleState: battle(patch) } } }),
  });
}

describe("progress recovery regressions", () => {
  it("does not let an unsafe timestamp replace a newer playable save", () => {
    const fresh = saveEnvelopeFixture({ lastSavedAt: 20, gold: 80 });
    const damaged = saveEnvelopeFixture({ lastSavedAt: Number.MAX_VALUE, gold: 5 });
    const { state } = selectSaveCandidates([JSON.stringify(fresh), JSON.stringify(damaged)]);
    expect(state.data.gold).toBe(80);
    expect(state.data.lastSavedAt).toBe(20);
  });

  it("retains valid keyword XP and destination history when a sibling value exceeds the integer range", () => {
    const save = SaveDataSchema.parse(saveEnvelopeFixture({ talentXP: { physical: 18, holy: Number.MAX_VALUE } }));
    expect(save.talentXP).toEqual({ physical: 18 });
    const restored = ActiveRunDataSchema.safeParse(
      makeMinimalActiveRunInput({
        destinationRoundsSinceOffered: { Campfire: 3, Mystery: Number.MAX_VALUE },
      }),
    );
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.destinationRoundsSinceOffered).toEqual({ Campfire: 3 });
  });

  it("repairs card presentation metadata without removing the playable card", () => {
    const restored = PersistedBattleStateSchema.parse(
      battle({
        mana: 1,
        hand: [{ ...cardById.slash!, uid: "broken", title: null, art: null }],
      }),
    );
    expect(restored.hand).toHaveLength(1);
    const card = hydrateCard(restored.hand[0]!);
    const next = playBattleCardResolved({ ...restored, hand: [card], rng: () => 0.99 }, "slash", 0).state;
    expect(card.title).toBe(cardById.slash!.title);
    expect(card.art).toBe(cardById.slash!.art);
    expect(next.enemyHealth).toBeLessThan(restored.enemyHealth);
  });

  it("preserves purse Gold when battle Gold needs repair, while honoring a real empty purse", () => {
    for (const [raw, expected] of [
      ["broken", 77],
      [undefined, 77],
      [Number.MAX_VALUE, 77],
      [0, 0],
      [3.75, 3],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ] as const) {
      const restored = SaveDataSchema.parse(battleSave({ gold: raw }));
      expect(restored.gold).toBe(expected);
      expect(restored.activeRun?.activity).toMatchObject({
        kind: "battle",
        data: { battleState: { gold: expected } },
      });
      expect(SaveDataSchema.parse(restored).gold).toBe(expected);
    }
    expect(SaveDataSchema.parse(battleSave({ gold: 0, currentEnemy: { id: "missing-enemy" } })).gold).toBe(77);
  });

  it("settles a nonterminal enemy-phase save instead of resuming with all input locked", () => {
    const selected = selectSaveCandidates([JSON.stringify(battleSave({ turnPhase: "enemy" }))]).state;
    expect(selected.data.activeRun).not.toBeNull();
    expect(selected.restoreActions).toEqual(["abandon-active-run"]);
    const terminal = selectSaveCandidates([JSON.stringify(battleSave({ turnPhase: "enemy", enemyHealth: 0 }))]).state;
    expect(terminal.restoreActions).toBeUndefined();
  });

  it("drops an impossible scheduled duration instead of repeating its damage indefinitely", () => {
    const restored = PersistedBattleStateSchema.parse(
      battle({
        pendingTurnStartEffects: [
          { remainingTurns: 1e12, effects: [{ kind: "damage", damageType: "holy", amount: 2 }] },
        ],
      }),
    );
    const next = advanceToPlayerTurn({ ...restored, rng: () => 0.99 });
    expect(next.pendingTurnStartEffects).toEqual([]);
    expect(next.enemyHealth).toBe(restored.enemyHealth);
  });

  it("repairs unspendable crafting currency without resetting other currencies", () => {
    const save = SaveDataSchema.parse(
      saveEnvelopeFixture({
        craftingCurrencies: {
          "discordant-dice": Number.MAX_VALUE,
          "sprig-of-growth": 3,
        },
      }),
    );
    expect(save.craftingCurrencies["discordant-dice"]).toBe(0);
    expect(save.craftingCurrencies["sprig-of-growth"]).toBe(3);
  });

  it("rebuilds an unusable Campfire Potion offer once and preserves it on the next load", () => {
    const restored = parseActiveRun(
      makeMinimalActiveRunInput({
        activity: {
          kind: "campfire",
          data: {
            offers: [],
            result: null,
            original: null,
            completed: false,
          },
        },
      }),
    )!;
    expect(restored.activity.kind).toBe("campfire");
    if (restored.activity.kind !== "campfire") throw new Error("Expected Campfire");
    expect(restored.activity.data.offers).toHaveLength(3);
    expect(
      restored.activity.data.offers.every((card) => getStandardPotionPool().some((entry) => entry.id === card.id)),
    ).toBe(true);
    const again = parseActiveRun(restored)!;
    expect(again.activity).toEqual(restored.activity);
    expect(again.rng).toEqual(restored.rng);
  });

  it("clears a stale pending room when resuming the Labyrinth map", () => {
    const map = gridLabyrinthMapFixture();
    const restored = parseActiveRun(
      makeMinimalActiveRunInput({
        contentSystemType: "labyrinth",
        labyrinthMap: map,
        labyrinthPendingNode: "missing-room",
        activity: { kind: "labyrinth-map" },
      }),
    )!;
    expect(restored.labyrinthMap).toEqual(map);
    expect(restored.labyrinthPendingNode).toBeNull();
  });

  it("keeps the persisted and standalone RNG advancing at the safe counter boundary", () => {
    const state = createRunRngState(7);
    state.counters.world = Number.MAX_SAFE_INTEGER;
    const rng = createRunStateRng(state, "world");
    const standalone = createRunStreamRng(7, "world", Number.MAX_SAFE_INTEGER);
    const draws = [rng(), rng(), rng()];
    expect(new Set(draws).size).toBe(3);
    expect([standalone(), standalone(), standalone()]).toEqual(draws);
    const resumed = createRunStateRng(JSON.parse(JSON.stringify(state)), "world");
    expect(resumed()).toBe(rng());
  });
});
