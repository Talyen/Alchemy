import type { CSSProperties } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import type { KeywordId } from "@/lib/game-data";

export type Screen = "menu" | "character-select" | "battle" | "rewards" | "destination" | "options" | "collection" | "talents" | "homestead" | "game-over" | "campfire" | "shop" | "alchemist" | "mystery" | "act-complete" | "run-victory";

export type ResolutionOption = "1366x768" | "1600x900" | "1920x1080" | "1920x1200" | "2560x1080" | "2560x1440" | "3440x1440" | "3840x2160";

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export type UiScale = "90" | "100" | "110" | "120";

export type Destination = "Normal Combat" | "Elite Combat" | "Merchant's Shop" | "Alchemist's Shop" | "Mystery" | "Campfire" | "Boss Combat";

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
  signedAmountText: string;
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


