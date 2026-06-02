// Shared feature-level UI/controller types for screens, routes, ghosts, combat text, and options.
// Depends on React style types plus battle/game-data contracts.
// Used across alchemy controllers, hooks, screens, and reusable UI widgets.
import type { CSSProperties } from "react";

import type { EnemyStatusId, KeywordId, PlayerStatusId } from "@/lib/game-data";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";

export type { Screen, Destination } from "@/lib/routing";
export { DESTINATIONS } from "@/lib/routing";
export type {
  CardGhost,
  CardRect,
  CardTransfer,
  FloatingCombatText,
} from "@/features/alchemy/battle/presentation-types";

export type AspectRatioOption = "auto" | "16:9" | "16:10" | "21:9";

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export type UiScale = "90" | "100" | "110" | "120";

const CONTENT_SYSTEMS = {
  CAMPAIGN: "campaign",
  LABYRINTH: "labyrinth",
  WILDWOOD: "wildwood",
} as const;

const ENEMY_TYPES = {
  NORMAL: "normal",
  ELITE: "elite",
  BOSS: "boss",
} as const;

const REWARD_ROUTES = {
  COMPANION_REWARD: "companion-reward",
  LABYRINTH_VICTORY: "labyrinth-victory",
  LABYRINTH_MAP: "labyrinth-map",
  WILDWOOD_VICTORY: "wildwood-victory",
  ACT_COMPLETE: "act-complete",
  DESTINATION: "destination",
} as const;

export const CONSTANTS = {
  SCREENS: ROUTE_SCREENS,
  DESTINATIONS,
  CONTENT_SYSTEMS,
  ENEMY_TYPES,
  REWARD_ROUTES,
} as const;

export type CollectionTab = "cards" | "bestiary" | "trinkets";

export type StatusChip = {
  id: PlayerStatusId | EnemyStatusId;
  value: number;
};

export type DescriptionPart = {
  text: string;
  keywordId?: KeywordId;
};

export type GhostStyle = CSSProperties & {
  "--ghost-rotation": string;
  "--ghost-scale"?: string;
  "--ghost-travel-x"?: string;
  "--ghost-travel-y"?: string;
};
