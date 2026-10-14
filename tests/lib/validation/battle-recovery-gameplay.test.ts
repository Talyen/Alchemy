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
      uniqueGear: { lastArcheryUid: 8, returningFlightUid: 1 },
    });
    const cards = [...state.hand, ...state.discard];
    expect(new Set(cards.map((card) => card.uid)).size).toBe(cards.length);
    expect(cards.every((card) => Number.isInteger(card.uid) && card.uid! >= 0)).toBe(true);
    expect(state.hand[0]!.uid).toBe(1);
    expect(state.discard[0]!.uid).toBe(8);
    expect(state.uniqueGear.lastArcheryUid).toBe(8);
    expect(state.uniqueGear.returningFlightUid).toBeNull();
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
