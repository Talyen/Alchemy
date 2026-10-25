import type { CSSProperties, RefObject } from "react";

import type { BattleCard, EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import type { CombatTextEvent, ReactionId } from "@/lib/battle";
export type { DisplayMode } from "@/lib/settings-values";
import type { ArmedFlagChipId, PendingPulseChipId } from "./augment-definitions";

type CardGhostVariant = "activate" | "play-travel";

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
  kind: "draw" | "discard";
  id: string;
  card: BattleCard;
  handCardKey: string;
  from: CardRect;
  to: CardRect;
  fromScale: number;
  toScale: number;
  toScaleY?: number;
  rotateY: readonly [number, number];
  fromRotation: number;
  toRotation: number;
  duration: number;
}

export interface BattleRefs {
  endTurnButtonRef: RefObject<HTMLButtonElement | null>;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
}

export type CombatTextLane = "impact" | "benefit" | "setback" | "announcement";

/** Presentation-only timing, assigned by the feedback owner after aggregation. */
export interface CombatTextPresentation {
  lane: CombatTextLane;
  launchAt: number;
  lifetimeMs: number;
  phase: "waiting" | "visible";
}

export type FloatingCombatText = CombatTextEvent & {
  id: string;
  displayText: string;
  reservedDigits?: number;
  includesCritical?: boolean;
  presentation?: CombatTextPresentation;
};

export interface ReactionAnnouncement {
  id: string;
  burstId: string;
  target: CombatTextEvent["target"];
  reactionIds: ReactionId[];
  firstShownAt: number;
  lifetimeMs: number;
  presentation?: CombatTextPresentation;
}

export interface CombatTextBurst {
  id: string;
  firstShownAt: number;
  target: CombatTextEvent["target"];
  entries: FloatingCombatText[];
  lifetimeMs: number;
}

export interface CombatImpactCue {
  sequence: number;
  colors: readonly string[];
  healthLost: boolean;
  amount: number;
  periodic: boolean;
  recoil: boolean;
}

export type CollectionTab = "heroes" | "cards" | "bestiary" | "trinkets" | "uniques";

export interface StatusChip {
  description?: string;
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

  hideValue?: boolean;
}

export type GhostStyle = CSSProperties & {
  "--ghost-rotation": string;
  "--ghost-scale"?: string;
  "--ghost-travel-x"?: string;
  "--ghost-travel-y"?: string;
};

export type CardInspectionView = "deck" | "draw" | "discard";
