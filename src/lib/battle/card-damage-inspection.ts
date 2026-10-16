import {
  DAMAGE_TYPES,
  harmfulPlayerStatusIds,
  carryCardDescriptionMarks,
  getCardDescription,
  getCardEffect,
  getCardKeywords,
  effectChildren,
  mapCardDescriptionReferences,
  isEnemyAbilityCard,
  isMixedPotionCard,
  isPotionCard,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardEffectAddress,
} from "@/lib/game-data";
import { applyPotionMultiplier, applyPercentBonus, halveRounded } from "./amount-helpers";
import { computeCardPayment } from "./card-cost-rules";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { consumeAttackPacketFlags } from "./damage";
import { computeBaseDamage } from "./player-damage-base";
import { computeCardAttackPower } from "./damage-calc";
import { prepareEnemyAbilityDamage } from "./enemy-ability-damage";
import { prepareEnemyDamage } from "./enemy-damage-mitigation";
import { getEncounterEnemyAbility } from "./enemy-description";
import { paceCombatMagnitude } from "./fight-pacing";
import { addPlayerStatus, blockAmountWithForge, setPlayerStatus } from "./status-state";
import {
  resolvePlayerHealing,
  applyPlayerCombatDamage,
  mitigatePlayerCombatDamage,
  playerHealthLostToDamage,
} from "./health-state";
import { isPlayerDefeated } from "./battle-outcome";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { resolveSecondaryAction } from "./action-context";
import { BATTLE_CONFIG, MIN_MAX_MANA_FLOOR } from "../game-constants";
import { armorMitigatesElementalDamage, reduceDamageByMana } from "./status-helpers";
import { scaleReceivedPlayerDamage } from "./damage-modifiers";
import { gainMana, scaleGoldReward } from "./resource-state";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { reduceEnemyArmor } from "./enemy-mitigation-state";
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
    ...(effect.detonateAllBurn ? { detonateAllBurn: true } : {}),
    ...(effect.detonateIfEnemyBurning ? { detonateIfEnemyBurning: true } : {}),
    ...(effect.detonateAllBleed ? { detonateAllBleed: true } : {}),
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
    if (keywords.includes("leech") && talents.armorStealOnLeechCard > 0) {
      const stolen = Math.min(state.enemyMitigation.armor, talents.armorStealOnLeechCard);
      state = grantPlayerStatus(reduceEnemyArmor(state, stolen), "armor", stolen);
    }
    if (keywords.includes("archery") && snapshot.playerStatuses.block === 0)
      state = grantPlayerStatus(state, "block", state.gearEffects.blockOnArcheryWithoutBlock);
  }
  const potionMult =
    !enemy && isPotionCard(card) && card.consume
      ? state.talentEffects.potionPotency + (isMixedPotionCard(card) ? state.talentEffects.mixedPotionPotency : 0)
      : 1;

  function projectHealthThresholds(current: BattleState, previousHealth: number): BattleState {
    if (isPlayerDefeated(current)) return current;
    const healthAfterDamage = current.playerHealth;
    const crossed = (threshold: number) =>
      previousHealth >= (current.playerMaxHealth * threshold) / 100 &&
      healthAfterDamage < (current.playerMaxHealth * threshold) / 100;
    if (current.talentEffects.cleanseBelowHealthPercent > 0 && crossed(current.talentEffects.cleanseBelowHealthPercent))
      current = projectCleanse(current, Infinity);
    const block = current.talentEffects.healthThresholdBlockOnce;
    if (block && !current.flags.desperateGuardUsed && crossed(block.threshold)) {
      current = grantPlayerStatus(current, "block", block.amount);
      current = { ...current, flags: { ...current.flags, desperateGuardUsed: true } };
    }
    for (const armor of current.talentEffects.healthThresholdArmor) {
      if (crossed(armor.threshold)) current = grantPlayerStatus(current, "armor", armor.amount);
    }
    return current;
  }

  // Only guaranteed utility reactions are projected. Random procs retain their
  // authored uncertainty and never borrow the live battle's random stream.
  function projectHealing(current: BattleState, amount: number, cardHealing = false): BattleState {
    if (amount <= 0) return current;
    const healing = resolvePlayerHealing(current, paceCombatMagnitude(current, amount, "player"), cardHealing);
    let healed = healing.state;
    if (healing.restored > 0 && current.gearEffects.healCleanseChance >= 100) healed = projectCleanse(healed, 1);
    if (cardHealing && healing.overflow > 0 && current.talentEffects.cleanseOnCardOverheal)
      healed = projectCleanse(healed, 1);
    return healed;
  }

  function projectManaHealing(current: BattleState, gained: number): BattleState {
    return gained > 0 && current.talentEffects.healthPerMana > 0
      ? projectHealing(current, gained * current.talentEffects.healthPerMana)
      : current;
  }

  function projectCleanseRewards(current: BattleState, removed: number): BattleState {
    for (let index = 0; index < removed; index++) {
      current = projectHealing(current, current.trinketEffects.sinEaterHealOnHarmfulStatusRemove);
      current = projectHealing(current, current.talentEffects.healOnStatusCleanse);
      current = grantPlayerStatus(current, "block", current.gearEffects.blockOnCleanse);
      const previousMana = current.mana;
      current = gainMana(current, paceCombatMagnitude(current, current.gearEffects.manaOnCleanse, "player"));
      current = projectManaHealing(current, current.mana - previousMana);
    }
    return current;
  }

  function projectCleanse(current: BattleState, amount: number): BattleState {
    let removed = 0;
    for (const status of harmfulPlayerStatusIds) {
      if (removed >= amount) break;
      if (current.playerStatuses[status] <= 0) continue;
      current = setPlayerStatus(current, status, 0);
      removed++;
    }
    return projectCleanseRewards(current, removed);
  }

  function projectGold(current: BattleState, amount: number): BattleState {
    if (amount <= 0) return current;
    const gold = Math.min(Number.MAX_SAFE_INTEGER, current.gold + scaleGoldReward(amount, current.gearEffects));
    return gold > current.gold
      ? projectHealing({ ...current, gold }, current.gearEffects.healOnCombatGoldGain)
      : current;
  }

  function attack(
    effect: DamageEffect,
    current: BattleState,
  ): { effect: DamageEffect; state: BattleState; followUp?: DamageEffect } {
    if (!enemy && isPlayerDefeated(current)) return { effect: flatAttack(effect, 0), state: current };
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
    let followUp: DamageEffect | undefined;
    if (consumed.packet.damageType !== "physical" && consumed.physicalBonus > 0 && power.damage + armorBonus > 0) {
      resolveSecondaryAction(power.state, "reward", (secondary) => {
        const packet = { kind: "damage" as const, damageType: "physical" as const, amount: consumed.physicalBonus };
        followUp = flatAttack(packet, computeCardAttackPower(secondary, packet, undefined, undefined, false).damage);
        return secondary;
      });
    }
    return {
      effect: flatAttack(consumed.packet, power.damage + armorBonus),
      state: power.state,
      ...(followUp ? { followUp } : {}),
    };
  }

  const projectedSources = new Map<BattleCardEffect, BattleCardEffect>();
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
        const summarize = (packets: DamageEffect[]): BattleCardEffect => {
          const firstPacket = packets[0]!;
          const uniqueTypes = [...new Set(packets.map((packet) => packet.damageType))];
          if (packets.every((packet) => packet.amount === firstPacket.amount))
            return { ...firstPacket, ...(uniqueTypes.length > 1 ? { damageTypePool: uniqueTypes } : {}) };
          return {
            kind: "random-damage",
            minAmount: Math.min(...packets.map((packet) => packet.amount)),
            maxAmount: Math.max(...packets.map((packet) => packet.amount)),
            damageTypePool: uniqueTypes,
            ...(firstPacket.lifesteal ? { lifesteal: true } : {}),
          };
        };
        const projected = [summarize(outcomes.map((outcome) => outcome.effect))];
        projectedSources.set(projected[0]!, effect);
        if (outcomes.some((outcome) => outcome.followUp))
          projected.push(
            summarize(
              outcomes.map((outcome) => outcome.followUp ?? { kind: "damage", damageType: "physical", amount: 0 }),
            ),
          );
        return projected;
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
        const before = current;
        current = applyPlayerCombatDamage(current, damage, "self", effect.damageType, { ignoreMitigation: true });
        current = addPlayerStatus(current, effect.damageType, playerHealthLostToDamage(before, current));
        if (damage > 0 && current.playerStatuses.armor > 0 && !hasEncounterBenefit(current, "ironclad")) {
          const armor = Math.max(0, current.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
          current = { ...current, playerStatuses: { ...current.playerStatuses, armor } };
          if (armor === 0 && !isPlayerDefeated(current))
            current = grantPlayerStatus(current, "block", current.talentEffects.armorBreakBlock);
        }
        current = projectHealthThresholds(current, before.playerHealth);
      }
      if (!enemy && effect.kind === "cleanse-player-status-to-damage") {
        const stacks = current.playerStatuses[effect.status];
        current = setPlayerStatus(current, effect.status, 0);
        if (stacks > 0) current = projectCleanseRewards(current, 1);
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
      if (!enemy && effect.kind === "remove-harmful-status")
        current = projectCleanse(
          current,
          effect.removeAll ? Infinity : applyPotionMultiplier(effect.amount ?? 0, potionMult),
        );
      if (!enemy && effect.kind === "remove-player-status" && current.playerStatuses[effect.status] > 0)
        current = projectCleanseRewards(setPlayerStatus(current, effect.status, 0), 1);
      if (!enemy && effect.kind === "remove-enemy-armor") {
        const amount = effect.halve
          ? current.enemyMitigation.armor - halveRounded(current.enemyMitigation.armor)
          : effect.removeAll
            ? current.enemyMitigation.armor
            : applyPotionMultiplier(effect.amount ?? 0, potionMult);
        current = reduceEnemyArmor(current, amount);
      }
      if (!enemy && effect.kind === "lose-max-mana") {
        const maxMana = Math.max(MIN_MAX_MANA_FLOOR, current.maxMana - effect.amount);
        if (maxMana < current.maxMana) current = { ...current, maxMana, mana: Math.min(current.mana, maxMana) };
      }
      if (!enemy && effect.kind === "lose-mana")
        current = { ...current, mana: Math.max(0, current.mana - effect.amount) };
      if (!enemy && effect.kind === "restore-mana" && !effect.ifEnemyFrozen) {
        const previousMana = current.mana;
        current = gainMana(
          current,
          paceCombatMagnitude(current, applyPotionMultiplier(effect.amount, potionMult), "player"),
          effect.allowOverflow,
        );
        current = projectManaHealing(current, current.mana - previousMana);
      }
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
        current = projectHealing(current, amount, true);
      }
      if (!enemy && effect.kind === "lose-health") {
        const previousHealth = current.playerHealth;
        current = applyPlayerCombatDamage(current, effect.amount, "self", "health", { ignoreMitigation: true });
        current = projectHealthThresholds(current, previousHealth);
      }
      if (!enemy && effect.kind === "gain-max-mana") {
        current = { ...current, mana: current.mana + effect.amount, maxMana: current.maxMana + effect.amount };
        current = projectManaHealing(current, effect.amount);
      }
      if (!enemy && effect.kind === "gain-gold" && (!effect.ifEnemyStunned || current.enemyCC.stunSkipTurns > 0))
        current = projectGold(current, applyPotionMultiplier(effect.amount, potionMult));
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
  const projectedAddresses = new Map<BattleCardEffect, CardEffectAddress>();
  const recordAddress = (effect: BattleCardEffect, address: CardEffectAddress) => {
    projectedAddresses.set(projectedSources.get(effect) ?? effect, address);
    effectChildren(effect).forEach((child, index) =>
      recordAddress(child, { ...address, effectPath: [...(address.effectPath ?? []), index] }),
    );
  };
  effects.forEach((effect, effectIndex) => recordAddress(effect, { effectIndex }));
  // Added follow-up lines must neither steal a later effect's marks nor reuse its magnitude ID.
  const previous = mapCardDescriptionReferences(getCardDescription(card), (reference) => {
    const original = getCardEffect(card.effects, reference);
    const address = original && projectedAddresses.get(original);
    return address ? { ...reference, ...address } : reference;
  });
  const description = carryCardDescriptionMarks(
    previous,
    mapCardDescriptionReferences(getCardDescription(projected), (reference) => reference, "inspection"),
  );
  return withCardDescription(projected, description);
}
