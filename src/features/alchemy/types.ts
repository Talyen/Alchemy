// Shared feature-level UI/controller types for screens, routes, ghosts, combat text, and options.
// Depends on React style types plus battle/game-data contracts.
// Used across alchemy controllers, hooks, screens, and reusable UI widgets.
import type { CSSProperties } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import type { BattleCard, EnemyStatusId, KeywordId, PlayerStatusId } from "@/lib/game-data";

export type Screen =
  | "menu"
  | "game-mode-select"
  | "character-select"
  | "difficulty-select"
  | "battle"
  | "rewards"
  | "destination"
  | "options"
  | "collection"
  | "talents"
  | "homestead"
  | "game-over"
  | "campfire"
  | "shop"
  | "alchemist"
  | "mystery"
  | "corruption"
  | "run-victory"
  | "labyrinth-map"
  | "wildwood-select";

export type AspectRatioOption = "auto" | "16:9" | "16:10" | "21:9";

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export type UiScale = "90" | "100" | "110" | "120";

export const ROUTE_SCREENS = {
  MENU: "menu",
  GAME_MODE_SELECT: "game-mode-select",
  CHARACTER_SELECT: "character-select",
  DIFFICULTY_SELECT: "difficulty-select",
  BATTLE: "battle",
  REWARDS: "rewards",
  DESTINATION: "destination",
  OPTIONS: "options",
  COLLECTION: "collection",
  TALENTS: "talents",
  HOMESTEAD: "homestead",
  GAME_OVER: "game-over",
  CAMPFIRE: "campfire",
  SHOP: "shop",
  ALCHEMIST: "alchemist",
  MYSTERY: "mystery",
  CORRUPTION: "corruption",
  RUN_VICTORY: "run-victory",
  LABYRINTH_MAP: "labyrinth-map",
  WILDWOOD_SELECT: "wildwood-select",
} as const;

export const CONTENT_SYSTEMS = {
  CAMPAIGN: "campaign",
  LABYRINTH: "labyrinth",
  WILDWOOD: "wildwood",
} as const;

export const ENEMY_TYPES = {
  NORMAL: "normal",
  ELITE: "elite",
  BOSS: "boss",
} as const;

export const DESTINATIONS = {
  NORMAL_COMBAT: "Normal Combat",
  ELITE_COMBAT: "Elite Combat",
  MERCHANT_SHOP: "Merchant's Shop",
  ALCHEMIST_SHOP: "Alchemist's Shop",
  MYSTERY: "Mystery",
  CORRUPTION: "Corruption",
  CAMPFIRE: "Campfire",
  BOSS_COMBAT: "Boss Combat",
} as const;

export const REWARD_ROUTES = {
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

export type Destination = (typeof DESTINATIONS)[keyof typeof DESTINATIONS];

export type CollectionTab = "cards" | "bestiary" | "trinkets";

export type CardGhostVariant = "draw-in" | "discard-out" | "activate" | "play-travel";

export type CardRect = { x: number; y: number; width: number; height: number };

export type CardGhost = {
  id: string;
  art: string;
  rect: CardRect;
  rotation: number;
  delay: number;
  variant: CardGhostVariant;
  travel?: {
    x: number;
    y: number;
    scale: number;
  };
};

export type CardTransfer = {
  id: string;
  card: BattleCard;
  from: CardRect;
  to: CardRect;
  fromScale: number;
  toScale: number;
  fromRotation: number;
  toRotation: number;
  rotateY: number[];
  duration: number;
};

export type FloatingCombatText = CombatTextEvent & {
  id: string;
  lane: number;
  displayText: string;
};

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
