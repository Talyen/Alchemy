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

export const companionLibrary: Record<CompanionDefinition["id"], CompanionDefinition> = {
  wolf: {
    id: "wolf",
    title: "Wolf Companion",
    art: wolfCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "bleed", damageTypePool: ["bleed", "physical"], amount: 1 }],
  },
  "lizard-scout": {
    id: "lizard-scout",
    title: "Lizard Scout Companion",
    art: lizardScoutCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "poison", amount: 1 }],
  },
  "frost-whelp": {
    id: "frost-whelp",
    title: "Frost Whelp Companion",
    art: frostWhelpCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "freeze", amount: 1 }],
  },
  bear: {
    id: "bear",
    title: "Bear Companion",
    art: bearCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "stun", amount: 1 }],
  },
  panther: {
    id: "panther",
    title: "Panther Companion",
    art: pantherCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "bleed", amount: 1 }],
  },
  phoenix: {
    id: "phoenix",
    title: "Phoenix Companion",
    art: phoenixCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "burn", amount: 1 }],
  },
  skeleton: {
    id: "skeleton",
    title: "Risen Skeleton Companion",
    art: risenSkeletonCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
  },
  pixie: {
    id: "pixie",
    title: "Pixie Companion",
    art: pixieCompanion,
    turnStartEffects: [{ kind: "heal", amount: 1 }],
  },
  "mana-moth": {
    id: "mana-moth",
    title: "Mana Moth Companion",
    art: manaMothCompanion,
    turnStartEffects: [{ kind: "restore-mana", amount: 1, allowOverflow: true }],
  },
  "will-o-wisp": {
    id: "will-o-wisp",
    title: "Will-o'-Wisp Companion",
    art: willOWispCompanion,
    turnStartEffects: [{ kind: "remove-harmful-status", amount: 1 }],
  },
  "golden-retriever": {
    id: "golden-retriever",
    title: "Golden Retriever Companion",
    art: goldenRetrieverCompanion,
    turnStartEffects: [{ kind: "gain-gold", amount: 2 }],
  },
  "shield-scarab": {
    id: "shield-scarab",
    title: "Shield Scarab Companion",
    art: shieldScarabCompanion,
    turnStartEffects: [{ kind: "player-status", status: "block", amount: 2 }],
  },
  "library-owl": {
    id: "library-owl",
    title: "Library Owl Companion",
    art: libraryOwlCompanion,
    turnStartEffects: [{ kind: "draw-cards", amount: 1 }],
  },
  fox: {
    id: "fox",
    title: "Fox Companion",
    art: foxCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "stun", damageTypePool: ["stun", "bleed"], amount: 1 }],
  },
};

export const defaultCompanionBondLevels: Record<CompanionId, number> = Object.fromEntries(
  Object.keys(companionLibrary).map((id) => [id, 0]),
) as Record<CompanionId, number>;

function getCompanionBondEffects(companion: CompanionDefinition, bondLevel = 0): BattleCardEffect[] {
  if (bondLevel === 0) return companion.turnStartEffects;
  if (companion.id === "mana-moth" || companion.id === "library-owl") {
    return [
      ...companion.turnStartEffects,
      {
        kind: "chance",
        probability: bondLevel / 4,
        successEffects: companion.turnStartEffects,
        failureEffects: [],
      },
    ];
  }
  if (companion.id === "will-o-wisp") {
    return [...companion.turnStartEffects, { kind: "heal", amount: bondLevel }];
  }
  function scaleEffect(effect: BattleCardEffect): BattleCardEffect {
    if (effect.kind === "chance") {
      return {
        ...effect,
        successEffects: effect.successEffects.map(scaleEffect),
        failureEffects: effect.failureEffects.map(scaleEffect),
      };
    }
    if (
      effect.kind === "damage" ||
      effect.kind === "heal" ||
      effect.kind === "gain-gold" ||
      (effect.kind === "player-status" && companion.id !== "wolf")
    ) {
      return { ...effect, amount: effect.amount + bondLevel };
    }
    return effect;
  }
  return companion.turnStartEffects.map(scaleEffect);
}

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
      return { ...effect, amount: Math.round((effect.amount + bonus) * modifiers.damageMultiplier) };
    }
    if (effect.kind === "chance") {
      return {
        ...effect,
        successEffects: effect.successEffects.map(scale),
        failureEffects: effect.failureEffects.map(scale),
      };
    }
    return effect;
  }
  return getCompanionBondEffects(companion, bondLevel).map(scale);
}
