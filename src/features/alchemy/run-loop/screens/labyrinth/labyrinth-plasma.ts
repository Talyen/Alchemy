import {
  ENCOUNTER_COMBAT_TRAIT_KEYWORDS,
  ENCOUNTER_REWARD_TRAIT_KEYWORDS,
} from "@/features/alchemy/shared/config/encounter-trait-presentation";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { type KeywordId } from "@/lib/game-data";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import {
  getPlasmaColorPair,
  getPlasmaKeywordsForEnemy,
  type PlasmaColorPair,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { destinationMeta } from "@/features/alchemy/shared/config/metadata";
import { LABYRINTH_TYPE_TO_DESTINATION } from "@/lib/content-systems/labyrinth/data";

const LABYRINTH_TYPE_BASE_KEYWORDS: Record<LabyrinthNode["type"], KeywordId[]> = {
  entrance: [],
  combat: [],
  elite: [],
  boss: [],
  rest: ["health"],
  mystery: ["wish"],
  corruption: ["consume"],
  shop: ["gold"],
  alchemist: ["poison"],
  "trinket-shop": ["wish"],
  "equipment-shop": ["forge"],
};

function collectEnemyKeywordIds(enemyId: string | undefined): KeywordId[] {
  if (!enemyId || !isEnemyId(enemyId)) return [];
  const enemy = enemyById[enemyId];
  if (!enemy) return [];
  return getPlasmaKeywordsForEnemy(enemy);
}

function getLabyrinthNodeKeywordIds(node: LabyrinthNode): KeywordId[] {
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
    const kws = ENCOUNTER_COMBAT_TRAIT_KEYWORDS[traitId];
    if (kws) push(kws);
  }
  for (const traitId of node.rewardModifiers ?? []) {
    const kws = ENCOUNTER_REWARD_TRAIT_KEYWORDS[traitId];
    if (kws) push(kws);
  }

  if (ordered.length === 0 && base.length > 0) push(base);
  if (ordered.length === 0) push(["physical"]);

  return ordered;
}

export function getLabyrinthNodePlasmaPair(node: LabyrinthNode): PlasmaColorPair | null {
  if (node.type === "entrance") return null;
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
