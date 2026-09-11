import type { MouseEvent } from "react";

import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { BattleSnapshot } from "@/lib/battle";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { StatusChip } from "../../../shared/types";
import type { BattleRefs } from "../../../shared/types";

export type BattleScreenState = Pick<
  BattleSnapshot,
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
  | "turnPhase"
  | "playerCC"
  | "enemyCC"
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
  onInspectPile?: ((view: "draw" | "discard") => void) | undefined;
  inspectionAvailable?: boolean | undefined;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onWishChoice: (card: BattleCard) => void;
  onEndTurn: () => void;
}

export type RequiredBattleViewProps = Required<BattleScreenViewProps>;

export interface BattleScreenData {
  battleState: BattleSnapshot;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  runBoons: string[];
}
