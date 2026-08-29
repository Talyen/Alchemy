import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthNode } from "@/lib/content-systems/types";
import { getPlasmaColorPair, type PlasmaColorPair } from "@/features/alchemy/shared/config/plasma-palettes";
import { keywordAliases } from "@/features/alchemy/shared/config/keywords";
import { destinationMeta } from "@/features/alchemy/shared/config/metadata";
import type { Destination } from "@/lib/routing";

const LABYRINTH_TYPE_BASE_KEYWORDS: Record<LabyrinthNode["type"], KeywordId[]> = {
  entrance: [],
  combat: [],
  elite: [],
  boss: [],
  rest: ["health"],
  mystery: ["wish"],
  shop: ["gold"],
  alchemist: ["poison"],
  "trinket-shop": ["wish"],
  "equipment-shop": ["forge"],
};

const LABYRINTH_TYPE_TO_DESTINATION: Record<LabyrinthNode["type"], Destination> = {
  entrance: "Normal Combat",
  combat: "Normal Combat",
  elite: "Elite Combat",
  boss: "Boss Combat",
  rest: "Campfire",
  mystery: "Mystery",
  shop: "Card Shop",
  alchemist: "Alchemist's Shop",
  "trinket-shop": "Trinket Shop",
  "equipment-shop": "Equipment Shop",
};

export const LABYRINTH_COMBAT_TRAIT_KEYWORDS: Partial<Record<EncounterCombatTraitId, KeywordId[]>> = {
  tempered: ["forge"],
  plated: ["armor"],
  reinforced: ["block"],
  braced: ["stun"],
  septic: ["poison", "bleed"],
  caustic: ["poison"],
  flesheater: ["bleed", "leech"],
  combustible: ["burn"],
  chilling: ["freeze"],
  thorns: ["physical"],
  zealot: ["holy"],
  insatiable: ["consume"],
  jealous: ["wish"],
  concussive: ["stun"],
  rooted: ["nature"],
  overgrowth: ["health"],
  "holy-retribution": ["holy"],
  "divine-aegis": ["armor"],
};

export const LABYRINTH_REWARD_TRAIT_KEYWORDS: Partial<Record<EncounterRewardTraitId, KeywordId[]>> = {
  generous: ["gold"],
  alchemist: ["poison"],
  scavenger: ["forge"],
  companion: ["companion"],
  wealthy: ["gold"],
  herbalist: ["nature"],
  wellProvisioned: ["health"],
};

function collectEnemyKeywordIds(enemyId: string | undefined): KeywordId[] {
  if (!enemyId || !isEnemyId(enemyId)) return [];
  const enemy = enemyById[enemyId];
  if (!enemy) return [];
  const ids = new Set<KeywordId>();
  const traitText = enemy.traits.map((t) => t.description).join(" ");
  for (const alias of keywordAliases) {
    if (traitText.includes(alias.match)) ids.add(alias.keywordId);
  }
  for (const effect of enemy.attackEffects) {
    if (effect.kind === "damage" && effect.damageType in keywordDefinitions) {
      ids.add(effect.damageType);
    }
    if (effect.kind === "player-status" && effect.status in keywordDefinitions) {
      ids.add(effect.status as unknown as KeywordId);
    }
  }
  return [...ids];
}

export function getLabyrinthNodeKeywordIds(node: LabyrinthNode): KeywordId[] {
  const seen = new Set<KeywordId>();
  const ordered: KeywordId[] = [];
  const push = (ids: readonly KeywordId[]) => {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  };

  const base = LABYRINTH_TYPE_BASE_KEYWORDS[node.type] ?? [];
  const enemyKeywords = node.enemyId ? collectEnemyKeywordIds(node.enemyId) : [];

  if (enemyKeywords.length > 0) {
    push(enemyKeywords);
  } else if (base.length > 0) {
    push(base);
  }

  for (const traitId of node.modifiers ?? []) {
    const kws = LABYRINTH_COMBAT_TRAIT_KEYWORDS[traitId];
    if (kws) push(kws);
  }
  for (const traitId of node.rewardModifiers ?? []) {
    const kws = LABYRINTH_REWARD_TRAIT_KEYWORDS[traitId];
    if (kws) push(kws);
  }

  if (ordered.length === 0 && base.length > 0) push(base);
  if (ordered.length === 0) push(["physical"]);

  return ordered;
}

export function getLabyrinthNodePlasmaPair(node: LabyrinthNode): PlasmaColorPair | null {
  if (node.type === "boss") {
    const keywordIds = getLabyrinthNodeKeywordIds(node);
    return getPlasmaColorPair(keywordIds);
  }
  const dest = LABYRINTH_TYPE_TO_DESTINATION[node.type];
  const meta = dest ? destinationMeta[dest] : undefined;
  if (meta?.plasmaColorPair) return meta.plasmaColorPair;
  const keywordIds = getLabyrinthNodeKeywordIds(node);
  return getPlasmaColorPair(keywordIds);
}
