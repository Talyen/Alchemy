// Prop contracts shared by the focused battle screen view modules.
import type { MouseEvent, RefObject } from "react";

import type { BattleState } from "@/lib/battle";
import type { DisplayOverrides } from "../../../shared/stores/run-domain-types";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { CardGhost, FloatingCombatText, StatusChip } from "../../../shared/types";

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

type BattleScreenViewProps = {
  battleState: BattleScreenState;
  heroArt: string;
  playerName: string;
  aspectMode?: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
};

export type BattleHoverProps = {
  hoveredCardId: string | null;
  shimmerState: { cardId: string; token: number } | null;
  maybeTriggerShimmer: (cardId: string) => void;
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
  playerHurtFlashToken: number;
  enemyHurtFlashToken: number;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
};

export type BattleRefsProps = {
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
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
  playableHandCardKeys: Set<string>;
  revealedCardKeys: Set<string>;
  isDevMode: boolean;
};

export type RequiredBattleViewProps = Required<BattleScreenViewProps>;

/** Read-only battle view state passed from useBattleController (single subscription path). */
export type BattleScreenData = {
  battleState: BattleState;
  displayOverrides: DisplayOverrides;
  revealedCardKeys: Set<string>;
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  playerHurtFlashToken: number;
  enemyHurtFlashToken: number;
  hoveredCardId: string | null;
  shimmerState: BattleHoverProps["shimmerState"];
  maybeTriggerShimmer: (cardId: string) => void;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
};
