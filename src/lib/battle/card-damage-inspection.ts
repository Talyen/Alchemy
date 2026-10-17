import { resolveCompanionAction, type CompanionResolutionPort } from "./companion-resolution";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { resolveWishRewards } from "./wish-rewards";
import type { FollowUpHitRequest } from "./player-hit-core";
import { createCardUtilityHandlers, applyCardUtilityEffect } from "./card-utility-resolution";
import { createPlayerResourceResolver } from "./player-resource-resolution";
import {
  DAMAGE_TYPES,
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
import { applyPotionMultiplier, halveRounded } from "./amount-helpers";
import { computeCardPayment } from "./card-cost-rules";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { consumeAttackPacketFlags } from "./damage";
import { computeBaseDamage } from "./player-damage-base";
import { computeCardAttackPower, computeCardDamageToEnemy, computeTalentDamageToEnemy } from "./damage-calc";
import { prepareEnemyAbilityDamage } from "./enemy-ability-damage";
import { prepareEnemyDamage, calculateBlockAndArmorMitigation } from "./enemy-damage-mitigation";
import { getEncounterEnemyAbility } from "./enemy-description";
import { gearFrozenDamageMultiplier, prepareScaledEnemyHit } from "./scaled-damage";
import { addEnemyStatus, addPlayerStatus, setPlayerStatus, setEnemyStatus } from "./status-state";
import { applyPlayerCombatDamage, playerHealthLostToDamage, damageEnemyHealth } from "./health-state";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
import { hasEnemyTrait, hasEncounterBenefit } from "./encounter-trait-state";
import { resolveSecondaryAction } from "./action-context";
import { BATTLE_CONFIG, BLEED_STATUS_MULTIPLIER } from "../game-constants";
import { mitigatePlayerStatusDamage, getEnemyDamageMultiplier } from "./status-helpers";
import {
  resolveCrowdControlBonuses,
  resolveEnemyStun,
  resolveEnemyFreeze,
  type CrowdControlResolutionPort,
} from "./crowd-control-resolution";
import { projectEnemyDotDamage } from "./dot-resolve";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { decayEnemyArmor, reduceEnemyArmor } from "./enemy-mitigation-state";
import { computeLeechHeal, leechHealingAmount, scaleLeechBase } from "./damage-rider-leech";
import {
  addEnemyMitigationWithCombatText,
  processEncounterTraitHealthThreshold,
} from "./encounter-trait-health-threshold";
import { purgeEnemyBenefits } from "./enemy-purge";
import { applyShatter, canShatter, getPostHitReactionPayoffs, consumeReactionOpportunity } from "./elemental-reactions";
import type { BattleSnapshot, BattleState, CombatTextEvent } from "./types";
import {
  resolveLeechResourceRewards,
  resolveNatureManaReward,
  resolveNatureRestorationRewards,
  resolvePoisonLeechRewards,
  resolveHolyBlockReward,
  resolveHolyGoldReward,
  resolveNatureGoldReward,
  resolveLuckyCloverReward,
  resolveBleedGoldReward,
  burnBleedLeechAmount,
  type ResourceRewardPort,
} from "./resource-reward-resolution";

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
  const playerResources = createPlayerResourceResolver({
    chance: (chance) => chance >= 100,
    afterHealing: (current, restored) =>
      restored > 0 && hasEnemyTrait(current, "blood-countess") ? projectEnemyHealthLoss(current, 1) : current,
    // Drawing a specific card is unknown until resolution; inspection never samples a pile.
    drawHoly: (current) => current,
    forgeReady: () => {},
  });

  function grantPlayerStatus(current: BattleState, status: "forge" | "block" | "armor", amount: number): BattleState {
    return playerResources.applyPlayerStatusEffect(current, { kind: "player-status", status, amount }, []);
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
  // Display power excludes critical strikes; later packets still see their guaranteed Health loss.
  const guaranteedCrit =
    !enemy &&
    state.gearEffects.dodgeReadiesNatureCrit > 0 &&
    state.uniqueGear.wildheartReady &&
    getCardKeywords(card).includes("nature");
  const potionMult =
    !enemy && isPotionCard(card) && card.consume
      ? state.talentEffects.potionPotency + (isMixedPotionCard(card) ? state.talentEffects.mixedPotionPotency : 0)
      : 1;

  // Only guaranteed utility reactions are projected. Random procs retain their
  // authored uncertainty and never borrow the live battle's random stream.
  function projectHealing(
    current: BattleState,
    amount: number,
    cardHealing = false,
    leechHealing = false,
  ): BattleState {
    if (amount <= 0) return current;
    const options = { skipFightPacing: leechHealing, allowOverhealBlock: cardHealing && !leechHealing };
    return cardHealing
      ? playerResources.applyCardHealing(current, amount, [], options)
      : playerResources.applyHealingWithCombatText(current, amount, [], options);
  }

  function projectMana(current: BattleState, amount: number, unpaced = false): BattleState {
    return playerResources.gainManaWithCombatText(current, amount, [], { skipFightPacing: unpaced });
  }

  function projectLeech(current: BattleState, damage: number, cardHealing = false, percent?: number): BattleState {
    const base = percent === undefined ? computeLeechHeal(damage) : Math.round((damage * percent) / 100);
    return base <= 0 ? current : projectLeechBase(current, base, cardHealing);
  }

  function projectLeechBase(current: BattleState, base: number, cardHealing = false): BattleState {
    if (base <= 0) return current;
    return resolveLeechResourceRewards(
      current,
      leechHealingAmount(current, scaleLeechBase(current, base)),
      [],
      resourceRewards,
      { cardHealing },
    );
  }

  const resourceRewards: ResourceRewardPort = {
    chance: (chance) => chance >= 100,
    heal: (current, amount, _texts, cardHealing) => projectHealing(current, amount, cardHealing, true),
    status: (current, status, amount, _texts, unpaced) =>
      playerResources.addPlayerStatusWithCombatText(current, status, amount, [], {
        skipFightPacing: unpaced === true,
      }),
    mana: (current, amount) => projectMana(current, amount),
    gold: (current, amount) => playerResources.addGoldWithCombatText(current, amount),
    cleanse: (current, amount) => playerResources.removeHarmfulPlayerStatuses(current, amount, []),
    stun: (current, amount) => projectFollowUpHit(current, { source: "player-follow-up", damageType: "stun", amount }),
  };

  function projectBuildup(
    current: BattleState,
    status: Parameters<typeof addEnemyStatus>[1],
    amount: number,
    attackBuildup = true,
  ): BattleState {
    if (status !== "poison") return addEnemyStatus(current, status, amount, { attackBuildup });
    const next = setEnemyStatus(current, status, current.enemyStatuses[status] + amount);
    return amount > 0 && next.gearEffects.poisonArmorShredChance >= 100 ? reduceEnemyArmor(next, 1) : next;
  }

  function projectEnemyHealthLoss(current: BattleState, amount: number): BattleState {
    if (amount <= 0 || current.enemyHealth <= 0 || isPlayerDefeated(current)) return current;
    const hit = damageEnemyHealth(current, amount);
    return processEncounterTraitHealthThreshold(hit.previousHealth, decayEnemyArmor(hit.state), []);
  }

  function projectCcDamage(current: BattleState, type: "physical" | "nature", amount: number): BattleState {
    if (amount <= 0 || getBattleOutcome(current) !== null) return current;
    const { state: sundered, damage: resolved } = prepareScaledEnemyHit(
      current,
      amount,
      type,
      [],
      getEnemyDamageMultiplier(current, type) * (type === "physical" ? gearFrozenDamageMultiplier(current) : 1),
    );
    if (resolved <= 0) return sundered;
    const hit = damageEnemyHealth(sundered, resolved);
    let next = hit.state;
    if (type === "physical" && current.talentEffects.armorOnPhysicalDamageChance >= 100)
      next = playerResources.applyArmorReward(next, hit.healthDamage, []);
    next = decayEnemyArmor(next);
    if (type === "nature") {
      if (current.gearEffects.natureLeechVsPoisoned > 0 && current.enemyStatuses.poison > 0)
        next = projectLeech(next, hit.healthDamage);
      next = resolveNatureManaReward(next, resolved, [], resourceRewards);
      next = resolveLuckyCloverReward(next, hit.healthDamage, [], resourceRewards);
      next = resolveNatureGoldReward(next, hit.healthDamage, [], resourceRewards);
    }
    return processEncounterTraitHealthThreshold(current.enemyHealth, next, []);
  }

  const crowdControlPort: CrowdControlResolutionPort = {
    chance: (chance) => chance >= 100,
    bonuses: (current, bonuses, texts) =>
      resolveCrowdControlBonuses(current, bonuses, texts, {
        // Card identities and empty-draw Wishes are unknown until execution.
        draw: (next) => next,
        block: playerResources.applyBlockReward,
        forge: playerResources.addForgeToPlayer,
        mana: playerResources.gainManaWithCombatText,
      }),
    physical: (current, amount) => projectCcDamage(current, "physical", amount),
    thunderstone: (current) => projectCcDamage(current, "nature", current.trinketEffects.thunderstoneDamageOnStun),
    gold: (current, amount) => playerResources.addGoldWithCombatText(current, amount),
    mana: (current, amount) => projectMana(current, amount, true),
  };

  function projectCc(
    current: BattleState,
    stat: "freeze" | "stun",
    previousHealth: number,
    damage = 0,
    eligibility = current,
    fromHolyDamage = false,
  ): BattleState {
    return stat === "stun"
      ? resolveEnemyStun(current, [], crowdControlPort, previousHealth, fromHolyDamage, damage)
      : resolveEnemyFreeze(eligibility, current, [], crowdControlPort, previousHealth, damage);
  }

  function projectRetaliation(current: BattleState): BattleState {
    while (current.flags.pendingCinderSkinReaction || current.flags.pendingEmberwakeDamage) {
      if (current.flags.pendingCinderSkinReaction) {
        current = projectHostileHit(
          { ...current, flags: { ...current.flags, pendingCinderSkinReaction: false } },
          "burn",
          Math.round(current.roomScalingMultiplier),
        );
      }
      if (current.flags.pendingEmberwakeDamage) {
        current = projectFollowUpHit(
          { ...current, flags: { ...current.flags, pendingEmberwakeDamage: false } },
          {
            source: "player-follow-up",
            damageType: "burn",
            amount: current.gearEffects.burnOnDeathsDoorEntry,
          },
        );
      }
    }
    return current;
  }

  function projectHostileHit(current: BattleState, type: "burn" | "nature", amount: number): BattleState {
    let next = current;
    if (getBattleOutcome(next) !== null) return next;
    const effect = { kind: "damage" as const, damageType: type, amount };
    const prepared = prepareEnemyDamage(next, effect);
    const mitigation = calculateBlockAndArmorMitigation(next, effect, prepared.incomingDamage, [], {});
    next = applyPlayerCombatDamage(next, mitigation.actualDamage, "hostile", type, { ignoreMitigation: true });
    next = {
      ...next,
      playerStatuses: { ...next.playerStatuses, block: Math.max(0, next.playerStatuses.block - mitigation.blockSpent) },
    };
    if (type === "burn") next = addPlayerStatus(next, "burn", mitigation.actualDamage);
    if (mitigation.actualDamage > 0 && next.playerStatuses.armor > 0 && !hasEncounterBenefit(next, "ironclad"))
      next = {
        ...next,
        playerStatuses: {
          ...next.playerStatuses,
          armor: Math.max(0, next.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
        },
      };
    if (current.playerStatuses.armor > 0 && next.playerStatuses.armor === 0 && !isPlayerDefeated(next))
      next = grantPlayerStatus(next, "block", current.talentEffects.armorBreakBlock);
    next = playerResources.checkHealthThresholds(current.playerHealth, next.playerHealth, next, []);
    return playerResources.applyBlockDepletionRewards(
      current,
      next,
      [],
      current.playerStatuses.block > 0 && mitigation.blockSpent >= current.playerStatuses.block,
    );
  }

  function projectWish(current: BattleState, amount: number): BattleState {
    return resolveWishRewards(
      current,
      Math.max(0, Math.round(amount)),
      [],
      {
        chance: (chance) => chance >= 100,
        gold: (next, value) => playerResources.addGoldWithCombatText(next, value),
        heal: (next, value) => projectHealing(next, value),
        cleanse: (next, value) => playerResources.removeHarmfulPlayerStatuses(next, value, []),
        block: (next, value) => grantPlayerStatus(next, "block", value),
        mana: (next, value) => projectMana(next, value, true),
        // The identity of drawn cards is unknown until live resolution.
        draw: (next) => next,
        forge: (next, value) => grantPlayerStatus(next, "forge", value),
        armor: (next, value) => grantPlayerStatus(next, "armor", value),
        hit: projectFollowUpHit,
        burningEnemyHit: (next, value) => projectScaledBurn(next, value),
      },
      { kind: "each-step", settle: projectRetaliation },
    );
  }

  function projectResolvedHit(
    current: BattleState,
    before: BattleState,
    type: DamageEffect["damageType"],
    damage: number,
    isPlayerFollowUp = false,
  ): BattleState {
    if (damage <= 0) return current;
    const hit = damageEnemyHealth(current, damage);
    let next = decayEnemyArmor(hit.state);
    if (type === "burn" || type === "poison" || type === "bleed") {
      next = projectBuildup(next, type, type === "bleed" ? damage * BLEED_STATUS_MULTIPLIER : damage);
      if (type === "burn" && next.talentEffects.burnRemovesEnemyArmor) next = reduceEnemyArmor(next, damage);
      if (type === "poison") {
        if (next.talentEffects.poisonStripArmorByDamage) next = reduceEnemyArmor(next, damage);
        next = resolvePoisonLeechRewards(next, hit.healthDamage, [], {
          chance: resourceRewards.chance,
          leech: (current, amount) => projectLeech(current, amount),
        });
      }
      if (type === "burn" || type === "bleed") {
        next = projectLeechBase(
          next,
          burnBleedLeechAmount(before, damage, before.enemyStatuses.burn > 0 && before.enemyStatuses.bleed > 0),
        );
      }
    }
    if (type === "freeze" || type === "stun") {
      next = projectBuildup(next, type, damage);
      next = projectCc(next, type, before.enemyHealth, hit.healthDamage, before);
    }
    if (
      hit.healthDamage > 0 &&
      next.mana < next.maxMana &&
      next.gearEffects.elementalDamageManaChance >= 100 &&
      (type === "burn" || type === "freeze" || type === "holy")
    )
      next = projectMana(next, 1, true);
    next = processEncounterTraitHealthThreshold(before.enemyHealth, next, []);
    if (type === "burn" && (!isPlayerFollowUp || hit.healthDamage > 0) && before.enemyStatuses.burn === 0) {
      const forge = before.gearEffects.forgeOnBurnVsUnburnedChances.filter((chance) => chance >= 100).length;
      next = grantPlayerStatus(next, "forge", forge);
    }
    return next;
  }

  function projectFollowUpHit(current: BattleState, request: FollowUpHitRequest): BattleState {
    if (request.amount <= 0 || current.enemyHealth <= 0 || isPlayerDefeated(current)) return current;
    return resolveSecondaryAction(current, "reward", (next) => {
      if (request.source !== "player-follow-up") {
        const hit = computeTalentDamageToEnemy(next, request.damageType, request.amount, request.source);
        return projectResolvedHit(hit.state, next, request.damageType, hit.remainingDamage);
      }
      const hit = computeCardDamageToEnemy(
        next,
        { kind: "damage", damageType: request.damageType, amount: request.amount },
        undefined,
        undefined,
        "prepared-only",
      );
      return projectResolvedHit(hit.nextState, next, request.damageType, hit.modifiedDamage, true);
    });
  }

  function projectScaledBurn(current: BattleState, amount: number): BattleState {
    const hit = prepareScaledEnemyHit(
      current,
      amount,
      "burn",
      [],
      getEnemyDamageMultiplier(current, "burn") * gearFrozenDamageMultiplier(current),
    );
    return projectResolvedHit(hit.state, current, "burn", hit.damage);
  }

  function attack(
    effect: DamageEffect,
    current: BattleState,
    forgeTriggers: Set<string>,
  ): { effect: DamageEffect; state: BattleState; followUp?: DamageEffect } {
    if (!enemy && (isPlayerDefeated(current) || current.enemyHealth <= 0))
      return { effect: flatAttack(effect, 0), state: current };
    const selected = resolveConditionalCardDamage(
      effect,
      (enemy ? current.playerCC : current.enemyCC).freezeSkipTurns > 0,
    );
    if (enemy) {
      const prepared = prepareEnemyAbilityDamage(current, selected, current.flags.enemyBrawlerDamagePenalty);
      const power = prepareEnemyDamage(current, prepared.damage, {
        amountMultiplier: prepared.amountMultiplier,
        flatBonus: prepared.flatBonus,
        ignorePlayerMitigation: true,
      }).attemptedDamage;
      return {
        effect: flatAttack(selected, power),
        state:
          prepared.banditBonus && power > 0
            ? { ...current, flags: { ...current.flags, enemyFirstHitDoubleUsed: true } }
            : current,
      };
    }
    const consumed = consumeAttackPacketFlags(current, {
      ...selected,
      amount: applyPotionMultiplier(selected.amount, potionMult),
    });
    const armorBonus =
      consumed.packet.damageType === "stun" && current.gearEffects.armorIncreasesStun > 0
        ? current.enemyMitigation.armor
        : 0;
    const baseDamageBonus = consumed.packet.damageType === "physical" ? consumed.physicalBonus : 0;
    if (armorBonus <= 0 && computeBaseDamage(consumed.state, consumed.packet, { card, bonus: baseDamageBonus }) <= 0)
      return { effect: flatAttack(consumed.packet, 0), state: current };
    const shatter =
      consumed.packet.damageType === "physical" &&
      canShatter(consumed.state) &&
      computeCardAttackPower(consumed.state, consumed.packet, card, { origin: "played-card", baseDamageBonus }).damage >
        0;
    const shatterDamage = shatter ? consumed.state.reactions.shatterDamage : 0;
    const damageState = shatter ? applyShatter(consumed.state, []) : consumed.state;
    const power = computeCardAttackPower(
      damageState,
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
    // Display offensive power, but advance the known, nonrandom hit facts for
    // later effects. Defenses can prevent buildup and Leech even though the
    // tooltip deliberately shows the packet before those defenses.
    const resolved = computeCardDamageToEnemy(
      damageState,
      consumed.packet,
      card,
      {
        manaAtStart: consumed.state.mana,
        origin: "played-card",
        baseDamageBonus,
        guaranteedCrit,
      },
      "prepared-only",
    );
    let after = resolved.nextState;
    if (after.gearEffects.attackPurgeOncePerTurn > 0 && !after.uniqueGear.wardbreakerPurgeUsed) {
      const purged = purgeEnemyBenefits(after, 1, []);
      if (purged.removed > 0) {
        after = { ...purged.state, uniqueGear: { ...purged.state.uniqueGear, wardbreakerPurgeUsed: true } };
        after = grantPlayerStatus(after, "block", after.gearEffects.blockOnPurge);
        if (after.gearEffects.holyOnPurge > 0) {
          after = resolveSecondaryAction(after, "reward", (secondary) => {
            const hit = computeCardDamageToEnemy(
              secondary,
              { kind: "damage", damageType: "holy", amount: secondary.gearEffects.holyOnPurge },
              undefined,
              undefined,
              "prepared-only",
            );
            return projectEnemyHealthLoss(hit.nextState, hit.modifiedDamage);
          });
          after = projectRetaliation(after);
        }
      }
    }
    const damage = getBattleOutcome(after) === null ? resolved.modifiedDamage : 0;
    const healthDamage = Math.min(current.enemyHealth, damage);
    if (damage > 0) {
      after = damageEnemyHealth(after, damage).state;
      after = decayEnemyArmor(after);
      const type = consumed.packet.damageType;
      if (type === "burn" || type === "poison" || type === "bleed") {
        const beforeStacks = after.enemyStatuses[type];
        after = projectBuildup(after, type, type === "bleed" ? damage * BLEED_STATUS_MULTIPLIER : damage);
        const addedStacks = after.enemyStatuses[type] - beforeStacks;
        if (
          (type === "burn" && after.talentEffects.burnRemovesEnemyArmor) ||
          (type === "poison" && after.talentEffects.poisonStripArmorByDamage)
        )
          after = reduceEnemyArmor(after, damage);
        if (type === "poison")
          after = resolvePoisonLeechRewards(after, healthDamage, [], {
            chance: resourceRewards.chance,
            leech: (current, amount) => projectLeech(current, amount),
          });
        if (type === "bleed" && after.talentEffects.bleedHalveArmorChance >= 100)
          after = reduceEnemyArmor(after, after.enemyMitigation.armor - halveRounded(after.enemyMitigation.armor));
        if (type === "burn" || type === "bleed") {
          after = projectLeechBase(
            after,
            burnBleedLeechAmount(current, damage, current.enemyStatuses.burn > 0 && current.enemyStatuses.bleed > 0),
          );
          if (type === "bleed") after = resolveBleedGoldReward(after, addedStacks, [], resourceRewards);
        }
      }
      if (type === "holy" && after.gearEffects.holyStunBuildupGold > 0) {
        after = addEnemyStatus(after, "stun", damage);
        after = projectCc(after, "stun", current.enemyHealth, healthDamage, current, true);
      }
      if (type === "freeze" || type === "stun") {
        after = addEnemyStatus(after, type, damage);
        if (type === "freeze" && after.gearEffects.freezeGrantsBlockAndMana > 0 && current.playerStatuses.block === 0)
          after = playerResources.applyBlockReward(after, damage, [], { skipFightPacing: true });
        after = projectCc(after, type, current.enemyHealth, healthDamage, current);
      }
    }
    // Detonation consumes existing buildup even when defenses absorb the hit.
    for (const status of ["burn", "bleed"] as const) {
      if (
        after.enemyHealth > 0 &&
        ((status === "burn" && consumed.packet.detonateAllBurn) ||
          (status === "bleed" && consumed.packet.detonateAllBleed))
      ) {
        const detonated = projectEnemyDotDamage(after, status);
        after = setEnemyStatus(after, status, 0);
        after = projectEnemyHealthLoss(after, detonated);
      }
    }
    if (damage > 0) {
      const type = consumed.packet.damageType;
      if (type === "burn" && current.enemyStatuses.burn === 0 && !forgeTriggers.has("emberforged")) {
        forgeTriggers.add("emberforged");
        const forge = current.gearEffects.forgeOnBurnVsUnburnedChances.filter((chance) => chance >= 100).length;
        after = grantPlayerStatus(after, "forge", forge);
      }
      if (
        type === "physical" &&
        after.talentEffects.physicalStripArmorByForge &&
        current.playerStatuses.forge > 0 &&
        !forgeTriggers.has("sunder")
      ) {
        forgeTriggers.add("sunder");
        after = reduceEnemyArmor(after, Math.round(current.playerStatuses.forge * 0.5));
      }
      const explicitLeech = consumed.packet.lifesteal === true;
      const physicalLeech =
        type === "physical" &&
        current.playerHealth * 2 < current.playerMaxHealth &&
        current.gearEffects.physicalLeechBelowHalfHealth > 0;
      if (explicitLeech || physicalLeech)
        after = projectLeech(after, type === "poison" ? healthDamage : damage, explicitLeech);
      if (type === "holy") {
        if (
          !explicitLeech &&
          current.playerHealth * 2 < current.playerMaxHealth &&
          after.talentEffects.holyLifestealPercent > 0
        )
          after = projectLeech(after, damage, false, after.talentEffects.holyLifestealPercent);
        if (after.gearEffects.oathkeeperHolyAndBlock > 0 && !forgeTriggers.has("oathkeeper")) {
          forgeTriggers.add("oathkeeper");
          after = grantPlayerStatus(after, "block", 1);
        }
        if (healthDamage > 0 && current.playerStatuses.block === 0)
          after = grantPlayerStatus(after, "block", after.gearEffects.blockOnHolyHitWithoutBlock);
        after = resolveHolyBlockReward(after, healthDamage, [], resourceRewards);
        after = resolveHolyGoldReward(after, healthDamage, [], resourceRewards);
      }
      if (type === "nature") {
        after = resolveLuckyCloverReward(after, healthDamage, [], resourceRewards);
        after = resolveNatureGoldReward(after, healthDamage, [], resourceRewards);
        after = resolveNatureManaReward(after, damage, [], resourceRewards);
        after = resolveNatureRestorationRewards(
          after,
          { resolvedDamage: damage, healthDamage, eligibility: current },
          [],
          {
            ...resourceRewards,
            // Nature healing is ordinary healing; Leech keeps its own scaling and pacing.
            heal: (current, amount) => projectHealing(current, amount),
            armor: playerResources.applyArmorReward,
            leech: (current, amount) => projectLeech(current, amount),
          },
          explicitLeech,
        );
      }
      if (
        healthDamage > 0 &&
        after.mana < after.maxMana &&
        after.gearEffects.elementalDamageManaChance >= 100 &&
        (type === "burn" || type === "freeze" || type === "holy")
      )
        after = projectMana(after, 1, true);
    }
    after = processEncounterTraitHealthThreshold(current.enemyHealth, after, []);
    const payoffs = getPostHitReactionPayoffs(current, after, consumed.packet.damageType, healthDamage);
    if (
      damage > 0 &&
      after.enemyHealth > 0 &&
      consumed.packet.damageType !== "physical" &&
      consumed.physicalBonus > 0
    ) {
      after = projectFollowUpHit(after, {
        source: "player-follow-up",
        damageType: "physical",
        amount: consumed.physicalBonus,
      });
    }
    if (getBattleOutcome(after) === null && after.enemyStatuses.thorns > 0) {
      const legacy = after.flags.legacyEnemyThornsReady ? 1 : 0;
      const thorns = Math.max(0, after.enemyStatuses.thorns - legacy);
      if (thorns > 0) after = projectHostileHit(setEnemyStatus(after, "thorns", legacy), "nature", thorns);
    }
    after = projectRetaliation(after);
    after = projectEnemyHealthLoss(after, shatterDamage);
    for (const payoff of payoffs) {
      if (getBattleOutcome(after) !== null) break;
      after = projectRetaliation(projectEnemyHealthLoss(consumeReactionOpportunity(after, payoff.id), payoff.damage));
    }
    return {
      effect: flatAttack(consumed.packet, power.damage + armorBonus),
      state: projectRetaliation(after),
      ...(followUp ? { followUp } : {}),
    };
  }

  const utilityHandlers = createCardUtilityHandlers({
    heal: (current, amount, _texts, cardHealing) => projectHealing(current, amount, cardHealing),
    mana: (current, amount, _texts, allowOverflow) =>
      playerResources.gainManaWithCombatText(current, amount, [], { allowOverflow }),
    manaHealing: (current, gained) => playerResources.applyHealOnManaGain(current, gained, []),
    healthCost: (current, amount) => {
      const damaged = applyPlayerCombatDamage(current, amount, "self", "health", { ignoreMitigation: true });
      return playerResources.checkHealthThresholds(current.playerHealth, damaged.playerHealth, damaged, []);
    },
    crystalLoss: (current, amount) =>
      projectFollowUpHit(current, { source: "talent-fixed", damageType: "burn", amount }),
    status: (current, effect) =>
      effect.status === "forge" || effect.status === "block" || effect.status === "armor"
        ? grantPlayerStatus(current, effect.status, effect.amount)
        : playerResources.addPlayerStatusWithCombatText(current, effect.status, effect.amount, [], {
            skipFightPacing: true,
          }),
    // A random status is unknown; do not choose one during inspection.
    chooseStatus: () => undefined,
    cleanse: (current, amount) => playerResources.removeHarmfulPlayerStatuses(current, amount, []),
    cleanseStatus: (current, status) =>
      current.playerStatuses[status] > 0
        ? playerResources.applyCleanseHeals(setPlayerStatus(current, status, 0), [], 1)
        : current,
    gold: (current, amount) => playerResources.addGoldWithCombatText(current, amount),
    summon: (current) => {
      current = grantPlayerStatus(current, "block", current.gearEffects.blockOnCompanionSummon);
      return hasEncounterBenefit(current, "eager-pack") ? projectCompanionUtility(current, 2) : current;
    },
  });

  const companionPort: CompanionResolutionPort = {
    chance: (chance) => chance >= 100,
    afterAction: (next) => projectRetaliation(next),
    forge: (next, amount) => grantPlayerStatus(next, "forge", amount),
    heal: (next, amount) => projectHealing(next, amount),
    stun: (next, amount) => projectFollowUpHit(next, { source: "talent-derived", damageType: "stun", amount }),
    leech: (next, damage) => projectLeech(next, damage),
    mana: (next, amount) => projectMana(next, amount),
    settle: projectRetaliation,
  };

  function projectCompanionUtility(current: BattleState, actions: number): BattleState {
    for (let action = 0; action < actions; action++) {
      current = resolveCompanionAction(current, [], projectCompanionEffects, companionPort);
    }
    return current;
  }

  function projectCompanionEffects(
    current: BattleState,
    companionCard: BattleCard,
    _texts: CombatTextEvent[],
    context?: CardEffectResolutionContext,
  ): BattleState {
    for (const effect of companionCard.effects) {
      if (getBattleOutcome(current) !== null) break;
      if (effect.kind === "damage") {
        const types = effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType];
        const bonus = context?.companionAttackBonus?.amount ?? 0;
        if (context?.companionAttackBonus) context.companionAttackBonus.amount = 0;
        const outcomes = types.map((damageType) => {
          const hit = computeCardDamageToEnemy(
            current,
            { ...effect, damageType },
            companionCard,
            {
              ...context,
              manaAtStart: context?.manaAtStart ?? current.mana,
              baseDamageBonus: bonus,
            },
            "prepared-only",
          );
          return {
            state: projectResolvedHit(hit.nextState, current, damageType, hit.modifiedDamage),
            healthDamage: Math.min(current.enemyHealth, hit.modifiedDamage),
          };
        });
        context?.damageEffects?.push(effect);
        const firstOutcome = outcomes[0];
        if (firstOutcome && outcomes.every((outcome) => outcome.healthDamage === firstOutcome.healthDamage))
          context?.onDamageDealt?.(firstOutcome.healthDamage);
        current = mergeKnownOutcomes(
          current,
          outcomes.map((outcome) => outcome.state),
        );
      }
      current = applyCardUtilityEffect(utilityHandlers, current, companionCard, effect, 1, [], context) ?? current;
      current = projectRetaliation(current);
    }
    return current;
  }

  function mergeKnownOutcomes(current: BattleState, outcomes: BattleState[]): BattleState {
    const first = outcomes[0];
    if (!first) return current;
    if (outcomes.length === 1) return first;
    for (const field of ["mana", "gold", "playerHealth", "enemyHealth"] as const) {
      if (outcomes.every((outcome) => outcome[field] === first[field])) current = { ...current, [field]: first[field] };
    }
    for (const field of [
      "flags",
      "playerStatuses",
      "enemyStatuses",
      "enemyMitigation",
      "uniqueGear",
      "reactions",
      "enemyCC",
    ] as const) {
      const shared = Object.entries(first[field]).every(([key, value]) =>
        outcomes.every((outcome) => (outcome[field] as Record<string, unknown>)[key] === value),
      );
      if (shared) current = { ...current, [field]: first[field] };
    }
    return current;
  }

  const projectedSources = new Map<BattleCardEffect, BattleCardEffect>();
  function project(
    effects: readonly BattleCardEffect[],
    initial: BattleState,
    forgeTriggers = new Set<string>(),
  ): { effects: BattleCardEffect[]; state: BattleState } {
    let current = initial;
    const projected = effects.flatMap((effect): BattleCardEffect | BattleCardEffect[] => {
      if (effect.kind === "chance") {
        const successTriggers = new Set(forgeTriggers);
        const failureTriggers = new Set(forgeTriggers);
        const success = project(effect.successEffects, current, successTriggers);
        const failure = project(effect.failureEffects, current, failureTriggers);
        const certain = effect.probability === 1 ? success : effect.probability === 0 ? failure : null;
        current = certain ? certain.state : mergeKnownOutcomes(current, [success.state, failure.state]);
        const triggers = effect.probability === 0 ? failureTriggers : successTriggers;
        for (const trigger of triggers) {
          if (certain || failureTriggers.has(trigger)) forgeTriggers.add(trigger);
        }
        return { ...effect, successEffects: success.effects, failureEffects: failure.effects };
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
          amounts.map((amount) => {
            const triggers = new Set(forgeTriggers);
            return {
              ...attack({ ...effect, kind: "damage", damageType, amount }, current, triggers),
              forgeTriggers: triggers,
            };
          }),
        );
        const first = outcomes[0];
        if (first) {
          for (const trigger of first.forgeTriggers) {
            if (outcomes.every((outcome) => outcome.forgeTriggers.has(trigger))) forgeTriggers.add(trigger);
          }
        }
        // Retain only facts shared by every possible packet. In particular,
        // a range's first endpoint cannot choose later Health or buildup.
        current = mergeKnownOutcomes(
          current,
          outcomes.map((outcome) => outcome.state),
        );
        const summarize = (packets: DamageEffect[]): BattleCardEffect => {
          const firstPacket = packets[0];
          if (!firstPacket) return { kind: "damage", damageType: "physical", amount: 0 };
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
        const primaryProjected = summarize(outcomes.map((outcome) => outcome.effect));
        const projected = [primaryProjected];
        projectedSources.set(primaryProjected, effect);
        if (outcomes.some((outcome) => outcome.followUp))
          projected.push(
            summarize(
              outcomes.map((outcome) => outcome.followUp ?? { kind: "damage", damageType: "physical", amount: 0 }),
            ),
          );
        return projected;
      }
      if (!enemy && effect.kind === "self-damage") {
        const damage = mitigatePlayerStatusDamage(current, effect.amount, effect.damageType);
        const before = current;
        current = applyPlayerCombatDamage(current, damage, "self", effect.damageType, { ignoreMitigation: true });
        current = addPlayerStatus(current, effect.damageType, playerHealthLostToDamage(before, current));
        if (damage > 0 && current.playerStatuses.armor > 0 && !hasEncounterBenefit(current, "ironclad")) {
          const armor = Math.max(0, current.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
          current = { ...current, playerStatuses: { ...current.playerStatuses, armor } };
          if (armor === 0 && !isPlayerDefeated(current))
            current = grantPlayerStatus(current, "block", current.talentEffects.armorBreakBlock);
        }
        current = playerResources.checkHealthThresholds(before.playerHealth, current.playerHealth, current, []);
      }
      if (!enemy && effect.kind === "cleanse-player-status-to-damage") {
        const stacks = current.playerStatuses[effect.status];
        current = setPlayerStatus(current, effect.status, 0);
        if (stacks > 0) current = playerResources.applyCleanseHeals(current, [], 1);
        const converted = attack(
          {
            kind: "damage",
            damageType: effect.damageType,
            amount: stacks,
            ...(effect.lifesteal ? { lifesteal: true } : {}),
          },
          current,
          forgeTriggers,
        );
        current = converted.state;
        return [
          { kind: "remove-player-status", status: effect.status },
          stacks > 0 ? converted.effect : flatAttack(converted.effect, 0),
        ];
      }
      if (!enemy && effect.kind === "multiply-enemy-status") {
        const before = current;
        current = projectBuildup(
          current,
          effect.status,
          Math.round(current.enemyStatuses[effect.status] * (effect.factor - 1)),
          false,
        );
        if (effect.status === "freeze" || effect.status === "stun")
          current = projectCc(current, effect.status, before.enemyHealth);
      }
      if (!enemy && effect.kind === "companion-action")
        current = projectCompanionUtility(current, applyPotionMultiplier(effect.amount, potionMult));
      if (!enemy && effect.kind === "wish" && (!effect.companionIfAbsent || !current.activeCompanion))
        current = projectWish(current, applyPotionMultiplier(effect.amount, potionMult));
      if (!enemy) {
        // Critical power is deliberately excluded from inspection. Leech and other
        // armed utility effects still change guaranteed facts before later hits.
        if (effect.kind !== "next-hit-crit")
          current =
            applyCardUtilityEffect(utilityHandlers, current, card, effect, potionMult, [], {
              origin: "played-card",
              manaAtStart: snapshot.mana,
            }) ?? current;
      }
      if (enemy && effect.kind === "player-status" && ["forge", "block", "armor"].includes(effect.status)) {
        current = addEnemyMitigationWithCombatText(
          current,
          effect.status as "forge" | "block" | "armor",
          Math.round(effect.amount * current.roomScalingMultiplier),
          [],
        );
      }
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
      if (!enemy) current = projectRetaliation(current);
      return effect;
    });
    return { effects: projected, state: current };
  }

  const effects = project(card.effects, state).effects;
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
