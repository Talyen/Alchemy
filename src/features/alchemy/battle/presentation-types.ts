// Battle UI presentation types for stores and animation helpers (no React).
import type { CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

type CardGhostVariant = "draw-in" | "discard-out" | "activate" | "play-travel";

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
