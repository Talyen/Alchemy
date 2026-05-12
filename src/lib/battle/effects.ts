// Card-effect resolver for battle: damage, status, healing, wish, companions, and rewards.
// Depends on immutable battle state, draw helpers, game data, and combat constants.
// Called by turn sequencing and companion logic whenever a card-like effect resolves.
import { ailmentStatusIds, cardLibrary, companionLibrary, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { drawCards, shuffleCards } from "./draw";

import {
  clampHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { BLEED_EXECUTE_MULTIPLIER, BLEED_STATUS_MULTIPLIER, CRIT_MULTIPLIER, FREE_CARD_SENTINEL, FREEZE_THRESHOLD_FRACTION, GLOBAL_CRIT_CHANCE, MIN_MAX_MANA_FLOOR, STUN_THRESHOLD_FRACTION, WISH_CHOICE_COUNT } from "../game-constants";

// Deduplicates combat text events by (target, kind, stat) so that three separate
// "physical damage" events from one card become a single "-15" instead of "-5 -5 -5".
// This is purely a display concern — amounts are accumulated in place.
export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  const existingEvent = combatTexts.find(
    (event) => event.target === nextEvent.target && event.kind === nextEvent.kind && event.stat === nextEvent.stat,
  );

  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }

  combatTexts.push(nextEvent);
}

// All additive and multiplicative pre-defense bonuses meet here so crits, armor,
// enemy traits, and status riders all see the same authored damage number.
// Forge only leaks into burn/holy when talents say so; otherwise it remains physical tech.
function computeBaseDamage(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const isBurn = effect.damageType === "burn";
  const isHoly = effect.damageType === "holy";

  let forgeBonus = 0;
  if (isPhysicalOrStun) forgeBonus = state.playerStatuses.forge;
  if (isBurn && state.talentEffects.forgeToBurn) forgeBonus = state.playerStatuses.forge;
  if (isHoly && state.talentEffects.forgeToHoly) forgeBonus = state.playerStatuses.forge;

  let rawAmount = effect.fromBlock ? state.playerStatuses.block : effect.amount + forgeBonus;

  if (effect.damageType === "physical") {
    rawAmount += state.talentEffects.flatPhysicalDamage;
    if (state.talentEffects.armorToPhysicalDamage) {
      rawAmount += state.playerStatuses.armor;
    }
    if (state.talentEffects.blockToPhysicalDamage) {
      rawAmount += Math.floor(state.playerStatuses.block / 2);
    }
    if (state.enemyStunSkipTurns > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.physicalVsStunnedMultiplier / 100));
    }
    if (state.enemyFreezeSkipTurns > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.physicalVsFrozenMultiplier / 100));
    }
    if (state.enemyStatuses.poison > 0) {
      rawAmount += state.talentEffects.poisonPhysicalBonus;
    }
    if (state.enemyStatuses.bleed > 0) {
      rawAmount += state.talentEffects.bleedPhysicalBonus + state.talentEffects.bleedPhysicalTakenBonus;
    }
  }

  if (effect.damageType === "holy") {
    rawAmount += Math.floor(state.gold * state.talentEffects.holyGoldPercent / 100);
    rawAmount += Math.floor(state.playerStatuses.block * state.talentEffects.holyBlockPercent / 100);
    if (state.enemyStatuses.burn > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.holyVsBurnMultiplier / 100));
    }
  }

  if (effect.damageType === "bleed") {
    if (state.playerHealth <= state.playerMaxHealth / 2 && state.talentEffects.bleedDesperateMultiplier > 1) {
      rawAmount = Math.floor(rawAmount * state.talentEffects.bleedDesperateMultiplier);
    }
    if (state.enemyHealth <= state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold / 100) {
      rawAmount = Math.floor(rawAmount * BLEED_EXECUTE_MULTIPLIER);
    }
  }

  return Math.max(0, rawAmount);
}

// All damage has a flat 5% crit chance (doubles damage). Physical damage gets
// an additional chance from the physical-crit talent.
function applyCrit(damage: number, damageType: string, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const isCrit = totalChance > 0 && Math.random() * 100 < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

// Lifesteal with heal multiplier support.
function applyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;
  const healAmount = Math.floor(damage * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, playerHealth: clampHealth(state.playerHealth, healAmount, state.playerMaxHealth) };
}

