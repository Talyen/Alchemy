import { type BattleCard, type CompanionId, getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { canAfford } from "@/lib/homestead/inventory";
import { type MaterialInventory } from "@/lib/homestead/types";
import { getNextTierCost } from "@/lib/homestead/upgrades";
import { type GoalItem, getArt } from "./helpers";

export type HomesteadSelection = GoalItem | { kind: "companion"; card: BattleCard };

export interface HomesteadNodeModel {
  id: string;
  title: string;
  art: string | undefined;
  discovered: boolean;
  companion: boolean;
  level: number;
  maxLevel: number;
  action: "Build" | "Upgrade" | "Bond";
  cost: MaterialInventory | null;
  affordable: boolean;
  bonuses: string[];
  production: string[];
}

function lines(text: string | undefined) {
  return text?.split("\n").filter((line) => line.trim()) ?? [];
}

export function getUpgradeNode(item: GoalItem, level: number, inventory: MaterialInventory): HomesteadNodeModel {
  const tier = item.data.tiers[Math.max(0, Math.min(level - 1, item.data.tiers.length - 1))];
  const cost = getNextTierCost(item.data, level);
  return {
    id: item.data.id,
    title: item.data.title,
    art: getArt(item.data.id),
    discovered: true,
    companion: false,
    level,
    maxLevel: item.data.tiers.length,
    action: level === 0 ? "Build" : "Upgrade",
    cost,
    affordable: cost !== null && canAfford(inventory, cost),
    bonuses: lines(tier?.benefitDescription),
    production: lines(tier?.nonCombatBenefitDescription),
  };
}

export function getCompanionId(card: BattleCard): CompanionId | undefined {
  return card.effects.find((effect) => effect.kind === "summon-companion")?.companionId;
}

export function getCompanionNode(
  card: BattleCard,
  discovered: boolean,
  bondedCompanions: Record<CompanionId, number>,
  inventory: MaterialInventory,
): HomesteadNodeModel {
  const companionId = getCompanionId(card);
  const level = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
  const cost = discovered && companionId && level < COMPANION_MAX_TIER ? (COMPANION_BOND_TIERS[level] ?? null) : null;
  // Unowned nodes preview their first purchase; owned nodes describe the current tier.
  const descriptionBondLevels =
    companionId && level === 0 ? { ...bondedCompanions, [companionId]: 1 } : bondedCompanions;
  return {
    id: card.id,
    title: discovered ? card.title : "Undiscovered companion",
    art: card.art,
    discovered,
    companion: true,
    level,
    maxLevel: COMPANION_MAX_TIER,
    action: "Bond",
    cost,
    affordable: cost !== null && canAfford(inventory, cost),
    bonuses: discovered ? getEffectiveCardDescriptionLines(card, { companionBondLevels: descriptionBondLevels }) : [],
    production: [],
  };
}
