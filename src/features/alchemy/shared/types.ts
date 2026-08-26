// Shared feature-level UI/controller types for screens, routes, ghosts, combat text, and options.
// Depends on React style types plus battle/game-data contracts.
// Used across alchemy controllers, hooks, screens, and reusable UI widgets.
import type { CSSProperties, RefObject } from "react";

import type { BattleCard, EnemyStatusId, KeywordId, PlayerStatusId } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle";
import type { ArmedFlagChipId, PendingPulseChipId } from "./augment-definitions";

type CardGhostVariant = "draw-in" | "discard-out" | "activate" | "play-travel";

export interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardGhost {
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
}

export interface CardTransfer {
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
}

export interface BattleRefs {
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
}

export type FloatingCombatText = CombatTextEvent & {
  id: string;
  lane: number;
  displayText: string;
};

export interface CombatImpactCue {
  sequence: number;
  colors: readonly string[];
  healthLost: boolean;
}

export type AspectRatioOption = "auto" | "16:9" | "16:10" | "21:9";

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export type CollectionTab = "heroes" | "cards" | "bestiary" | "trinkets";

export interface StatusChip {
  id:
    | PlayerStatusId
    | EnemyStatusId
    | ArmedFlagChipId
    | "echo"
    | "ccImmunity"
    | "stunned"
    | "frozen"
    | PendingPulseChipId;
  value: number;
  /** Binary effects (e.g. Phoenix Feather or Control Immunity) omit the numeric badge in their tooltip. */
  hideValue?: boolean;
}

export interface DescriptionPart {
  text: string;
  keywordId?: KeywordId;
}

export type GhostStyle = CSSProperties & {
  "--ghost-rotation": string;
  "--ghost-scale"?: string;
  "--ghost-travel-x"?: string;
  "--ghost-travel-y"?: string;
};
