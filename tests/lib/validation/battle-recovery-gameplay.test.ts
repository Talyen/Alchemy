import { describe, expect, it } from "vitest";
import { cardById, enemyById } from "@/lib/game-data";
import { battleSnapshot, canPlayCard } from "@/lib/battle";
import { chooseWishCard } from "@/lib/battle/wish";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { addEnemyStatus, addPlayerStatus } from "@/lib/battle/status-state";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { companionLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { advanceToPlayerTurn, reducePlayerSkipTurns } from "@/lib/battle/player-turn-transition";
import { applyWishEffect } from "@/lib/battle/wish";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { emptyInventory } from "@/lib/homestead/inventory";
import { regressionBattle } from "../../fixtures/battle";

function restore(patch: Record<string, unknown>) {
  return PersistedBattleStateSchema.parse({
    ...battleSnapshot(
      regressionBattle({
        currentEnemy: enemyById.skeleton,
        hand: [{ ...cardById.slash!, uid: 1, cost: 0 }],
        playerHealth: 30,
        playerMaxHealth: 30,
        enemyHealth: 100,
        enemyMaxHealth: 100,
      }),
    ),
    ...patch,
  });
}

const rng = () => 0.99;

describe("playing recovered battles", () => {
  it("repairs broken pending material balances before reward settlement", () => {
    const missing = restore({ pendingMaterials: null });
    const wished = applyWishEffect(
      { ...missing, rng, talentEffects: { ...missing.talentEffects, wishGemsGold: 2 } },
      undefined,
      1,
      [],
    );
    expect(wished.pendingMaterials).toEqual({ ...emptyInventory(), gems: 2 });
    const partial = restore({ pendingMaterials: { gems: 3, herbs: "broken", wood: -2 } });
    expect(partial.pendingMaterials).toEqual({ ...emptyInventory(), gems: 3 });
  });

  it("resumes multiple queued Returning Flight discounts and drops ambiguous references", () => {
    const state = restore({
      hand: [{ ...cardById["bounty-shot"]!, uid: 1, cost: 2 }],
      pendingHandCards: [{ ...cardById["bounty-shot"]!, uid: 2, cost: 2 }],
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { returningFlightUids: [1, 2, 2, 99] },
    });
    expect(state.uniqueGear.returningFlightUids).toEqual([1, 2]);
    const next = advanceToPlayerTurn({ ...state, rng });
    expect(next.uniqueGear.returningFlightUids).toEqual([1, 2]);
    const played = playBattleCardResolved({ ...next, rng, mana: 1 }, "bounty-shot", 0).state;
    expect(played.mana).toBe(0);
    expect(played.uniqueGear.returningFlightUids).toEqual([2]);
  });

  it("repairs crowd-control counters that cannot decrement", () => {
    const state = restore({ playerCC: { stunSkipTurns: 1e30, freezeSkipTurns: 0, cooldown: 0 } });
    expect(reducePlayerSkipTurns({ ...state, rng }).playerCC.stunSkipTurns).toBe(0);
    expect(canPlayCard(state, state.hand[0]!, 0)).toBe(true);
  });

  it("repairs a round counter that cannot advance", () => {
    const state = restore({ turn: 1e30 });
    expect(advanceToPlayerTurn({ ...state, rng }).turn).toBe(2);
  });

  it("repairs Health magnitudes that make ordinary attacks unable to change Health", () => {
    const state = restore({ enemyHealth: 1e30, enemyMaxHealth: 1e30 });
    const next = playBattleCardResolved({ ...state, rng }, "slash", 0).state;
    expect(next.enemyHealth).toBeLessThan(state.enemyHealth);
  });

  it("drops negative difficulty damage while preserving valid difficulty bonuses", () => {
    const state = restore({
      difficultyModifiers: [
        { kind: "enemy-damage-multiplier", amount: -1 },
        { kind: "increase-enemy-damage", amount: -100 },
        { kind: "increase-enemy-damage", amount: 2 },
      ],
    });
    expect(state.difficultyModifiers).toEqual([{ kind: "increase-enemy-damage", amount: 2 }]);
    const attacked = applyEnemyAbility({ ...state, rng }, cardById.slash!, []);
    expect(attacked.playerHealth).toBeLessThan(state.playerHealth);
  });

  it("repairs an Archery sequence counter that cannot count further card plays", () => {
    const state = restore({
      flags: { archeryCardsPlayedThisTurn: 1e30 },
      hand: [
        { ...cardById["fire-arrow"]!, uid: 1, cost: 0 },
        { ...cardById["fire-arrow"]!, uid: 2, cost: 0 },
      ],
    });
    const first = playBattleCardResolved({ ...state, rng }, "fire-arrow", 0).state;
    const second = playBattleCardResolved(first, "fire-arrow", 0).state;
    expect(second.flags.archeryCardsPlayedThisTurn).toBe(2);
    expect(second.flags.archerySecondCardActive).toBe(true);
  });

  it("skips damaged empty Wish offers and promotes the next surviving choice", () => {
    const state = restore({ wishOptions: [null], wishQueue: [[], [null], [cardById.block!]] });
    expect(state.wishOptions?.map((card) => card.id)).toEqual(["block"]);
    const chosen = chooseWishCard({ ...state, rng }, "block");
    expect(chosen.wishOptions).toBeNull();
    expect(chosen.wishQueue).toEqual([]);
    expect(canPlayCard(chosen, chosen.hand[0]!, 0)).toBe(true);
    const empty = restore({ wishOptions: [], wishQueue: [[]] });
    expect(canPlayCard(empty, empty.hand[0]!, 0)).toBe(true);
  });

  it("repairs combat magnitude fields before they enter attack arithmetic", () => {
    const state = restore({ enemyPhysicalDamageBonus: "broken", companionDamageBuff: "broken" });
    const hit = processEnemyDamageEffect({ ...state, rng }, { kind: "damage", damageType: "physical", amount: 2 }, []);
    expect(hit.playerHealth).toBe(28);
    const companion = processCompanionTurnStart({ ...state, rng, activeCompanion: companionLibrary.skeleton }, []);
    expect(companion.enemyHealth).toBe(99);
  });

  it("caps saved Bleed Leech to its own buildup before unrelated Bleed arrives", () => {
    const state = restore({
      playerHealth: 10,
      enemyHealth: 20,
      enemyStatuses: { bleed: 2 },
      playerStatuses: { bleed: 2 },
      pendingBleedLeechHealing: 20,
      pendingCardBleedLeechHealing: 20,
      pendingEnemyBleedLeechHealing: 20,
    });
    const added = addEnemyStatus({ ...state, rng }, "bleed", 4);
    const detonated = detonateEnemyStatuses(added, ["bleed"], []);
    expect(detonated.playerHealth).toBe(11);
    const enemyLeeched = tickPlayerStatuses(addPlayerStatus({ ...state, rng }, "bleed", 4), []);
    expect(enemyLeeched.enemyHealth).toBe(21);
  });

  it("repairs duplicate and missing instance IDs without changing valid card identities", () => {
    const state = restore({
      hand: [{ ...cardById.slash!, uid: 1 }, { ...cardById.slash!, uid: 1 }, cardById.block!],
      discard: [{ ...cardById.slash!, uid: 8 }],
      nextCardUid: 2,
      uniqueGear: { lastArcheryUid: 8, returningFlightUids: [1] },
    });
    const cards = [...state.hand, ...state.discard];
    expect(new Set(cards.map((card) => card.uid)).size).toBe(cards.length);
    expect(cards.every((card) => Number.isInteger(card.uid) && card.uid! >= 0)).toBe(true);
    expect(state.hand[0]!.uid).toBe(1);
    expect(state.discard[0]!.uid).toBe(8);
    expect(state.uniqueGear.lastArcheryUid).toBe(8);
    expect(state.uniqueGear.returningFlightUids).toEqual([]);
    expect(state.nextCardUid).toBeGreaterThan(Math.max(...cards.map((card) => card.uid!)));
  });

  it("restores active Death's Door to playable survival rather than a zero-Health limbo", () => {
    const state = restore({ playerHealth: 0, deathsDoorActive: true, deathsDoorUsed: false });
    expect(state.playerHealth).toBe(1);
    expect(state.deathsDoorUsed).toBe(true);
    const played = playBattleCardResolved({ ...state, rng }, "slash", 0).state;
    expect(played.enemyHealth).toBeLessThan(state.enemyHealth);
  });

  it.each([1e30, Number.MAX_SAFE_INTEGER])(
    "repairs an exhausted card ID counter %s without collisions",
    (nextCardUid) => {
      const state = restore({
        hand: [cardById.slash!, cardById.block!, { ...cardById.slash!, uid: Number.MAX_SAFE_INTEGER }],
        discard: [{ ...cardById.block!, uid: 8 }],
        nextCardUid,
      });
      const ids = [...state.hand, ...state.discard].map((card) => card.uid!);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every(Number.isSafeInteger)).toBe(true);
      expect(Number.isSafeInteger(state.nextCardUid + 1)).toBe(true);
      expect(state.nextCardUid).toBeGreaterThan(Math.max(...ids));
    },
  );
});
