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
  | "deathsDoorGraceTurnsRemaining"
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
  | "roomScalingMultiplier"
  | "difficultyModifiers"
  | "turnPhase"
  | "playerCC"
  | "enemyCC"
  | "enemyStatuses"
  | "enemyMitigation"
  | "talentEffects"
  | "trinketEffects"
  | "gearEffects"
  | "flags"
  | "encounterBenefits"
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
  onWishChoice: (card: BattleCard) => void;
}

export type RequiredBattleViewProps = Required<BattleScreenViewProps>;

export interface BattleScreenData {
  battleState: BattleSnapshot;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  runBoons: string[];
}
