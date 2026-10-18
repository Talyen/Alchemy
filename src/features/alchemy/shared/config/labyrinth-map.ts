import type { LabyrinthNodeType } from "@/lib/content-systems/types";
import {
  alchemistShopBg,
  campfire,
  transmutationCrucible,
  corruptionAltar,
  eliteEnemyBg,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  theLabyrinth,
} from "@/features/alchemy/shared/config/game-data-catalog";

export interface LabyrinthNodeMeta {
  art: string;
  actionLabel: string;
}

export const LABYRINTH_NODE_META: Record<LabyrinthNodeType, LabyrinthNodeMeta> = {
  entrance: { art: theLabyrinth, actionLabel: "Enter" },
  combat: { art: normalEnemyBg, actionLabel: "Fight" },
  elite: { art: eliteEnemyBg, actionLabel: "Fight" },
  rest: { art: campfire, actionLabel: "Enter" },
  mystery: { art: mysteryBg, actionLabel: "Investigate" },
  transmutation: { art: transmutationCrucible, actionLabel: "Enter" },
  corruption: { art: corruptionAltar, actionLabel: "Enter" },
  shop: { art: merchantShopBg, actionLabel: "Enter" },
  alchemist: { art: alchemistShopBg, actionLabel: "Enter" },
  "trinket-shop": { art: alchemistShopBg, actionLabel: "Enter" },
  "equipment-shop": { art: merchantShopBg, actionLabel: "Enter" },
  boss: { art: normalEnemyBg, actionLabel: "Fight" },
};
