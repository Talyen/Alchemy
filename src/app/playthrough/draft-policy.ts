import { getImmediateDamage, getImmediateDefense } from "@/lib/battle";
import { companionLibrary, visitBattleCardEffects, type BattleCard, type CharacterId } from "@/lib/game-data";
import { scoreStrategyCard } from "./archetype-policy";
import type { CareerConfig } from "./types";
import { potionUtility } from "./brewing-policy";

function summonedCompanion(card: BattleCard) {
  let companion: (typeof companionLibrary)[keyof typeof companionLibrary] | undefined;
  visitBattleCardEffects(card.effects, (effect) => {
    if (effect.kind !== "summon-companion") return false;
    companion = companionLibrary[effect.companionId];
    return true;
  });
  return companion;
}

/** Starter picks need repeatable attacks and a usable hand, beyond keyword overlap. */
export function scoreStarterDraftCard(
  policy: CareerConfig["policy"],
  hero: CharacterId,
  card: BattleCard,
  deck: readonly BattleCard[],
): number {
  const base = scoreStrategyCard(policy, hero, card, deck);
  if (policy !== "archetype" || hero !== "wildcard") return base;

  const attacks = deck.reduce((count, entry) => count + Number(!entry.consume && getImmediateDamage(entry) > 0), 0);
  const attackBonus = !card.consume && getImmediateDamage(card) > 0 ? Math.max(0, 12 - attacks * 6) : 0;
  const hasDefense = deck.some((entry) => !entry.consume && getImmediateDefense(entry) > 0);
  const defenseBonus = !hasDefense && !card.consume && getImmediateDefense(card) > 0 ? 6 : 0;
  const companion = summonedCompanion(card);
  if (!companion) return base + attackBonus + defenseBonus;

  const summons = deck.reduce((count, entry) => count + Number(Boolean(summonedCompanion(entry))), 0);
  const action = { ...card, effects: companion.turnStartEffects };
  const combatPayoff = visitBattleCardEffects(
    action.effects,
    (effect) =>
      (effect.kind === "damage" ||
        effect.kind === "heal" ||
        effect.kind === "draw-cards" ||
        effect.kind === "restore-mana" ||
        effect.kind === "player-status") &&
      effect.amount > 0,
  );
  // Only one Companion is active. Replacements cannot multiply its recurring action.
  return base + potionUtility(action) * 3 + (summons === 0 && combatPayoff ? 8 : 0) - summons * 12;
}
