import {
  bearCompanion,
  foxCompanion,
  frostWhelpCompanion,
  goldenRetrieverCompanion,
  libraryOwlCompanion,
  lizardScoutCompanion,
  manaMothCompanion,
  pantherCompanion,
  phoenixCompanion,
  pixieCompanion,
  risenSkeletonCompanion,
  shieldScarabCompanion,
  willOWispCompanion,
  wolfCompanion,
} from "./assets";
import type { BattleCardEffect, CompanionDefinition, CompanionId } from "./types";
import { mapEffectChildren } from "./effect-tree";

function companion(id: CompanionId, title: string, art: string, effect: BattleCardEffect): CompanionDefinition {
  return { id, title, art, turnStartEffects: [effect] };
}

export const companionLibrary: Record<CompanionId, CompanionDefinition> = {
  wolf: companion("wolf", "Wolf Companion", wolfCompanion, {
    kind: "damage",
    damageType: "bleed",
    damageTypePool: ["bleed", "physical"],
    amount: 1,
  }),
  "lizard-scout": companion("lizard-scout", "Lizard Scout Companion", lizardScoutCompanion, {
    kind: "damage",
    damageType: "poison",
    amount: 1,
  }),
  "frost-whelp": companion("frost-whelp", "Frost Whelp Companion", frostWhelpCompanion, {
    kind: "damage",
    damageType: "freeze",
    amount: 1,
  }),
  bear: companion("bear", "Bear Companion", bearCompanion, { kind: "damage", damageType: "stun", amount: 1 }),
  panther: companion("panther", "Panther Companion", pantherCompanion, {
    kind: "damage",
    damageType: "bleed",
    amount: 1,
  }),
  phoenix: companion("phoenix", "Phoenix Companion", phoenixCompanion, {
    kind: "damage",
    damageType: "burn",
    amount: 1,
  }),
  skeleton: companion("skeleton", "Risen Skeleton Companion", risenSkeletonCompanion, {
    kind: "damage",
    damageType: "physical",
    amount: 1,
  }),
  pixie: companion("pixie", "Pixie Companion", pixieCompanion, { kind: "heal", amount: 1 }),
  "mana-moth": companion("mana-moth", "Mana Moth Companion", manaMothCompanion, {
    kind: "restore-mana",
    amount: 1,
    allowOverflow: true,
  }),
  "will-o-wisp": companion("will-o-wisp", "Will-o'-Wisp Companion", willOWispCompanion, {
    kind: "remove-harmful-status",
    amount: 1,
  }),
  "golden-retriever": companion("golden-retriever", "Golden Retriever Companion", goldenRetrieverCompanion, {
    kind: "gain-gold",
    amount: 2,
  }),
  "shield-scarab": companion("shield-scarab", "Shield Scarab Companion", shieldScarabCompanion, {
    kind: "player-status",
    status: "block",
    amount: 2,
  }),
  "library-owl": companion("library-owl", "Library Owl Companion", libraryOwlCompanion, {
    kind: "draw-cards",
    amount: 1,
  }),
  fox: companion("fox", "Fox Companion", foxCompanion, {
    kind: "damage",
    damageType: "stun",
    damageTypePool: ["stun", "bleed"],
    amount: 1,
  }),
};

export const defaultCompanionBondLevels: Record<CompanionId, number> = Object.fromEntries(
  Object.keys(companionLibrary).map((id) => [id, 0]),
) as Record<CompanionId, number>;

export interface CompanionDamageModifiers {
  damageBonus: number;
  bleedDamageBonus: number;
  damageMultiplier: number;
}

export function getModifiedCompanionEffects(
  companion: CompanionDefinition,
  bondLevel: number,
  modifiers: CompanionDamageModifiers,
): BattleCardEffect[] {
  const bonusTrigger = companion.id === "mana-moth" || companion.id === "library-owl";
  const bonusHeal = companion.id === "will-o-wisp";
  const amountBond = bonusTrigger || bonusHeal ? 0 : bondLevel;

  // Apply Bond before damage bonuses, retaining the original arithmetic order.
  // One walk avoids constructing an intermediate bonded effect tree.
  function scale(effect: BattleCardEffect): BattleCardEffect {
    if (effect.kind === "damage") {
      const pool = effect.damageTypePool;
      if (pool?.includes("bleed") && pool.length > 1 && modifiers.bleedDamageBonus !== 0) {
        // Resolve type-specific amounts through ordinary chance effects so combat
        // and inspection share the same magnitudes without boosting other types.
        const { damageTypePool: _pool, ...hit } = effect;
        const [damageType, ...remaining] = pool;
        return {
          kind: "chance",
          probability: 1 / pool.length,
          successEffects: [scale({ ...hit, damageType: damageType! })],
          failureEffects: [
            scale({
              ...hit,
              damageType: remaining[0]!,
              ...(remaining.length > 1 ? { damageTypePool: remaining } : {}),
            }),
          ],
        };
      }
      const bonus = modifiers.damageBonus + (effect.damageType === "bleed" ? modifiers.bleedDamageBonus : 0);
      return { ...effect, amount: Math.round((effect.amount + amountBond + bonus) * modifiers.damageMultiplier) };
    }
    if (effect.kind === "chance") {
      return mapEffectChildren(effect, scale);
    }
    if (
      amountBond !== 0 &&
      (effect.kind === "heal" ||
        effect.kind === "gain-gold" ||
        (effect.kind === "player-status" && companion.id !== "wolf"))
    ) {
      return { ...effect, amount: effect.amount + amountBond };
    }
    return effect;
  }
  const effects = companion.turnStartEffects.map(scale);
  if (bondLevel !== 0) {
    if (bonusTrigger) {
      effects.push({
        kind: "chance",
        probability: bondLevel / 4,
        successEffects: companion.turnStartEffects.map(scale),
        failureEffects: [],
      });
    } else if (bonusHeal) {
      effects.push({ kind: "heal", amount: bondLevel });
    }
  }
  return effects;
}
