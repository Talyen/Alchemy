import { describe, expect, it, vi } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { cardById, companionLibrary, computeTalentEffects, describeCardEffects } from "@/lib/game-data";
import {
  makeState as makeSharedState,
  makeTestCard,
  patchBattleState,
  slashDeck,
  type BattleStatePatch,
} from "../../fixtures/battle";

function makeState(overrides: BattleStatePatch = {}) {
  return makeSharedState({ mana: 5, maxMana: 5, ...overrides });
}

it.each<[string, BattleStatePatch]>([
  ["insufficient Mana", { mana: 0 }],
  ["enemy turn", { turnPhase: "enemy" }],
  ["pending Wish", { wishOptions: [makeTestCard()] }],
  ["Stun", { playerCC: { stunSkipTurns: 1 } }],
  ["Freeze", { playerCC: { freezeSkipTurns: 1 } }],
  ["victory", { enemyHealth: 0 }],
  ["defeat", { playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false }],
])("rejects play during %s without spending or publishing feedback", (_reason, patch) => {
  const card = makeTestCard({ cost: 1 });
  const state = makeState({ ...patch, hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(false);
  const result = playBattleCardResolved(state, card.id, 0);
  expect(result.state).toBe(state);
  expect(result.combatTexts).toEqual([]);
});

it("requires the offered hand position, card ID, and UID to match", () => {
  const card = makeTestCard({ id: "strike", uid: 1 });
  const state = makeState({ hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(true);
  expect(canPlayCard(state, card, 1)).toBe(false);
  expect(canPlayCard(state, { ...card, id: "other" }, 0)).toBe(false);
  expect(canPlayCard(state, { ...card, uid: 2 }, 0)).toBe(false);
});

it.each([
  { cost: 2, mana: 5, remaining: 3 },
  { cost: 0, mana: 0, remaining: 0 },
])("pays $cost Mana once and moves the played card to discard", ({ cost, mana, remaining }) => {
  const card = makeTestCard({
    id: "slash",
    corrupted: true,
    cost,
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  });
  const state = makeState({ hand: [card], mana, rng: () => 0.99 });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.mana).toBe(remaining);
  expect(result.hand).toEqual([]);
  expect(result.discard).toEqual([card]);
  expect(result.enemyHealth).toBe(24);
  expect(state.hand).toEqual([card]);
  expect(state.mana).toBe(mana);
});

it("pays before a capped Mana refund and applies crystal gains to both Mana values", () => {
  for (const [effect, mana, maxMana] of [
    [{ kind: "restore-mana", amount: 2 }, 4, 4],
    [{ kind: "gain-max-mana", amount: 1 }, 4, 5],
  ] as const) {
    const card = makeTestCard({ cost: 1, effects: [effect] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    expect(playBattleCardResolved(state, card.id, 0).state).toMatchObject({ mana, maxMana });
  }
});

it("converts pre-payment Mana when a conversion card is discounted", () => {
  const card = makeTestCard({
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 }],
  });
  const state = makeState({ mana: 3, hand: [card], flags: { nextCardCostReduction: 1 } });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.mana).toBe(0);
  expect(result.playerStatuses.block).toBe(15);
});

it("keeps next-hit Poison through a failed chance and spends it on only the first actual packet", () => {
  const uncertain = makeTestCard({
    id: "uncertain",
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
        failureEffects: [{ kind: "heal", amount: 1 }],
      },
    ],
  });
  const attack = makeTestCard({
    id: "two-hits",
    effects: [
      { kind: "damage", damageType: "physical", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 2 },
    ],
  });
  const state = makeState({ hand: [uncertain, attack], rng: () => 0.99, flags: { nextHitPoison: true } });
  const missed = playBattleCardResolved(state, uncertain.id, 0).state;
  expect(missed.flags.nextHitPoison).toBe(true);
  const result = playBattleCardResolved(missed, attack.id, 0);
  expect(result.state.enemyStatuses.poison).toBe(2);
  expect(result.state.flags.nextHitPoison).toBe(false);
  expect(result.combatTexts.filter((text) => text.kind === "damage").map((text) => text.stat)).toEqual([
    "poison",
    "physical",
  ]);
});