// Holy lifesteal: heals for a percentage of holy damage dealt.
function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = Math.floor(damage * state.talentEffects.holyLifestealPercent / 100 * state.talentEffects.healMultiplier);
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, playerHealth: clampHealth(state.playerHealth, healAmount, state.playerMaxHealth) };
}

// Grants block equal to a percentage of damage dealt.
function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.floor(damage * state.talentEffects.holyBlockPercentFromDamage / 100);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockAmount });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block + blockAmount,
    },
  };
}

// Damage-type riders happen after actual post-defense damage is known. This lets stun
// and freeze thresholds scale with meaningful damage dealt, while burn/poison/bleed
// stacks cannot be inflated by attacks fully absorbed by armor or enemy traits.
function applyDamageStatuses(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, actualDamage: number, combatTexts: CombatTextEvent[]) {
  const nextStatuses = { ...state.enemyStatuses };
  let nextState: BattleState = { ...state, enemyStatuses: nextStatuses };

  switch (effect.damageType) {
    case "burn": {
      nextStatuses.burn += actualDamage;
      if (nextState.talentEffects.burnRemovesEnemyArmor) {
        nextState = { ...nextState, enemyArmor: Math.max(0, nextState.enemyArmor - actualDamage) };
      }
      break;
    }
    case "poison": {
      nextStatuses.poison += actualDamage;
      if (actualDamage > 0 && nextState.talentEffects.goldOnFirstPoison > 0 && !nextState.flags.goldOnFirstPoisonThisCombat) {
        nextState = {
          ...nextState,
          gold: nextState.gold + nextState.talentEffects.goldOnFirstPoison,
          flags: { ...nextState.flags, goldOnFirstPoisonThisCombat: true },
        };
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnFirstPoison });
      }
      break;
    }
    case "bleed": {
      const bleedAmount = actualDamage * BLEED_STATUS_MULTIPLIER;
      nextStatuses.bleed += bleedAmount;
      if (bleedAmount > 0 && effect.lifesteal) nextStatuses.bleedLeech += bleedAmount;
      if (bleedAmount > 0 && nextState.talentEffects.bleedLeechChance > 0 && Math.random() * 100 < nextState.talentEffects.bleedLeechChance) {
        nextStatuses.bleedLeech += bleedAmount;
      }
      if (actualDamage > 0 && nextState.talentEffects.bleedPoisonChance > 0 && Math.random() * 100 < nextState.talentEffects.bleedPoisonChance) {
        nextStatuses.poison += actualDamage;
      }
      // Cutpurse Knife: gain gold when applying bleed
      if (bleedAmount > 0 && nextState.trinketEffects.cutpurseGoldOnBleed > 0) {
        nextState = {
          ...nextState,
          gold: nextState.gold + nextState.trinketEffects.cutpurseGoldOnBleed,
          enemyStatuses: nextStatuses,
        };
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.cutpurseGoldOnBleed });
      }
      break;
    }
    case "stun": {
      nextStatuses.stun += actualDamage;
      const threshold = STUN_THRESHOLD_FRACTION - nextState.talentEffects.stunThresholdReduction;
      if (state.enemyHealth > 0 && nextStatuses.stun > state.enemyHealth * threshold) {
        nextStatuses.stun = 0;
        nextState = { ...nextState, enemyStatuses: nextStatuses, enemyStunSkipTurns: nextState.enemyStunSkipTurns + 1 + nextState.talentEffects.stunDurationExtension };
        if (nextState.talentEffects.drawOnStun > 0) {
          const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, nextState.talentEffects.drawOnStun, nextState.nextCardUid);
          nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
        }
        if (nextState.talentEffects.nextCardFreeOnStun) {
          nextState = { ...nextState, flags: { ...nextState.flags, nextCardCostReduction: FREE_CARD_SENTINEL } };
        }
        return nextState;
      }
      break;
    }
    case "freeze": {
      nextStatuses.freeze += actualDamage;
      if (state.enemyHealth > 0 && nextStatuses.freeze >= state.enemyHealth * FREEZE_THRESHOLD_FRACTION) {
        nextStatuses.freeze = 0;
        return { ...nextState, enemyStatuses: nextStatuses, enemyFreezeSkipTurns: nextState.enemyFreezeSkipTurns + 1 };
      }
      break;
    }
  }

  return nextState;
}

