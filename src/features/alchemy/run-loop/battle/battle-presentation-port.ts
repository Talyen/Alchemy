// Imperative battle VFX surface used by glue (card play, transfers, turn sequencing).
// Production wiring is the Zustand presentation store; tests inject a stub port.
import type { CombatTextEvent } from "@/lib/battle";
import type { CardGhost, CardTransfer } from "../../shared/types";
import { useBattlePresentationStore } from "./battle-presentation-store";
import type { PortraitFeedback } from "./battle-feedback";
import type { HiddenHandCardKeys } from "./playable-hand";

export type CombatantAttackSide = "player" | "enemy" | "companion";

export interface BattlePresentationPort extends PortraitFeedback {
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardTransferInProgress: boolean;
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  shakeCompanion: () => void;
  telegraphAttack: (side: CombatantAttackSide) => void;
  resetHandTransferUi: () => void;
  resetCardTransfers: () => void;
  clearCardGhosts: () => void;
  resetPortraitHurtTokens: () => void;
  clearFloatingCombatTexts: () => void;
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  setHiddenHandCardKeys: (update: (prev: HiddenHandCardKeys) => Iterable<string>) => void;
  setCardTransferInProgress: (inProgress: boolean | ((prev: boolean) => boolean)) => void;
}

function getStoreBattlePresentationPort(): BattlePresentationPort {
  return useBattlePresentationStore.getState();
}

export function resolveBattlePresentation(ctx: {
  getPresentation?: () => BattlePresentationPort;
}): BattlePresentationPort {
  return ctx.getPresentation?.() ?? getStoreBattlePresentationPort();
}
