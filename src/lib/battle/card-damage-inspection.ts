import {
  DAMAGE_TYPES,
  carryCardDescriptionMarks,
  getCardDescription,
  getCardKeywords,
  isEnemyAbilityCard,
  isMixedPotionCard,
  isPotionCard,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { applyPotionMultiplier, applyPercentBonus } from "./amount-helpers";
import { computeCardPayment } from "./card-cost-rules";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { consumeAttackPacketFlags } from "./damage";
import { computeBaseDamage } from "./player-damage-base";
import { computeCardAttackPower } from "./damage-calc";
import { prepareEnemyAbilityDamage } from "./enemy-ability-damage";
import { prepareEnemyDamage } from "./enemy-damage-mitigation";
import { getEncounterEnemyAbility } from "./enemy-description";
import { paceCombatMagnitude } from "./fight-pacing";
import { addPlayerStatus, blockAmountWithForge } from "./status-state";
import { resolvePlayerHealing, applyPlayerCombatDamage, mitigatePlayerCombatDamage } from "./health-state";
import { armorMitigatesElementalDamage, reduceDamageByMana } from "./status-helpers";
import { scaleReceivedPlayerDamage } from "./damage-modifiers";
import { gainMana, scaleGoldReward } from "./resource-state";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import type { BattleSnapshot, BattleState, CombatFlags } from "./types";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

function unexpectedInspectionRoll(): never {
  throw new Error("Damage inspection must not roll randomness");
}

function flatAttack(effect: DamageEffect, amount: number): DamageEffect {
  return {
    kind: "damage",
    damageType: effect.damageType,
    amount,
    ...(effect.lifesteal ? { lifesteal: true } : {}),
    ...(effect.ignoreArmor ? { ignoreArmor: true } : {}),
    ...(effect.ignoreBlock ? { ignoreBlock: true } : {}),
  };
}

/** Presentation copies only. Never execute their already-adjusted damage effects. */
export function getBattleDamageInspectionCard(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleCard {
  // Execution helpers accept an RNG dependency, but the offensive stages do not
  // use it. A sealed seam catches accidental future randomness during inspection.
  let state: BattleState = { ...snapshot, rng: unexpectedInspectionRoll };
  const enemy = side === "enemy";
  const presentation = enemy && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
  const payment = enemy ? null : computeCardPayment(snapshot, card);
  if (payment) {
    state = {
      ...state,
      mana: Math.max(0, state.mana - payment.effectiveCost),
      playerStatuses: { ...state.playerStatuses, block: Math.max(0, state.playerStatuses.block - payment.blockCost) },
      flags: {
        ...state.flags,
        archerySecondCardActive:
          card.tags?.includes("archery") === true && state.flags.archeryCardsPlayedThisTurn === 1,
      },
    };
  }
  function grantPlayerStatus(
    current: BattleState,
    status: "forge" | "block" | "armor",
    baseAmount: number,
  ): BattleState {
    if (baseAmount <= 0) return current;
    let amount = baseAmount;
    if (status === "block") amount = paceCombatMagnitude(current, blockAmountWithForge(current, amount), "player");
    if (status === "forge") {
      if (current.playerStatuses.burn > 0 && current.talentEffects.forgeBurningBonusChance >= 100) amount += 1;
      if (current.talentEffects.forgeBonusChance >= 100) amount += 1;
      if (current.playerHealth * 2 < current.playerMaxHealth && current.talentEffects.forgeLowHealthBonusChance >= 100)
        amount += 1;
    }
    if (status === "armor") {
      if (!current.flags.layeredArmorUsedThisTurn && current.gearEffects.flatArmorGained > 0) {
        amount += current.gearEffects.flatArmorGained;
        current = { ...current, flags: { ...current.flags, layeredArmorUsedThisTurn: true } };
      }
      if (current.playerHealth * 2 < current.playerMaxHealth)
        amount = applyPercentBonus(amount, current.talentEffects.armorLowHealthBonusPercent);
      if (current.talentEffects.armorDoubleChance >= 100) amount *= 2;
    }
    const granted = addPlayerStatus(current, status, amount);
    return status === "forge" && current.gearEffects.blockOnForgeGain > 0
      ? grantPlayerStatus(granted, "block", current.gearEffects.blockOnForgeGain)
      : granted;
  }
  if (!enemy) {
    const keywords = getCardKeywords(card);
    const talents = state.talentEffects;
    if (keywords.includes("burn") && (talents.forgeOnBurnCardChance <= 0 || talents.forgeOnBurnCardChance >= 100))
      state = grantPlayerStatus(state, "forge", talents.forgeOnBurnCard);
    if (keywords.includes("block") && talents.armorOnBlockCardChance >= 100)
      state = grantPlayerStatus(state, "armor", talents.armorOnBlockCard);
    if (keywords.includes("leech") && talents.armorStealOnLeechCard > 0)
      state = grantPlayerStatus(state, "armor", Math.min(state.enemyMitigation.armor, talents.armorStealOnLeechCard));
    if (keywords.includes("archery") && snapshot.playerStatuses.block === 0)
      state = grantPlayerStatus(state, "block", state.gearEffects.blockOnArcheryWithoutBlock);
  }
  const potionMult =
    !enemy && isPotionCard(card) && card.consume
      ? state.talentEffects.potionPotency + (isMixedPotionCard(card) ? state.talentEffects.mixedPotionPotency : 0)
      : 1;

  function attack(effect: DamageEffect, current: BattleState): { effect: DamageEffect; state: BattleState } {
    const selected = resolveConditionalCardDamage(effect, {
      actorBlock: enemy ? current.enemyMitigation.block : current.playerStatuses.block,
      targetBlock: enemy ? current.playerStatuses.block : current.enemyMitigation.block,
      targetFrozen: (enemy ? current.playerCC : current.enemyCC).freezeSkipTurns > 0,
    });
    if (enemy) {
      const spent = {
        ...current,
        enemyMitigation: { ...current.enemyMitigation, block: current.enemyMitigation.block - selected.blockSpent },
      };
      const prepared = prepareEnemyAbilityDamage(spent, selected.effect, current.flags.enemyBrawlerDamagePenalty);
      const power = prepareEnemyDamage(spent, prepared.damage, {
        amountMultiplier: prepared.amountMultiplier,
        flatBonus: prepared.flatBonus,
        ignorePlayerMitigation: true,
      }).attemptedDamage;
      return {
        effect: flatAttack(selected.effect, power),
        state:
          prepared.banditBonus && power > 0
            ? { ...spent, flags: { ...spent.flags, enemyFirstHitDoubleUsed: true } }
            : spent,
      };
    }
    const spent = {
      ...current,
      playerStatuses: { ...current.playerStatuses, block: current.playerStatuses.block - selected.blockSpent },
    };
    const consumed = consumeAttackPacketFlags(spent, {
      ...selected.effect,
      amount: applyPotionMultiplier(selected.effect.amount, potionMult),
    });
    const armorBonus =
      consumed.packet.damageType === "stun" && current.gearEffects.armorIncreasesStun > 0
        ? current.enemyMitigation.armor
        : 0;
    const baseDamageBonus = consumed.packet.damageType === "physical" ? consumed.physicalBonus : 0;
    if (armorBonus <= 0 && computeBaseDamage(consumed.state, consumed.packet, { card, bonus: baseDamageBonus }) <= 0)
      return { effect: flatAttack(consumed.packet, 0), state: spent };
    const power = computeCardAttackPower(
      consumed.state,
      consumed.packet,
      card,
      {
        origin: "played-card",
        baseDamageBonus,
      },
      false,
    );
    return { effect: flatAttack(consumed.packet, power.damage + armorBonus), state: power.state };
  }

  function project(effects: readonly BattleCardEffect[], initial: BattleState): BattleCardEffect[] {
    let current = initial;
    return effects.flatMap((effect): BattleCardEffect | BattleCardEffect[] => {
      if (effect.kind === "chance") {
        return {
          ...effect,
          successEffects: project(effect.successEffects, current),
          failureEffects: project(effect.failureEffects, current),
        };
      }
      // Future turns have unknown resources and pacing: retain their authored values.
      if (effect.kind === "repeat-over-turns") return effect;
      if (effect.kind === "damage" || effect.kind === "random-damage") {
        const types =
          effect.kind === "random-damage"
            ? effect.damageTypePool?.length
              ? effect.damageTypePool
              : DAMAGE_TYPES
            : effect.damageTypePool?.length
              ? effect.damageTypePool
              : [effect.damageType];
        const amounts = effect.kind === "random-damage" ? [effect.minAmount, effect.maxAmount] : [effect.amount];
        const outcomes = types.flatMap((damageType) =>
          amounts.map((amount) =>
            attack(
              {
                ...effect,
                kind: "damage",
                damageType,
                amount,
              },
              current,
            ),
          ),
        );
        const first = outcomes[0]!;
        // Advance prepared bonuses only when every possible packet agrees;
        // inspection never chooses a random type or amount.
        const flagKeys = Object.keys(first.state.flags) as Array<keyof CombatFlags>;
        if (outcomes.every((outcome) => flagKeys.every((key) => outcome.state.flags[key] === first.state.flags[key])))
          current = first.state;
        const uniqueTypes = [...new Set(outcomes.map((outcome) => outcome.effect.damageType))];
        if (outcomes.every((outcome) => outcome.effect.amount === first.effect.amount))
          return { ...first.effect, ...(uniqueTypes.length > 1 ? { damageTypePool: uniqueTypes } : {}) };
        return {
          kind: "random-damage",
          minAmount: Math.min(...outcomes.map((outcome) => outcome.effect.amount)),
          maxAmount: Math.max(...outcomes.map((outcome) => outcome.effect.amount)),
          damageTypePool: uniqueTypes,
          ...(effect.lifesteal ? { lifesteal: true } : {}),
        };
      }
      if (!enemy && effect.kind === "self-damage") {
        const incoming = scaleReceivedPlayerDamage(
          reduceDamageByMana(current, effect.amount),
          current.talentEffects,
          effect.damageType,
        );
        const resisted = mitigatePlayerCombatDamage(current, incoming, effect.damageType);
        const damage = armorMitigatesElementalDamage(current, effect.damageType)
          ? Math.max(0, resisted - current.playerStatuses.armor)
          : resisted;
        const before = current.playerHealth;
        current = applyPlayerCombatDamage(current, damage, "self", effect.damageType, { ignoreMitigation: true });
        current = addPlayerStatus(current, effect.damageType, Math.max(0, before - current.playerHealth));
      }
      if (!enemy && effect.kind === "cleanse-player-status-to-damage") {
        const stacks = current.playerStatuses[effect.status];
        current = { ...current, playerStatuses: { ...current.playerStatuses, [effect.status]: 0 } };
        const converted = attack(
          {
            kind: "damage",
            damageType: effect.damageType,
            amount: stacks,
            ...(effect.lifesteal ? { lifesteal: true } : {}),
          },
          current,
        );
        current = converted.state;
        return [
          { kind: "remove-player-status", status: effect.status },
          stacks > 0 ? converted.effect : flatAttack(converted.effect, 0),
        ];
      }
      if (!enemy && effect.kind === "next-hit-poison")
        current = { ...current, flags: { ...current.flags, nextHitPoison: true } };
      if (effect.kind === "player-status" && !effect.statusPool) {
        let amount =
          effect.perManaCrystal !== undefined
            ? effect.perManaCrystal * current.maxMana
            : effect.convertCurrentMana !== undefined
              ? snapshot.mana * effect.convertCurrentMana
              : effect.amount;
        amount = applyPotionMultiplier(amount, potionMult);
        if (enemy && ["forge", "block", "armor"].includes(effect.status)) {
          const status = effect.status as "forge" | "block" | "armor";
          current = addEnemyMitigationWithCombatText(
            current,
            status,
            Math.round(effect.amount * current.roomScalingMultiplier),
            [],
          );
        } else if (!enemy) {
          if (effect.convertCurrentMana !== undefined) current = { ...current, mana: 0 };
          current =
            effect.status === "forge" || effect.status === "block" || effect.status === "armor"
              ? grantPlayerStatus(current, effect.status, amount)
              : addPlayerStatus(current, effect.status, amount);
        }
      }
      if (!enemy && effect.kind === "lose-mana")
        current = { ...current, mana: Math.max(0, current.mana - effect.amount) };
      if (!enemy && effect.kind === "restore-mana" && !effect.ifEnemyFrozen)
        current = gainMana(
          current,
          paceCombatMagnitude(current, applyPotionMultiplier(effect.amount, potionMult), "player"),
          effect.allowOverflow,
        );
      if (!enemy && effect.kind === "heal") {
        const potionBonus =
          isPotionCard(card) && effect.amount > 0 ? (current.talentEffects.homesteadPotionBonus ?? 0) : 0;
        const cardMultiplier = 1 + (current.talentEffects.cardHealMultipliers[card.id] ?? 0);
        const consumeBonus = card.consume
          ? current.talentEffects.consumeHealMultiplier + current.gearEffects.consumeHealBonusPercent / 100
          : 0;
        const amount = Math.round(
          (Math.round(applyPotionMultiplier(effect.amount, potionMult) * cardMultiplier) + potionBonus) *
            (1 + consumeBonus),
        );
        current = resolvePlayerHealing(current, paceCombatMagnitude(current, amount, "player"), true).state;
      }
      if (!enemy && effect.kind === "lose-health") current = applyPlayerCombatDamage(current, effect.amount, "self");
      if (!enemy && effect.kind === "gain-max-mana")
        current = { ...current, mana: current.mana + effect.amount, maxMana: current.maxMana + effect.amount };
      if (!enemy && effect.kind === "gain-gold" && (!effect.ifEnemyStunned || current.enemyCC.stunSkipTurns > 0))
        current = {
          ...current,
          gold: current.gold + scaleGoldReward(applyPotionMultiplier(effect.amount, potionMult), current.gearEffects),
        };
      if (enemy && effect.kind === "heal")
        current = applyEnemyHealingWithCombatText(
          current,
          Math.round(effect.amount * current.roomScalingMultiplier),
          [],
        );
      if (enemy && (effect.kind === "player-status" || effect.kind === "heal"))
        return { ...effect, amount: Math.round(effect.amount * initial.roomScalingMultiplier) };
      if (
        enemy &&
        effect.kind === "remove-enemy-armor" &&
        effect.amount !== undefined &&
        !effect.halve &&
        !effect.removeAll
      )
        return { ...effect, amount: Math.round(effect.amount * initial.roomScalingMultiplier) };
      return effect;
    });
  }

  const effects = project(card.effects, state);
  // No offensive packets: preserve custom utility and summon descriptions verbatim.
  if (!effects.some((effect) => ["damage", "random-damage", "chance"].includes(effect.kind))) return presentation;
  const { description: _description, ...base } = presentation;
  const projected = { ...base, effects };
  const description = carryCardDescriptionMarks(getCardDescription(card), getCardDescription(projected));
  return withCardDescription(projected, description);
}