it("awards Consume rewards only to consumables while summons replace the Companion and leave the battle", () => {
  const potion = makeTestCard({ id: "apple", consume: true, effects: [{ kind: "heal", amount: 2 }] });
  const summon = cardById["wolf-companion"]!;
  const patch: BattleStatePatch = {
    playerHealth: 10,
    playerMaxHealth: 30,
    rng: () => 0.99,
    activeCompanion: companionLibrary.bear,
    deck: [makeTestCard({ id: "drawn" })],
    talentEffects: {
      healOnConsume: 1,
      goldOnConsume: 1,
      goldOnConsumeChance: 100,
      drawOnConsume: 1,
      drawOnConsumeChance: 100,
    },
  };
  const consumed = playBattleCardResolved(makeState({ ...patch, hand: [potion] }), potion.id, 0).state;
  expect(consumed).toMatchObject({ gold: 1, playerHealth: 13, exhausted: [potion] });
  expect(consumed.hand.map((card) => card.id)).toEqual(["drawn"]);
  const summoned = playBattleCardResolved(makeState({ ...patch, hand: [summon] }), summon.id, 0).state;
  expect(summoned).toMatchObject({
    gold: 0,
    playerHealth: 10,
    activeCompanion: companionLibrary.wolf,
    exhausted: [summon],
    hand: [],
  });
  expect(summoned.deck.map((card) => card.id)).toEqual(["drawn"]);
});

it("holds Resonant Chime at full Mana and grants it only once after Mana is spent", () => {
  const card = makeTestCard({ cost: 0, effects: [] });
  const state = makeState({
    mana: 3,
    maxMana: 3,
    hand: [card],
    cardsPlayedThisTurn: 2,
    trinketEffects: { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
  });
  const full = playBattleCardResolved(state, card.id, 0).state;
  expect(full.mana).toBe(3);
  expect(full.flags.resonantChimeUsedThisTurn).toBe(false);
  const restored = playBattleCardResolved({ ...full, mana: 1, hand: [card, card] }, card.id, 0).state;
  expect(restored.mana).toBe(2);
  expect(restored.flags.resonantChimeUsedThisTurn).toBe(true);
  expect(playBattleCardResolved(restored, card.id, 0).state.mana).toBe(2);
});

it("permits explicit victory-grace plays and still pays and discards", () => {
  const card = makeTestCard({ cost: 1 });
  const result = playBattleCardResolved(makeState({ enemyHealth: 0, hand: [card], mana: 3 }), card.id, 0, {
    allowAfterEnemyDefeat: true,
  }).state;
  expect(result).toMatchObject({ hand: [], discard: [card], mana: 2 });
});

it("Hawk Eye crits the next packet when the first packet of a card Freezes", () => {
  const card = makeTestCard({
    effects: [
      { kind: "damage", damageType: "freeze", amount: 30 },
      { kind: "damage", damageType: "physical", amount: 4 },
    ],
  });
  const state = patchBattleState({
    hand: [card],
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyStatuses: { freeze: 25 },
    talentEffects: { archeryCritOnCrowdControl: true },
    rng: () => 0.99,
  });
  const next = playBattleCardResolved(state, card.id, 0).state;
  expect(next.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
  expect(next.enemyHealth).toBe(54); // Freeze 30, Critical Physical 8, Shatter 8.
  expect(next.reactions).toMatchObject({ shatterDamage: 0, frostfireDamage: 8 });
  expect(next.flags.hawkEyeReady).toBe(false);
});

it("a repeated Mana conversion cannot spend the same Mana twice", () => {
  const card = makeTestCard({
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 }],
  });
  const state = patchBattleState({ hand: [card], mana: 3, flags: { playNextCardTwice: true }, rng: () => 0.99 });
  const next = playBattleCardResolved(state, card.id, 0).state;
  expect(next.mana).toBe(0);
  expect(next.playerStatuses.block).toBe(9);
});

it("Hawk Eye stays armed through full mitigation and is spent on the next damaging packet", () => {
  const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
  const state = patchBattleState({
    hand: [card],
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyMitigation: { block: 8 },
    flags: { hawkEyeReady: true },
    talentEffects: { archeryCritOnCrowdControl: true },
    rng: () => 0.99,
  });
  const blocked = playBattleCardResolved(state, card.id, 0).state;
  expect(blocked.enemyHealth).toBe(100);
  expect(blocked.flags.hawkEyeReady).toBe(true);
  const hit = playBattleCardResolved({ ...blocked, hand: [card] }, card.id, 0).state;
  expect(hit.enemyHealth).toBe(92);
  expect(hit.flags.hawkEyeReady).toBe(false);
});

it("Distillation does not boost a Potion whose Consume was removed", () => {
  const card = { ...cardById["health-potion"]!, consume: false };
  const state = patchBattleState({
    hand: [card],
    playerHealth: 5,
    playerMaxHealth: 30,
    talentEffects: { potionPotency: 1.1 },
    rng: () => 0.99,
  });
  const next = playBattleCardResolved(state, card.id, 0).state;
  expect(next.playerHealth).toBe(13);
  expect(next.discard).toHaveLength(1);
});

