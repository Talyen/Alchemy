import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects, getCardKeywords } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveCardEffectChain } from "@/lib/battle/card-play-effects";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { applyBlockReward } from "@/lib/battle/player-rewards";
import { applyLeechHitHealing } from "@/lib/battle/stun-leech-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyWishEffect } from "@/lib/battle/wish";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("Companion removal and genuine Consume", () => {
  it("removes a summon without Consume bonuses, rewards, or enemy reactions", () => {
    const summon = cardById["wolf-companion"]!;
    const state = patchBattleState({
      hand: [summon],
      deck: [cardById.slash!],
      mana: 3,
      playerHealth: 10,
      playerMaxHealth: 40,
      talentEffects: {
        drawOnConsume: 1,
        drawOnConsumeChance: 100,
        forgeOnConsume: 1,
        forgeOnConsumeChance: 100,
        healOnConsume: 1,
        goldOnConsume: 4,
        goldOnConsumeChance: 100,
      },
      gearEffects: { armorOnConsume: 3 },
      trinketEffects: { runicQuillDrawOnConsume: 1 },
      currentEnemy: { traits: [{ id: "insatiable", title: "Insatiable", description: "" }] },
      rng: () => 0.05,
    });
    const next = playBattleCardResolved(state, summon.id, 0).state;
    expect(getCardKeywords(summon)).not.toContain("consume");
    expect(next).toMatchObject({ mana: 2, playerHealth: 10, gold: 0, enemyPhysicalDamageBonus: 0 });
    expect(next.playerStatuses).toMatchObject({ armor: 0, forge: 0 });
    expect(next.hand).toHaveLength(0);
    expect(next.discard).toHaveLength(0);
    expect(next.exhausted).toEqual([summon]);
    expect(next.activeCompanion?.id).toBe("wolf");
    const utility = cardById["pack-tactics"]!;
    expect(handlePostPlayCardDestination(next, utility).discard).toEqual([utility]);
  });

  it("removes hidden Consume on hydration while retaining modified summon content", () => {
    const summon = cardById["wolf-companion"]!;
    const saved = {
      ...summon,
      uid: 42,
      cost: 0,
      consume: true,
      corrupted: true,
      effects: [...summon.effects, { kind: "heal" as const, amount: 3 }],
      descriptionLines: [...summon.descriptionLines, "Restore 3 Health"],
    };
    const restored = hydrateCard(saved);
    expect(restored.consume).toBeUndefined();
    expect(restored).toMatchObject({ uid: 42, cost: 0, corrupted: true, effects: saved.effects });
    expect(restored.descriptionLines).toEqual(saved.descriptionLines);
    expect(hydrateCard(restored)).toEqual(restored);
    expect(hydrateCard({ ...saved, descriptionLines: [...saved.descriptionLines, "Consume"] }).consume).toBe(true);
  });

  it("Blood Offering cannot recycle itself with Arcane Mending", () => {
    const offering = cardById["blood-offering"]!;
    let state = patchBattleState({
      hand: [
        { ...offering, uid: 1 },
        { ...offering, uid: 2 },
      ],
      playerHealth: 20,
      playerMaxHealth: 40,
      mana: 3,
      maxMana: 3,
      talentEffects: computeTalentEffects({ mana: ["mana-arcane-mending"] }),
      rng: () => 0.99,
    });
    state = playBattleCardResolved(state, offering.id, 0).state;
    state = playBattleCardResolved(state, offering.id, 0).state;
    expect(state.exhausted).toHaveLength(2);
    expect(state.discard).toHaveLength(0);
    expect(state.cardsPlayedThisTurn).toBe(2);
    expect(state).toMatchObject({ playerHealth: 20, mana: 3 });
    expect(playBattleCardResolved(state, offering.id, 0).state).toBe(state);
  });
});

