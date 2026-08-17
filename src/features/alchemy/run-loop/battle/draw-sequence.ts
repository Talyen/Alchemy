// Shared hand draw lifecycle: detect new cards, hide until dealt, animate, cleanup.
// Depends on battle card types and optional draw animation hook.
// Used by play card, wish, end turn, and enemy phase flows in the battle controller.
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { getCardKey } from "./controller-utils";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";

function detectNewHandCards(oldHand: BattleCard[], newHand: BattleCard[]): BattleCard[] {
  const oldUidSet = new Set(oldHand.map((c) => c.uid));
  return newHand.filter((c) => !oldUidSet.has(c.uid));
}

export interface HandDrawSequenceDeps {
  isSessionActive: (session: number) => boolean;
  animateDrawnHand: (cards: BattleCard[], allHandCards: BattleCard[], session: number) => Promise<void>;
  setTransferInProgress: (active: boolean) => void;
  setHiddenHandCardKeys: (update: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  runIfSessionActive: (session: number, action: () => void) => void;
}

export async function runHandDrawSequence(
  oldHand: BattleCard[],
  newState: BattleState,
  applyState: () => void,
  session: number,
  deps: HandDrawSequenceDeps,
): Promise<boolean> {
  if (!deps.isSessionActive(session)) return false;
  const drawnCards = detectNewHandCards(oldHand, newState.hand);
  if (drawnCards.length === 0) {
    deps.runIfSessionActive(session, () => {
      applyState();
      deps.setTransferInProgress(false);
      deps.setHiddenHandCardKeys(new Set());
    });
    return false;
  }
  const hiddenDrawKeys = new Set(drawnCards.map(getCardKey));
  deps.setTransferInProgress(true);
  markBattleStage("draw-start");
  deps.runIfSessionActive(session, () => {
    deps.setHiddenHandCardKeys(hiddenDrawKeys);
    applyState();
  });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    if (!isAnimationDisabled()) {
      await deps.animateDrawnHand(drawnCards, newState.hand, session);
    }
  } finally {
    markBattleStage("draw-end");
    const clearHidden = () => {
      deps.setTransferInProgress(false);
      deps.setHiddenHandCardKeys((current) => {
        const next = new Set(current);
        for (const key of hiddenDrawKeys) {
          next.delete(key);
        }
        return next;
      });
    };
    // Always clear opacity-0 hand cards even if the battle session ended mid-draw.
    if (deps.isSessionActive(session)) {
      deps.runIfSessionActive(session, clearHidden);
    } else {
      clearHidden();
    }
  }
  return deps.isSessionActive(session);
}
