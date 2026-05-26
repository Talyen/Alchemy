// Prop contracts shared by the focused battle screen view modules.
import type { MouseEvent, MutableRefObject } from "react";

import type { BattleState } from "@/lib/battle";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { CardGhost, FloatingCombatText, StatusChip } from "../../types";

export type BattleScreenState = Pick<
  BattleState,
  | "playerHealth"
  | "playerMaxHealth"
  | "deathsDoorActive"
  | "enemyHealth"
  | "enemyMaxHealth"
  | "mana"
  | "maxMana"
  | "gold"
  | "deck"
  | "discard"
  | "hand"
  | "wishOptions"
  | "activeCompanion"
  | "companionDamageBuff"
  | "currentEnemy"
  | "enemyAttackEffects"
  | "turnPhase"
  | "talentEffects"
  | "trinketEffects"
  | "flags"
>;

export type BattleScreenViewProps = {
  battleState: BattleScreenState;
  heroArt: string;
  playerName: string;
  aspectMode?: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
};

export type BattleHoverProps = {
  hoveredCardId: string | null;
  shimmerState: { cardId: string; token: number } | null;
};

export type BattleFeedbackProps = {
  playerStatusChips: StatusChip[];
  enemyStatusChips: StatusChip[];
  playerCombatTexts: FloatingCombatText[];
  enemyCombatTexts: FloatingCombatText[];
  cardGhosts: CardGhost[];
  playerShaking: boolean;
  enemyShaking: boolean;
  companionShaking: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
};

export type BattleRefsProps = {
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: MutableRefObject<HTMLDivElement | null>;
  discardPileRef: MutableRefObject<HTMLDivElement | null>;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
};

export type BattleActionsProps = {
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard | null) => void;
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  isDevMode: boolean;
};

export type RequiredBattleViewProps = Required<BattleScreenViewProps>;