describe("card-play rewards", () => {
  it("Armored Surge cannot recursively roll on Block awarded by Forge", () => {
    const block = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 1 }] });
    const state = patchBattleState({
      hand: [block],
      talentEffects: { ...computeTalentEffects({ armor: ["armor-block-burst"] }), goldOnArmorGainChance: 100 },
      gearEffects: { goldGrantsForgeAndHoly: 1, blockOnForgeGain: 1 },
      rng: () => 0,
    });
    const next = playBattleCardResolved(state, block.id, 0).state;
    expect(next.playerStatuses).toMatchObject({ armor: 6, forge: 1, block: 2 });
    expect(next.gold).toBe(6);
    expect(applyBlockReward(next, 1, []).playerStatuses.armor).toBe(6);
  });

  it("Armored Surge uses Armor gain modifiers and automatic card plays", () => {
    const block = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 1 }] });
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 40,
      talentEffects: { armorOnBlockCard: 6, armorOnBlockCardChance: 100, armorDoubleChance: 100 },
    });
    expect(resolveCardEffectChain(state, block, []).state.playerStatuses.armor).toBe(12);
    const repeated = playBattleCardResolved(
      { ...state, hand: [block], flags: { ...state.flags, playNextCardTwice: true } },
      block.id,
      0,
    ).state;
    expect(repeated.playerStatuses).toMatchObject({ armor: 12, block: 2 });
  });

  it.each([0, 1, 2])("Wish refunds actual payment once across repeated multi-Wish effects: cost %s", (cost) => {
    const card = makeTestCard({ cost, effects: [{ kind: "wish", amount: 2 }] });
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      maxMana: 3,
      playerHealth: 10,
      playerMaxHealth: 40,
      flags: { playNextCardTwice: true },
      talentEffects: computeTalentEffects({ wish: ["wish-mana"], mana: ["mana-arcane-mending"] }),
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.mana).toBe(3);
    expect(next.playerHealth).toBe(10 + cost);
    expect(next.wishQueue).toHaveLength(3);
    expect(resolveCardEffectChain({ ...state, mana: 1 }, card, []).state.mana).toBe(1);
    expect(applyWishEffect({ ...state, mana: 1 }, card, 2, []).mana).toBe(1);
  });

  it("Wish refund does not repay Block payment", () => {
    const card = makeTestCard({ cost: 2, tags: ["freeze"], effects: [{ kind: "wish", amount: 1 }] });
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      maxMana: 3,
      playerStatuses: { block: 10 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { wishCardRefundsMana: true },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.mana).toBe(0);
    expect(next.playerStatuses.block).toBeLessThan(10);
  });

  it("Wish refunds respect caps, waived payment, and fatal effects", () => {
    const card = makeTestCard({
      effects: [
        { kind: "wish", amount: 1 },
        { kind: "restore-mana", amount: 3 },
      ],
    });
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      maxMana: 3,
      playerHealth: 10,
      playerMaxHealth: 40,
      talentEffects: { wishCardRefundsMana: true, healthPerMana: 1 },
      rng: () => 0.99,
    });
    expect(playBattleCardResolved(state, card.id, 0).state).toMatchObject({ mana: 3, playerHealth: 11 });
    const waived = { ...state, talentEffects: { ...state.talentEffects, homesteadFreeManaChance: 100 } };
    expect(playBattleCardResolved(waived, card.id, 0).state).toMatchObject({ mana: 3, playerHealth: 10 });
    const fatal = makeTestCard({
      effects: [
        { kind: "lose-health", amount: 40 },
        { kind: "wish", amount: 1 },
      ],
    });
    const defeated = playBattleCardResolved({ ...state, hand: [fatal], deathsDoorUsed: true }, fatal.id, 0).state;
    expect(defeated).toMatchObject({ mana: 2, playerHealth: 0 });
  });
});

describe("Consume and Leech rewards", () => {
  it("Consume rewards roll independently and Last Supper ignores hand size", () => {
    const rolls = [0.05, 0.95, 0.05, 0.05];
    const state = patchBattleState({
      hand: [cardById.slash!],
      deck: [cardById.stab!],
      enemyStatuses: { burn: 2 },
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: computeTalentEffects({
        consume: ["consume-second-helping", "consume-last-supper", "consume-aftertaste", "consume-leftovers"],
        burn: ["burn-dmg-4"],
      }),
      rng: () => rolls.shift() ?? 0.99,
    });
    const next = handlePostPlayCardDestination(state, cardById.bread!);
    expect(next.hand).toHaveLength(2);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.enemyStatuses.burn).toBe(0);
    expect(next).toMatchObject({ gold: 4, playerHealth: 11 });
    const forge = handlePostPlayCardDestination({ ...state, rng: () => 0.05 }, cardById.bread!);
    expect(forge.playerStatuses.forge).toBe(1);
  });

  it("successful Second Helping can open an Emergency Wish", () => {
    const state = patchBattleState({ talentEffects: { drawOnConsume: 1, drawOnConsumeChance: 10 }, rng: () => 0.05 });
    expect(handlePostPlayCardDestination(state, cardById.bread!).wishOptions).not.toBeNull();
    expect(handlePostPlayCardDestination({ ...state, rng: () => 0.1 }, cardById.bread!).wishOptions).toBeNull();
  });

  it("Deep Siphon benefits incidental, Companion, and deferred Bleed Leech", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { leechHealingBonus: 1, companionLeechChance: 100 },
      rng: () => 0.99,
    });
    expect(applyLeechHitHealing(state, 4, []).playerHealth).toBe(13);
    const summon = applyCardEffects(state, cardById["wolf-companion"]!, []);
    expect(processCompanionTurnStart(summon, []).playerHealth).toBeGreaterThan(10);
    const tick = tickEnemyStatuses(
      {
        ...state,
        enemyStatuses: { ...state.enemyStatuses, bleed: 4 },
        pendingBleedLeechHealing: 4,
        pendingCardBleedLeechHealing: 0,
      },
      [],
    );
    expect(tick.playerHealth).toBe(13);
  });

  it("Bloodletting cleanses on Leech even at full Health, never on Health loss", () => {
    const state = patchBattleState({
      playerHealth: 40,
      playerMaxHealth: 40,
      playerStatuses: { poison: 3 },
      talentEffects: { leechCleanseChance: 10 },
      rng: () => 0.05,
    });
    expect(applyLeechHitHealing(state, 4, []).playerStatuses.poison).toBe(0);
    expect(applyLeechHitHealing({ ...state, rng: () => 0.1 }, 4, []).playerStatuses.poison).toBe(3);
    const loss = makeTestCard({ effects: [{ kind: "lose-health", amount: 1 }] });
    expect(applyCardEffects(state, loss, []).playerStatuses.poison).toBe(3);
  });
});