it("rejects an ineffective cleanse without spending, but allows a mixed-purpose cleanse", () => {
  const card = makeTestCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
  const state = makeState({ hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(false);
  expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
  const healing = { ...card, effects: [...card.effects, { kind: "heal", amount: 4 } as const] };
  const result = playBattleCardResolved(makeState({ hand: [healing], playerHealth: 20 }), healing.id, 0).state;
  expect(result.playerHealth).toBe(24);
  expect(result.hand).toEqual([]);
});

it("a weakened zero-Cleanse card cannot spend Mana against a harmful status", () => {
  const card = makeTestCard({ cost: 1, effects: [{ kind: "remove-harmful-status", amount: 0 }] });
  const rng = vi.fn(() => 0.99);
  const state = patchBattleState({ hand: [card], playerStatuses: { poison: 2 }, rng });
  expect(canPlayCard(state, card, 0)).toBe(false);
  expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
  expect(rng).not.toHaveBeenCalled();
});

describe("reusable evasion", () => {
  it("Feint returns through the draw cycle and evades one attack per play without Consume rewards", () => {
    const card = cardById.feint!;
    let state = makeState({
      hand: [card],
      deck: slashDeck(2),
      rng: () => 0.99,
      talentEffects: { forgeOnConsume: 3, forgeOnConsumeChance: 100 },
    });
    for (let play = 0; play < 2; play += 1) {
      const index = state.hand.findIndex((entry) => entry.id === card.id);
      const before = state;
      state = playBattleCardResolved(state, card.id, index).state;
      expect(state.mana).toBe(before.mana - 1);
      expect(state.hand.map((entry) => entry.id).sort()).toEqual(["slash-0", "slash-1"]);
      expect(state.discard).toContainEqual(expect.objectContaining({ id: "feint" }));
      expect(state.exhausted).not.toContainEqual(expect.objectContaining({ id: "feint" }));
      expect(state.playerStatuses.forge).toBe(0);
      const dodged = applyEnemyAbility(state, cardById.slash!, []);
      expect(dodged.playerHealth).toBe(state.playerHealth);
      expect(dodged.flags.dodgeNextAttack).toBe(false);
      const hit = applyEnemyAbility(dodged, cardById.slash!, []);
      expect(hit.playerHealth).toBeLessThan(dodged.playerHealth);
      state = advanceToPlayerTurn(hit);
    }
  });

  it("Shadowstep doubles Feint's draw without stacking evasion", () => {
    const shadowstep = cardById.shadowstep!;
    const feint = cardById.feint!;
    const initial = makeState({ hand: [shadowstep, feint], deck: slashDeck(4) });
    const shadowed = playBattleCardResolved(initial, shadowstep.id, 0).state;
    expect(shadowed.exhausted).toContainEqual(expect.objectContaining({ id: "shadowstep" }));
    const result = playBattleCardResolved(shadowed, feint.id, 0).state;
    expect(result.hand).toHaveLength(4);
    expect(result.flags.playNextCardTwice).toBe(false);
    expect(result.flags.dodgeNextAttack).toBe(true);
    expect(result.discard).toContainEqual(expect.objectContaining({ id: "feint" }));
    expect(result.exhausted).not.toContainEqual(expect.objectContaining({ id: "feint" }));
    const dodged = applyEnemyAbility({ ...result, rng: () => 0.99 }, cardById.slash!, []);
    expect(dodged.playerHealth).toBe(result.playerHealth);
    expect(dodged.flags.dodgeNextAttack).toBe(false);
    expect(applyEnemyAbility(dodged, cardById.slash!, []).playerHealth).toBeLessThan(dodged.playerHealth);
  });

  it("Flashpoint preserves The Knight's Answer for the following paid Physical card", () => {
    const slash = cardById.slash!;
    const effects = [...slash.effects, { kind: "damage" as const, damageType: "burn" as const, amount: 1 }];
    const corruptedSlash = { ...slash, effects, descriptionLines: describeCardEffects(effects), uid: 1 };
    const ordinarySlash = { ...slash, uid: 2 };
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      hand: [corruptedSlash, ordinarySlash],
      talentEffects: { firstBurnCardFree: true },
      gearEffects: { blockReadiesFreePhysical: 1 },
      uniqueGear: { knightsAnswerReady: true },
    });
    const first = playBattleCardResolved(state, corruptedSlash.id, 0).state;
    expect(first.flags.firstBurnCardFreeUsed).toBe(true);
    expect(first.uniqueGear.knightsAnswerReady).toBe(true);
    const second = playBattleCardResolved(first, ordinarySlash.id, 0).state;
    expect(second.hand).toHaveLength(0);
    expect(second.uniqueGear.knightsAnswerReady).toBe(false);
    expect(second.mana).toBe(0);
  });

  it.each(["quickdraw", "burn talent", "knight"] as const)(
    "a saved zero-cost card preserves the %s discount for the next paid card",
    (source) => {
      const card = cardById[source === "burn talent" ? "fireball" : "venom-arrow"]!;
      const free = { ...card, cost: 0, uid: 1 };
      const paid = { ...card, uid: 2 };
      const state = patchBattleState({
        rng: () => 0.99,
        hand: [free, paid],
        mana: 0,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        encounterBenefits: source === "quickdraw" ? ["quickdraw"] : [],
        talentEffects: { firstBurnCardFree: source === "burn talent" },
        gearEffects: { blockReadiesFreePhysical: source === "knight" ? 1 : 0 },
        uniqueGear: { knightsAnswerReady: source === "knight" },
      });
      const first = playBattleCardResolved(state, free.id, 0).state;
      const second = playBattleCardResolved(first, paid.id, 0).state;
      expect(second.cardsPlayedThisTurn).toBe(2);
      expect(second.mana).toBe(0);
      expect(second.hand).toHaveLength(0);
    },
  );

  it.each(["armed", "encounter"])("applies the %s Archery discount to Sniff Out", (kind) => {
    const card = cardById["sniff-out"]!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      enemyHealth: 100,
      flags: { nextArcheryCardFree: kind === "armed" },
      encounterBenefits: kind === "encounter" ? ["quickdraw"] : [],
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.exhausted.map((entry) => entry.id)).not.toContain(card.id);
    expect(result.mana).toBe(0);
    expect(result.enemyStatuses.bleed).toBe(1);
    expect(result.flags.nextArcheryCardFree).toBe(true);
    if (kind === "encounter") expect(result.flags.encounterArcheryUsed).toBe(true);
  });

  it("Lastlight checks Mana before Runic Quill grants an Emergency Wish", () => {
    const card = makeTestCard({ consume: true });
    const state = patchBattleState({
      mana: 0,
      gearEffects: { holyOnConsumeWithoutMana: 2 },
      trinketEffects: { runicQuillDrawOnConsume: 1 },
      talentEffects: { wishCardRefundsMana: true },
    });
    const next = handlePostPlayCardDestination(state, card);
    expect(next.mana).toBe(0);
    expect(next.wishOptions).not.toBeNull();
    expect(next.enemyHealth).toBe(state.enemyHealth - 2);
  });

  it("fatal Emergency Wish retaliation stops later Thermal Vent rewards", () => {
    const card = cardById["fire-arrow"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyCC: { stunSkipTurns: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { drawOnArcheryVsStunned: 1, burnOnWish: 1, forgeOnBurnCard: 3, forgeOnBurnCardChance: 10 },
      rng: () => 0,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.discard).toContainEqual(card);
  });

  it.each(["block", "armor"] as const)("Rupture requires damage through enemy %s", (defense) => {
    const card = cardById.slash!;
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { [defense]: 10 },
      enemyStatuses: { bleed: 8 },
      talentEffects: { physicalDetonatesBleed: true },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(100);
    expect(result.enemyStatuses.bleed).toBe(8);
  });

  it("Lastlight retaliation settles before Distilled and Arcane Mending can rescue the hero", () => {
    const card = cardById["haste"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 1,
      playerMaxHealth: 40,
      deathsDoorUsed: true,
      mana: card.cost,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      gearEffects: { holyOnConsumeWithoutMana: 1, manaOnPaidConsume: 1 },
      talentEffects: computeTalentEffects({ mana: ["mana-arcane-mending"] }),
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.exhausted).toContain(card);
    expect(result.playerHealth).toBe(0);
    expect(result.mana).toBe(0);
  });

  it("Smelling Salts cannot waste Mana when neither targeted buildup is present", () => {
    const card = cardById["smelling-salts"]!;
    const state = patchBattleState({ hand: [card], playerStatuses: { burn: 2 } });
    expect(canPlayCard(state, card, 0)).toBe(false);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(canPlayCard({ ...state, playerStatuses: { ...state.playerStatuses, stun: 1 } }, card, 0)).toBe(true);
  });
});

it.each(["remove-harmful-status", "remove-player-status"] as const)(
  "allows self-damage to create the target for a following %s",
  (kind) => {
    const card = makeTestCard({
      cost: 1,
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 1 },
        kind === "remove-harmful-status" ? { kind, amount: 1 } : { kind, status: "burn" },
      ],
    });
    const state = makeState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { healOnStatusCleanse: 3 },
      rng: () => 0.99,
    });
    expect(canPlayCard(state, card, 0)).toBe(true);
    const reversed = { ...card, effects: [...card.effects].reverse() };
    expect(canPlayCard({ ...state, hand: [reversed] }, reversed, 0)).toBe(false);
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(state.mana - 1);
    expect(result.state.playerHealth).toBe(12);
    expect(result.state.playerStatuses.burn).toBe(0);
    expect(result.state.discard).toContainEqual(card);
  },
);
