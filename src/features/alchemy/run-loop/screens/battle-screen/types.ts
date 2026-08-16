// Prop contracts shared by the focused battle screen view modules.
import type { MouseEvent } from "react";

import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { BattleState } from "@/lib/battle";
import type { DisplayOverrides } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { StatusChip } from "../../../shared/types";
import type { BattleRefs } from "../../../shared/types";

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

interface BattleScreenViewProps {
  battleState: BattleScreenState;
  characterId: CharacterId;
  heroArt: string;
  playerName: string;
  aspectMode?: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
}

export interface BattleFeedbackProps {
  playerStatusChips: StatusChip[];
  enemyStatusChips: StatusChip[];
  activeLabyrinthModifiers: EncounterCombatTraitId[];
}

export type BattleRefsProps = BattleRefs;

export interface BattleActionsProps {
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard | null) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  playableHandCardKeys: Set<string>;
  revealedCardKeys: Set<string>;
  isDevMode: boolean;
  isAutoplayEnabled: boolean;
  onToggleAutoplay: () => void;
}

export type RequiredBattleViewProps = Required<BattleScreenViewProps>;

/** Read-only battle view state passed from useBattleController (single subscription path). */
export interface BattleScreenData {
  battleState: BattleState;
  displayOverrides: DisplayOverrides;
  revealedCardKeys: Set<string>;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  runTrinkets: string[];
}