// Applies enemy-specific damage multipliers from traits (e.g. vulnerabilities, resistances).
export function getEnemyDamageMultiplier(state: BattleState, damageType: string): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  if (traitIds.includes("brittle-bones") && (damageType === "holy" || damageType === "stun")) return 2;
  if (traitIds.includes("fear-the-light") && (damageType === "burn" || damageType === "holy")) return 2;
  if (traitIds.includes("holy-vulnerability") && damageType === "holy") return 2;
  if (traitIds.includes("burn-resistance") && damageType === "burn") return 0.5;
  if (traitIds.includes("poison-resistance") && damageType === "poison") return 0.5;
  return 1;
}

// Full enemy damage is an ordering contract for balance: base bonuses and one-shot
// boosts happen before crit, armor and traits reduce the final hit, then health changes
// unlock death/trinket/status/lifesteal side effects before the visible damage text emits.
function dealEnemyDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  let rawDamage = computeBaseDamage(state, effect);

  // First burn card doubled (talent)
  if (effect.damageType === "burn" && state.talentEffects.firstBurnCardDoubled && !state.flags.firstBurnCardDoubledUsed) {
    rawDamage *= 2;
    state = { ...state, flags: { ...state.flags, firstBurnCardDoubledUsed: true } };
  }

  // First burn doubled (Meteorite trinket)
  if (effect.damageType === "burn" && state.trinketEffects.firstBurnDoubled && !state.flags.firstBurnTrinketDoubledUsed) {
    rawDamage *= 2;
    state = { ...state, flags: { ...state.flags, firstBurnTrinketDoubledUsed: true } };
  }

  // First holy damage bonus (Brass Censer trinket)
  if (effect.damageType === "holy" && state.trinketEffects.firstHolyDamageBonus > 0 && !state.flags.firstHolyDamageBonusUsed) {
    rawDamage += state.trinketEffects.firstHolyDamageBonus;
    state = { ...state, flags: { ...state.flags, firstHolyDamageBonusUsed: true } };
  }

  const finalDamage = applyCrit(rawDamage, effect.damageType, state);

  // Sundering Charm: Physical attacks ignore N enemy armor
  const effectiveArmor = effect.damageType === "physical"
    ? Math.max(0, state.enemyArmor - state.trinketEffects.sunderingArmorPiercing)
    : state.enemyArmor;

  const damageAfterArmor = Math.max(0, finalDamage - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(state, effect.damageType);
  const modifiedDamage = Math.floor(damageAfterArmor * multiplier);

  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -modifiedDamage, state.enemyMaxHealth),
  };

  // Bone Charm: heal on kill
  nextState = applyBoneCharmHeal(nextState, state.enemyHealth > 0, combatTexts);

  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts);

  // Obsidian Hammer: 4+ forge → physical attacks stun
  if (effect.damageType === "physical" && nextState.trinketEffects.forgeStunThreshold > 0 && nextState.playerStatuses.forge >= nextState.trinketEffects.forgeStunThreshold) {
    nextState = {
      ...nextState,
      enemyStatuses: { ...nextState.enemyStatuses, stun: nextState.enemyStatuses.stun + nextState.trinketEffects.forgeStunAmount },
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: nextState.trinketEffects.forgeStunAmount });
  }

  if (effect.lifesteal) {
    nextState = applyLifesteal(nextState, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "holy") {
    nextState = applyHolyLifesteal(nextState, modifiedDamage, combatTexts);
    nextState = applyDamageBlock(nextState, modifiedDamage, combatTexts);

    if (nextState.talentEffects.holyBurnChance > 0 && Math.random() * 100 < nextState.talentEffects.holyBurnChance) {
      nextState = {
        ...nextState,
        enemyStatuses: { ...nextState.enemyStatuses, burn: nextState.enemyStatuses.burn + modifiedDamage },
      };
    }

    if (nextState.talentEffects.holyWishChance > 0 && Math.random() * 100 < nextState.talentEffects.holyWishChance) {
      nextState = { ...nextState, wishOptions: shuffleCards(cardLibrary).slice(0, WISH_CHOICE_COUNT) };
    }
  }

  // Mimic trait: gain 1 gold each time you deal damage to it.
  if (nextState.currentEnemy.traits.some((t) => t.id === "gold-trove") && modifiedDamage > 0) {
    const goldAmount = 1;
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: goldAmount });
    nextState = { ...nextState, gold: nextState.gold + goldAmount };
  }

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  return nextState;
}

