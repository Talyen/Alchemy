import {
  ENCOUNTER_COMBAT_TRAIT_KEYWORDS,
  ENCOUNTER_REWARD_TRAIT_KEYWORDS,
} from "@/features/alchemy/shared/config/encounter-trait-presentation";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import {
  getPlasmaColorPair,
  getPlasmaColorPairFromColors,
  getPlasmaKeywordsForEnemy,
  type PlasmaColorPair,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { destinationMeta } from "@/features/alchemy/shared/config/metadata";
import { LABYRINTH_TYPE_TO_DESTINATION } from "@/lib/content-systems/labyrinth/data";
import { phoenixFeatherStatus } from "@/features/alchemy/shared/config/phoenix-feather-status";

export function getLabyrinthNodePlasmaPair(node: LabyrinthNode): PlasmaColorPair | null {
  if (node.type === "entrance") return null;
  if (node.type !== "boss") {
    return (
      destinationMeta[LABYRINTH_TYPE_TO_DESTINATION[node.type]]?.plasmaColorPair ?? getPlasmaColorPair(["physical"])
    );
  }
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : undefined;
  const keywordIds = [
    ...new Set([
      ...(enemy ? getPlasmaKeywordsForEnemy(enemy) : []),
      ...(node.modifiers ?? []).flatMap((id) => ENCOUNTER_COMBAT_TRAIT_KEYWORDS[id] ?? []),
      ...(node.rewardModifiers ?? []).flatMap((id) => ENCOUNTER_REWARD_TRAIT_KEYWORDS[id] ?? []),
    ]),
  ];
  const hasPhoenixNest = node.rewardModifiers?.includes("phoenix-nest") ?? false;
  const keywordPair =
    keywordIds.length > 0
      ? getPlasmaColorPair(keywordIds)
      : hasPhoenixNest
        ? getPlasmaColorPairFromColors(phoenixFeatherStatus.shineColors)
        : getPlasmaColorPair(["physical"]);
  const pair =
    keywordPair && hasPhoenixNest && keywordIds.length === 1
      ? { ...keywordPair, secondary: phoenixFeatherStatus.shineColors[0] }
      : keywordPair;
  return pair;
}
