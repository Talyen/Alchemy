import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import {
  findBestPlayableHandCard,
  findBestWishChoice,
  getPlayableHandCardKeys,
  handHasPlayableCard,
  handHasHiddenCard,
} from "@/features/alchemy/run-loop/battle/playable-hand";
import { makeTestBattleState, type BattleStatePatch } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/cards";
import { cardById, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

const attack = (id: string, amount: number, cost = 1) =>
  makeTestCard({ id, cost, effects: [{ kind: "damage", damageType: "physical", amount }] });
const weak = attack("weak", 2);
const strong = attack("strong", 9);
const guard = makeTestCard({ id: "guard", effects: [{ kind: "player-status", status: "block", amount: 5 }] });
function battle(hand: BattleCard[], patch: BattleStatePatch = {}) {
  return makeTestBattleState({
    hand,
    mana: 3,
    maxMana: 3,
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 30,
    ...patch,
  });
}

it("uses live eligibility for hand keys, Wish gates, victory grace, and repeated copies", () => {
  const slash = { ...weak, uid: 1 };
  const cleanse = makeTestCard({ id: "cleanse", effects: [{ kind: "remove-harmful-status", amount: 1 }] });
  const state = battle([slash, attack("pricey", 20, 9), cleanse, cleanse]);
  expect(getPlayableHandCardKeys(state)).toEqual(new Set(["weak-1"]));
  const afflicted = { ...state, playerStatuses: { ...state.playerStatuses, burn: 1 } };
  expect(getPlayableHandCardKeys(afflicted)).toEqual(new Set(["weak-1", "cleanse-no-uid-2", "cleanse-no-uid-3"]));
  expect(handHasHiddenCard(afflicted, ["cleanse-no-uid-3"])).toBe(true);
  expect(handHasHiddenCard({ hand: [slash] }, ["cleanse-no-uid-3"])).toBe(false);
  expect(getPlayableHandCardKeys({ ...afflicted, wishOptions: [slash] })).toEqual(new Set());
  expect(getPlayableHandCardKeys({ ...afflicted, playerHealth: 0 })).toEqual(new Set());
  expect(handHasPlayableCard({ ...state, enemyHealth: 0 })).toBe(true);
  expect(handHasPlayableCard({ ...state, enemyHealth: 0 }, { allowAfterEnemyDefeat: false })).toBe(false);
});

describe("autoplay selection", () => {
  it.each([
    { name: "affordability", hand: [attack("pricey", 20, 9), weak], patch: { mana: 1 }, chosen: weak.id },
    { name: "damage at full Health", hand: [guard, strong], patch: {}, chosen: strong.id },
    { name: "defense at half Health", hand: [strong, guard], patch: { playerHealth: 50 }, chosen: guard.id },
    { name: "damage when defense is absent", hand: [weak, strong], patch: { playerHealth: 50 }, chosen: strong.id },
    { name: "capped healing", hand: [cardById["health-potion"]!, weak], patch: { playerHealth: 99 }, chosen: weak.id },
    { name: "unneeded cleanse", hand: [cardById.cauterize!, strong], patch: { playerHealth: 50 }, chosen: strong.id },
    { name: "full Mana", hand: [{ ...cardById["mana-potion"]!, cost: 0 }, weak], patch: {}, chosen: weak.id },
    { name: "no affordable card", hand: [strong], patch: { mana: 0 }, chosen: undefined },
  ])("respects $name", ({ hand, patch, chosen }) => {
    expect(findBestPlayableHandCard(battle(hand, patch))?.card.id).toBe(chosen);
  });

  it("scores Freeze attacks after Winter's Credit spends Block", () => {
    const freeze = makeTestCard({
      id: "freeze",
      cost: 2,
      effects: [{ kind: "damage", damageType: "freeze", amount: 0, equalToBlock: true }],
    });
    const state = battle([freeze, { ...weak, cost: 0 }], {
      mana: 0,
      playerStatuses: { block: 6 },
      gearEffects: { blockPaysFreezeMana: 1 },
    });
    const played = playBattleCardResolved(state, freeze.id, 0).state;
    expect(played.playerStatuses.block).toBe(0);
    expect(played.enemyHealth).toBe(state.enemyHealth);
    expect(findBestPlayableHandCard(state)?.card.id).toBe(weak.id);
    expect(state.playerStatuses.block).toBe(6);
  });

  it.each(["mana-shield", "crystal-bulwark"])("recognizes %s as Crystal-based defense", (id) => {
    const resourceGuard = cardById[id]!;
    const state = battle([strong, guard, resourceGuard], { playerHealth: 10, mana: 4, maxMana: 8 });
    expect(findBestPlayableHandCard(state)?.card).toBe(resourceGuard);
  });

  it("retains Crystal-based defense with no Mana and recognizes nested Luck Potion defense", () => {
    const shield = cardById["mana-shield"]!;
    const state = battle([shield, strong], { playerHealth: 10, mana: 0, flags: { nextCardCostReduction: 99 } });
    expect(playBattleCardResolved(state, shield.id, 0).state.playerStatuses.block).toBe(6);
    expect(findBestPlayableHandCard(state)?.card).toBe(shield);
    expect(findBestPlayableHandCard(battle([strong, cardById["luck-potion"]!], { playerHealth: 10 }))?.card.id).toBe(
      "luck-potion",
    );
  });

  it.each(["blood-offering", "exorcism", "dark-pact"])("leaves potentially lethal %s costs to manual play", (id) => {
    const card = cardById[id]!;
    const state = battle([card, weak], { playerHealth: 1, deathsDoorUsed: true });
    expect(findBestPlayableHandCard(state)?.card).toBe(weak);
    expect(findBestPlayableHandCard({ ...state, hand: [card] })).toBeNull();
    expect(findBestPlayableHandCard({ ...state, hand: [card], deathsDoorUsed: false })?.card).toBe(card);
  });

  it("ignores impossible lethal branches but rejects real risk", () => {
    for (const probability of [0, 1]) {
      const lethal: BattleCardEffect[] = [{ kind: "lose-health", amount: 2 }];
      const safe = strong.effects;
      const effect: BattleCardEffect = {
        kind: "chance",
        probability,
        successEffects: probability === 0 ? lethal : safe,
        failureEffects: probability === 0 ? safe : lethal,
      };
      const card = makeTestCard({ effects: [effect] });
      const state = battle([card], { playerHealth: 2, deathsDoorUsed: true });
      expect(playBattleCardResolved(state, card.id, 0).state.playerHealth).toBe(2);
      expect(findBestPlayableHandCard(state)?.card).toBe(card);
      expect(
        findBestPlayableHandCard({ ...state, hand: [{ ...card, effects: [{ ...effect, probability: 0.5 }] }] }),
      ).toBeNull();
    }
  });

  it("rejects a repeated cost that becomes lethal after Death's Door was spent", () => {
    const card = cardById["blood-offering"]!;
    const state = battle([card], { playerHealth: 2, deathsDoorUsed: true, flags: { playNextCardTwice: true } });
    expect(playBattleCardResolved(state, card.id, 0).state.playerHealth).toBe(0);
    expect(findBestPlayableHandCard(state)).toBeNull();
  });

  it.each([false, true])(
    "spends Feather once across multiple costs with Death's Door active=%s",
    (deathsDoorActive) => {
      const cost: BattleCardEffect = { kind: "lose-health", amount: 10 };
      for (const repeat of [false, true]) {
        const card = makeTestCard({ effects: repeat ? [cost] : [cost, cost] });
        const state = battle([card], {
          playerHealth: 1,
          playerMaxHealth: 30,
          deathsDoorUsed: true,
          deathsDoorActive,
          playerStatuses: { phoenixFeather: 1 },
          flags: { playNextCardTwice: repeat },
        });
        expect(playBattleCardResolved(state, card.id, 0).state.playerHealth).toBe(0);
        expect(findBestPlayableHandCard(state)).toBeNull();
        expect(handHasPlayableCard(state)).toBe(true);
        if (repeat)
          expect(
            findBestPlayableHandCard({ ...state, flags: { ...state.flags, playNextCardTwice: false } })?.card,
          ).toBe(card);
      }
    },
  );
});

it("prefers safe Wishes, preserves offer-order ties, and can choose when every offer is risky", () => {
  const risky = cardById["dark-pact"]!;
  const state = battle([], { playerHealth: 1, deathsDoorUsed: true, wishOptions: [risky, weak, { ...weak }] });
  expect(findBestWishChoice(state)).toBe(weak);
  expect(findBestWishChoice({ ...state, wishOptions: [weak, strong] })).toBe(strong);
  expect(findBestWishChoice({ ...state, wishOptions: [risky] })).toBe(risky);
  expect(findBestWishChoice({ ...state, wishOptions: [] })).toBeNull();
  expect(findBestWishChoice({ ...state, wishOptions: null })).toBeNull();
});