// Ailment removal is deterministic by ailmentStatusIds order, not random. That makes
// save/replay behavior predictable and lets trinket rewards attach to exactly one removal.
function removePlayerAilments(state: BattleState, mode: "one" | "all", combatTexts?: CombatTextEvent[]) {
  const nextPlayerStatuses = { ...state.playerStatuses };
  let removed = false;

  if (mode === "all") {
    for (const statusId of ailmentStatusIds) {
      if (nextPlayerStatuses[statusId] > 0) removed = true;
      nextPlayerStatuses[statusId] = 0;
    }
  } else {
    const firstAilment = ailmentStatusIds.find((statusId) => nextPlayerStatuses[statusId] > 0);
    if (firstAilment) {
      nextPlayerStatuses[firstAilment] = 0;
      removed = true;
    }
  }

  let nextState = {
    ...state,
    playerStatuses: nextPlayerStatuses,
  };

  // Sin-Eater's Lantern: gain gold when removing an ailment
  if (removed && nextState.trinketEffects.sinEaterGoldOnAilmentRemove > 0) {
    nextState = {
      ...nextState,
      gold: nextState.gold + nextState.trinketEffects.sinEaterGoldOnAilmentRemove,
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.sinEaterGoldOnAilmentRemove });
    }
  }

  return nextState;
}

// Wish excludes the card that created it to avoid self-looping. Undiscovered bias only
// takes over when enough choices exist, so the player still receives a full offer set.
function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount = WISH_CHOICE_COUNT + (Math.random() * 100 < state.talentEffects.wishExtraChoiceChance ? 1 : 0);

  let candidates = cardLibrary.filter((candidate) => candidate.id !== card.id);

  if (state.talentEffects.wishUndiscoveredCards && state.discoveredCardIds.length > 0) {
    const undiscovered = candidates.filter((c) => !state.discoveredCardIds.includes(c.id));
    if (undiscovered.length >= baseCount) {
      candidates = undiscovered;
    }
  }

  return shuffleCards(candidates).slice(0, baseCount);
}

function applyPlayerStatusEffect(state: BattleState, effect: Extract<BattleCardEffect, { kind: "player-status" }>, combatTexts: CombatTextEvent[]) {
  // Status gains can cross talent thresholds, so armor/forge/block side effects resolve
  // before the final increment is written and shown to the player.
  let amount = effect.amount;

  if (effect.status === "armor") {
    if (state.talentEffects.armorDoubledBelowHalfHealth && state.playerHealth <= state.playerMaxHealth / 2) {
      amount *= 2;
    }
    if (state.talentEffects.firstArmorCardDoubled && !state.flags.firstArmorCardDoubledUsed) {
      amount *= 2;
      state = { ...state, flags: { ...state.flags, firstArmorCardDoubledUsed: true } };
    }
    const newArmor = state.playerStatuses.armor + amount;
    if (state.talentEffects.armorBlockThreshold > 0 && state.playerStatuses.armor < state.talentEffects.armorBlockThreshold && newArmor >= state.talentEffects.armorBlockThreshold) {
      state = {
        ...state,
        playerStatuses: {
          ...state.playerStatuses,
          block: state.playerStatuses.block + state.talentEffects.armorBlockAmount,
        },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: state.talentEffects.armorBlockAmount });
    }
  }

  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }

  if (effect.status === "forge") {
    const newForge = state.playerStatuses.forge + amount;
    if (state.talentEffects.forgeBurnThreshold > 0 && state.playerStatuses.forge < state.talentEffects.forgeBurnThreshold && newForge >= state.talentEffects.forgeBurnThreshold) {
      state = {
        ...state,
        enemyStatuses: {
          ...state.enemyStatuses,
          burn: state.enemyStatuses.burn + state.talentEffects.forgeBurnDamage,
        },
      };
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: state.talentEffects.forgeBurnDamage });
    }
  }

  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      [effect.status]: state.playerStatuses[effect.status] + amount,
    },
  };
}

