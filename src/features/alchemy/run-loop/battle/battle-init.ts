import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { preloadBattleSounds } from "@/lib/audio";
import { playCompanionSound, presentCombatTexts } from "./controller-utils";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import { createBattleStartCommands, type BattleStarted } from "./battle-start-commands";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function presentBattleStart({ startingTexts, companionId, outcome, openingCardIds }: BattleStarted) {
    const battleState = readBattle().battleState;
    preloadBattleSounds(openingCardIds, battleState.currentEnemy.id, battleState.currentEnemy.abilityIds);
    session.prepareBattleSessionForStart();
    const presentationStore = ctx.getPresentation();
    presentationStore.setOpeningDrawPending(true);
    presentationStore.setCardTransferInProgress(true);
    if (companionId) {
      playCompanionSound(companionId);
      presentationStore.shakeCompanion();
      presentationStore.telegraphAttack("companion");
    }
    presentCombatTexts(presentationStore, startingTexts);
    if (outcome) session.handleVictoryDefeat?.(outcome);
  }

  return createBattleStartCommands(presentBattleStart);
}
