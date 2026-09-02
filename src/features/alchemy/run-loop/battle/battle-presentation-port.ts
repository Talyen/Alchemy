import type { CombatTextEvent } from "@/lib/battle";
import type { CardGhost, CardTransfer } from "../../shared/types";
import { useBattlePresentationStore } from "./battle-presentation-store";
import type { CombatTextShakeFeedback } from "./battle-status";
import type { HiddenHandCardKeys } from "./playable-hand";

type CombatantAttackSide = "player" | "enemy" | "companion";

export interface BattlePresentationPort extends CombatTextShakeFeedback {
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardTransferInProgress: boolean;
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  shakeCompanion: () => void;
  telegraphAttack: (side: CombatantAttackSide) => void;
  telegraphCast: (side: CombatantAttackSide) => void;
  resetHandTransferUi: () => void;
  resetCardTransfers: () => void;
  clearCardGhosts: () => void;
  clearFloatingCombatTexts: () => void;
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  setHiddenHandCardKeys: (update: (prev: HiddenHandCardKeys) => Iterable<string>) => void;
  setCardTransferInProgress: (inProgress: boolean | ((prev: boolean) => boolean)) => void;
  resetPresentation: () => void;
}

function getStoreBattlePresentationPort(): BattlePresentationPort {
  return useBattlePresentationStore.getState();
}

export function resolveBattlePresentation(ctx: {
  getPresentation?: () => BattlePresentationPort;
}): BattlePresentationPort {
  return ctx.getPresentation?.() ?? getStoreBattlePresentationPort();
}
