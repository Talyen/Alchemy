// Shared feature-level UI/controller types for screens, routes, ghosts, combat text, and options.
// Depends on React style types plus battle/game-data contracts.
// Used across alchemy controllers, hooks, screens, and reusable UI widgets.
import type { CSSProperties } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import type { KeywordId } from "@/lib/game-data";

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
  | "act-complete"
  | "run-victory"
  | "labyrinth-map"
  | "wildwood-select";

export type ResolutionOption = "1920x1080" | "1920x1200" | "2560x1080";

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export type UiScale = "90" | "100" | "110" | "120";

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

export type FloatingCombatText = CombatTextEvent & {
  id: string;
  lane: number;
  displayText: string;
};

export type StatusChip = {
  id: string;
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