function applyWishEffect(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  // Wish pauses normal hand play via wishOptions, but all on-wish talents/trinkets apply
  // immediately so the reward state is visible before the player picks a card.
  let nextState: BattleState = { ...state, wishOptions: buildWishOptions(state, card) };

  if (nextState.talentEffects.goldOnWish > 0) {
    nextState = { ...nextState, gold: nextState.gold + nextState.talentEffects.goldOnWish };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnWish });
  }
  if (nextState.talentEffects.goldOnWishAmount > 0) {
    nextState = { ...nextState, gold: nextState.gold + nextState.talentEffects.goldOnWishAmount };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnWishAmount });
  }
  // Wishing Well Coin trinket
  if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
    nextState = { ...nextState, gold: nextState.gold + nextState.trinketEffects.wishingWellGoldOnWish };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.wishingWellGoldOnWish });
  }
  if (nextState.talentEffects.healthOnWish > 0) {
    nextState = { ...nextState, playerHealth: clampHealth(nextState.playerHealth, nextState.talentEffects.healthOnWish, nextState.playerMaxHealth) };
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: nextState.talentEffects.healthOnWish });
  }
  if (nextState.talentEffects.removeAilmentOnWish) {
    nextState = removePlayerAilments(nextState, "one", combatTexts);
  }
  if (nextState.talentEffects.wishDrawsCard) {
    const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, 1, nextState.nextCardUid);
    nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
  }

  return nextState;
}

// Ironwood Buckler trinket: end of turn, if block >= threshold, convert to armor.
// Used identically in 3 places in endPlayerTurn (stun-skip, death-mid-phase, normal attack).
export function applyIronwoodBuckler(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.blockToArmorThreshold > 0 && state.playerStatuses.block >= state.trinketEffects.blockToArmorThreshold) {
    state = {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        armor: state.playerStatuses.armor + state.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: state.trinketEffects.blockToArmorAmount });
  }
  return state;
}

// Bone Charm trinket: heal on enemy kill. Used in dealEnemyDamage (mid-player-turn) and
// endPlayerTurn (enemy killed by DoTs). The heal-on-kill flag is consumed here.
export function applyBoneCharmHeal(state: BattleState, enemyWasAlive: boolean, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 && enemyWasAlive && state.trinketEffects.boneCharmHealOnKill > 0 && !state.flags.boneCharmUsed) {
    const healAmount = state.trinketEffects.boneCharmHealOnKill;
    state = {
      ...state,
      playerHealth: clampHealth(state.playerHealth, healAmount, state.playerMaxHealth),
      flags: { ...state.flags, boneCharmUsed: true },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  }
  return state;
}

// Card effects reduce through immutable state in authored order. Multi-effect cards rely
// on earlier effects changing resources/statuses before later effects read them.
export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  return card.effects.reduce((currentState, effect) => {
    switch (effect.kind) {
      case "damage":
        return dealEnemyDamage(currentState, effect, combatTexts);
      case "player-status":
        return applyPlayerStatusEffect(currentState, effect, combatTexts);
      case "heal": {
        const healAmount = Math.floor(effect.amount * currentState.talentEffects.healMultiplier);
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
        return { ...currentState, playerHealth: clampHealth(currentState.playerHealth, healAmount, currentState.playerMaxHealth) };
      }
      case "restore-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: currentState.mana + effect.amount };
      case "lose-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: Math.max(0, currentState.mana - effect.amount) };
      case "gain-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, maxMana: currentState.maxMana + effect.amount, mana: currentState.mana + effect.amount };
      case "lose-max-mana": {
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, currentState.maxMana - effect.amount);
        return { ...currentState, maxMana: newMaxMana, mana: Math.min(newMaxMana, currentState.mana) };
      }
      case "gain-gold":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: effect.amount });
        return { ...currentState, gold: currentState.gold + effect.amount };
      case "wish":
        return applyWishEffect(currentState, card, combatTexts);
      case "summon-companion":
        return { ...currentState, activeCompanion: companionLibrary[effect.companionId] };
      case "remove-ailment":
        return removePlayerAilments(currentState, effect.mode, combatTexts);
      default:
        return currentState;
    }
  }, state);
}
