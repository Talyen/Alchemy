import { describe, expect, it, vi } from "vitest";
import {
  cardById,
  cardLibrary,
  companionLibrary,
  enemyById,
  getCardEffect,
  getEffectiveCardDescriptionLines,
  isPotionCard,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import type { BattleResolutionObserver, ObservedAttack, ObservedDirectAmount } from "@/lib/battle/resolution-observer";
import { createMixedPotion } from "@/lib/alchemist/potion-mixer";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

const bonuses: BattleStatePatch = {
  playerStatuses: { forge: 5, block: 3, armor: 2 },
  talentEffects: {
    flatPhysicalDamage: 1,
    flatBurnDamage: 1,
    flatFreezeDamage: 1,
    flatHolyDamage: 1,
    flatNatureDamage: 1,
    flatArrowDamage: 1,
    forgeBlockPercent: 25,
    potionPotency: 2,
    healMultiplier: 1.5,
  },
  gearEffects: {
    flatPhysicalDamage: 2,
    flatBurnDamage: 2,
    flatFreezeDamage: 2,
    flatHolyDamage: 2,
    flatNatureDamage: 2,
    flatStunDamage: 3,
    flatBleedDamage: 3,
    flatPoisonDamage: 2,
    flatArrowDamage: 1,
    flatBlockGained: 2,
    flatArmorGained: 2,
    goldGainPercent: 50,
  },
};

function stateFor(card: BattleCard, patch: BattleStatePatch = {}) {
  return patchBattleState({
    currentEnemy: { ...enemyById["blood-countess"]!, traits: [] },
    hand: [card],
    playerHealth: 40,
    playerMaxHealth: 100,
    enemyHealth: 10000,
    enemyMaxHealth: 10000,
    mana: 20,
    maxMana: 50,
    activeCompanion: companionLibrary.wolf,
    ...patch,
  });
}

function effectLocations(
  effects: readonly BattleCardEffect[],
  prefix: number[] = [],
): Array<{ effect: BattleCardEffect; path: number[] }> {
  return effects.flatMap((effect, index) => {
    const path = [...prefix, index];
    return [
      { effect, path },
      ...(effect.kind === "chance" ? effectLocations([...effect.successEffects, ...effect.failureEffects], path) : []),
    ];
  });
}

function observe(card: BattleCard) {
  const attacks = new Map<BattleCardEffect, ObservedAttack[]>();
  const grants = new Map<BattleCardEffect, readonly ObservedDirectAmount[]>();
  const entered = new Set<BattleCardEffect>();
  let current: BattleCardEffect | undefined;
  const observer: BattleResolutionObserver = {
    step: () => {},
    unknownDraw: () => {
      throw new Error("Catalog fixture unexpectedly drew an unknown card");
    },
    branch: () => {},
    effect: (owner, effect, execute) => {
      const previous = current;
      current = owner === card && !entered.has(effect) ? effect : undefined;
      if (current) entered.add(current);
      try {
        return execute();
      } finally {
        current = previous;
      }
    },
    attack: (attack) => {
      if (current) attacks.set(current, [...(attacks.get(current) ?? []), attack]);
    },
    directFeedback: (amounts) => {
      if (current) grants.set(current, amounts);
    },
  };
  return { observer, attacks, grants };
}

const cards = [
  ...cardLibrary,
  createMixedPotion(cardById["health-potion"]!, cardById["mana-potion"]!),
  createMixedPotion(cardById["wishing-potion"]!, cardById["porcupine-quill"]!),
  createMixedPotion(cardById["gamblers-shot"]!, cardById.apple!),
];

describe("complete catalog deterministic preview coverage", () => {
  it("keeps every no-bonus catalog sentence and keyword intact", () => {
    for (const card of cardLibrary) {
      expect(getBattleCardDescriptionInspection(card, stateFor(card)).descriptionLines, card.id).toEqual(
        card.id === "kindling"
          ? ["Deal 1 Burn damage", "If the enemy was not Burning, deal 3 Burn damage instead (base damage tripled)"]
          : card.id === "shield-bash"
            ? ["Gain 2 Block", "Spend half your Block to deal 1 Stun damage"]
            : card.id === "burning-blade"
              ? ["Deal 1 Burn damage, increased by half your Forge (1 total)"]
              : card.descriptionLines,
      );
    }
  });

  it.each([
    { label: "baseline", patch: {} },
    { label: "known gear, talent and status bonuses", patch: bonuses },
    {
      label: "known controlled and damaged target",
      patch: { ...bonuses, enemyCC: { freezeSkipTurns: 1 }, enemyStatuses: { bleed: 3, burn: 2, poison: 2 } },
    },
  ])("matches production direct results across every card with $label", ({ patch }) => {
    const catalogBefore = JSON.stringify(cards);
    let checkedAttacks = 0;
    let checkedGrants = 0;
    for (const card of cards) {
      const liveRng = vi.fn(() => {
        throw new Error("Preview consumed live RNG");
      });
      const state = { ...stateFor(card, patch), rng: liveRng };
      const before = JSON.stringify(state);
      const view = getBattleCardDescriptionInspection(card, state);
      expect(JSON.stringify(state), card.id).toBe(before);
      expect(liveRng, card.id).not.toHaveBeenCalled();
      const recorded = observe(card);
      const execution = {
        ...state,
        rng: () => 0.99,
        sampleWishOptions: () => ({ cards: [], deferred: true as const }),
      };
      const actual = playBattleCardResolved({ ...execution, observer: recorded.observer }, card.id, 0);
      const ordinary = playBattleCardResolved(execution, card.id, 0);
      expect(battleSnapshot(actual.state), `${card.id}: observation changes no math`).toEqual(
        battleSnapshot(ordinary.state),
      );
      for (const { effect, path } of effectLocations(card.effects)) {
        const projected = getCardEffect(view.effects, { effectIndex: path[0]!, effectPath: path.slice(1) });
        if (
          (effect.kind === "damage" &&
            !effect.equalToBlock &&
            !effect.equalToArmor &&
            effect.forgeBonusPercent === undefined &&
            !effect.damageTypeIfTargetFrozen &&
            !effect.doubleIfEnemyBleeding &&
            !effect.tripleIfEnemyNotBurning) ||
          effect.kind === "random-damage"
        ) {
          const attack = recorded.attacks.get(effect)?.[0];
          if (!attack) continue;
          if (projected?.kind === "damage") expect(projected.amount, `${card.id}/${path}: attack`).toBe(attack.amount);
          else {
            expect(projected?.kind, card.id).toBe("random-damage");
            if (projected?.kind === "random-damage") {
              expect(attack.amount, card.id).toBeGreaterThanOrEqual(projected.minAmount);
              expect(attack.amount, card.id).toBeLessThanOrEqual(projected.maxAmount);
            }
          }
          checkedAttacks++;
        }
        const stat =
          effect.kind === "heal"
            ? "health"
            : effect.kind === "gain-gold"
              ? "gold"
              : effect.kind === "restore-mana" || effect.kind === "gain-max-mana"
                ? "mana"
                : effect.kind === "player-status" &&
                    !effect.statusPool &&
                    effect.perManaCrystal === undefined &&
                    effect.convertCurrentMana === undefined &&
                    effect.status !== "haste" &&
                    effect.status !== "phoenixFeather"
                  ? effect.status
                  : undefined;
        const amount = recorded.grants
          .get(effect)
          ?.find(
            (grant) =>
              grant.target === "player" &&
              grant.stat === stat &&
              grant.kind === (stat === "health" ? "heal" : "status"),
          );
        if (stat && amount && projected && "amount" in projected) {
          expect(projected.amount, `${card.id}/${path}: direct ${stat}`).toBe(amount.amount);
          checkedGrants++;
        }
      }
    }
    expect(checkedAttacks).toBeGreaterThan(40);
    expect(checkedGrants).toBeGreaterThan(30);
    expect(JSON.stringify(cards)).toBe(catalogBefore);
  });

  it("keeps Ranger alternatives and Wolf actions distinct from the card's own grant", () => {
    const venom = getBattleCardDescriptionInspection(
      cardById["venom-arrow"]!,
      stateFor(cardById["venom-arrow"]!, bonuses),
    );
    expect(venom.descriptionLines).toEqual(["Deal 6–12 Poison, or Physical damage", "Archery"]);
    const ice = getBattleCardDescriptionInspection(cardById["ice-shot"]!, stateFor(cardById["ice-shot"]!, bonuses));
    expect(ice.descriptionLines).toEqual([
      "Deal 7 Freeze damage; Against Frozen enemies, deal 9 Freeze instead",
      "Archery",
    ]);
    const pack = cardById["pack-tactics"]!;
    const state = stateFor(pack, bonuses);
    expect(getBattleCardDescriptionInspection(pack, state).descriptionLines).toEqual([
      "Your Companion acts twice",
      "If you don't have a Companion, Wish for one",
      "Gain 6 Block",
    ]);
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, pack.id, 0);
    expect(played.state.enemyHealth).toBeLessThan(state.enemyHealth);
    expect(played.state.playerStatuses.block - state.playerStatuses.block).toBe(6);
    expect(
      getEffectiveCardDescriptionLines(cardById["wolf-companion"]!, {
        companionBondLevels: { wolf: 2 },
        companionDamageModifiers: { damageBonus: 3, damageMultiplier: 1 },
      })[0],
    ).toContain("damage each turn");
  });

  it("previews mixed Potion counts before an unknown draw without inventing its identities", () => {
    const mix = createMixedPotion(cardById["mana-berries"]!, cardById["wishing-potion"]!);
    const state = stateFor(mix, {
      talentEffects: { potionPotency: 2, mixedPotionPotency: 1 },
      deck: [cardById.slash!],
    });
    const view = getBattleCardDescriptionInspection(mix, state);
    expect(isPotionCard(mix)).toBe(true);
    expect(view.descriptionLines).toEqual(["Gain 3 Mana", "Draw 3 cards", "Wish 6", "Consume"]);
    expect(state.deck).toEqual([cardById.slash]);
  });

  it("shows each known Avatar branch without predicting which status is selected", () => {
    const card = cardById.avatar!;
    const state = stateFor(card, bonuses);
    const before = JSON.stringify(state);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Deal 8 Holy damage",
      "Gain 8 Block, 2 Forge, or 7 Armor",
      "Consume",
    ]);
    expect(JSON.stringify(state)).toBe(before);
    expect(card.descriptionLines[1]).toBe("Gain 5 Block, 2 Forge, or 5 Armor");
  });

  it("keeps Rend's additive conditional payoff truthful and Viper follow-ups separate", () => {
    const rend = cardById.rend!;
    const state = stateFor(rend, {
      enemyStatuses: { bleed: 2 },
      talentEffects: { bleedDesperateMultiplier: 2 },
      gearEffects: { flatBleedDamage: 3 },
    });
    const view = getBattleCardDescriptionInspection(rend, state);
    expect(view.descriptionLines).toEqual([
      "Deal 8 Bleed damage",
      "If the enemy was already Bleeding, deal 12 Bleed damage instead (base damage doubled)",
    ]);
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, rend.id, 0);
    expect(state.enemyHealth - played.state.enemyHealth).toBe(12);
    const stab = cardById.stab!;
    const ready = stateFor(stab, {
      playerStatuses: { forge: 5 },
      gearEffects: { flatPhysicalDamage: 2, dodgeReadiesVenomousHit: 1 },
      uniqueGear: { viperReady: true },
    });
    expect(getBattleCardDescriptionInspection(stab, ready).descriptionLines).toEqual([
      "Deal 10 Physical damage",
      "Ignores Armor and Block",
    ]);
    expect(
      ready.enemyHealth - playBattleCardResolved({ ...ready, rng: () => 0.99 }, stab.id, 0).state.enemyHealth,
    ).toBeGreaterThan(10);
    expect(ready.uniqueGear.viperReady).toBe(true);
  });

  it("evaluates Ice Shot's Frozen modifier at the effect's ordered state", () => {
    const card = cardById["ice-shot"]!;
    const patch = { gearEffects: { flatFreezeDamage: 1, frozenEnemyDamageBonusPercent: 100 } };
    const state = stateFor(card, patch);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Deal 3 Freeze damage; Against Frozen enemies, deal 10 Freeze instead",
      "Archery",
    ]);
    const ordinary = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    const frozenState = stateFor(card, { ...patch, enemyCC: { freezeSkipTurns: 1 } });
    const frozen = playBattleCardResolved({ ...frozenState, rng: () => 0.99 }, card.id, 0);
    expect(state.enemyHealth - ordinary.state.enemyHealth).toBe(3);
    expect(frozenState.enemyHealth - frozen.state.enemyHealth).toBe(10);
    const mixed = createMixedPotion(cardById.block!, card);
    expect(
      getBattleCardDescriptionInspection(
        mixed,
        stateFor(mixed, { gearEffects: { ...patch.gearEffects, freezeAttackBonusWithBlock: 2 } }),
      ).descriptionLines,
    ).toEqual([
      "Gain 5 Block",
      "Deal 5 Freeze damage; Against Frozen enemies, deal 14 Freeze instead",
      "Archery",
      "Consume",
    ]);
    const prepared = stateFor(card, {
      flags: { nextHitPoison: true },
      gearEffects: { flatPoisonDamage: 2, frozenEnemyDamageBonusPercent: 100 },
    });
    expect(getBattleCardDescriptionInspection(card, prepared).descriptionLines).toEqual([
      "Deal 4 Poison damage; Against Frozen enemies, deal 12 Poison instead",
      "Archery",
    ]);
    expect(prepared.flags.nextHitPoison).toBe(true);
    const stunned = stateFor(card, {
      ...patch,
      enemyCC: { stunSkipTurns: 1 },
      talentEffects: { stunDoubleDamage: true },
    });
    expect(getBattleCardDescriptionInspection(card, stunned).descriptionLines).toEqual([
      "Deal 6 Freeze damage; Against Frozen enemies, deal 10 Freeze instead",
      "Archery",
    ]);
  });

  it("retains Armor and Block exceptions when an earlier random Forge grant creates a damage range", () => {
    const card = createMixedPotion(cardById.anvil!, cardById.stab!);
    const state = stateFor(card, { talentEffects: { forgeBonusChance: 25 } });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Gain 2 Forge",
      "Deal 5–6 Physical damage",
      "Ignores Armor and Block",
      "Consume",
    ]);
  });
});
