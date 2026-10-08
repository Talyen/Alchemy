import { preloadBattleSounds, playBattleEvent } from "@/lib/audio";
import { playCompanionSound, presentCombatTexts } from "./controller-utils";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import type { BattleStarted } from "@/features/alchemy/shared/stores/battle-start-commands";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function presentBattleStart({ startingTexts, companionId, outcome, openingCardIds }: BattleStarted) {
    const battleState = ctx.battle.read().battleState;
    preloadBattleSounds(openingCardIds, battleState.currentEnemy.id, battleState.currentEnemy.abilityIds);
    session.resetBattleSession();
    const presentationStore = ctx.getPresentation();
    ctx.playback.beginOpening();
    presentationStore.setOpeningDrawPending(true);
    presentationStore.setCardTransferInProgress(true);
    const focalSound = companionId ? playCompanionSound(companionId) : undefined;
    if (companionId) {
      presentationStore.shakeCompanion();
      presentationStore.telegraphAttack("companion");
    }
    if (battleState.deathsDoorActive) playBattleEvent("deathsDoor");
    presentCombatTexts(presentationStore, startingTexts, focalSound);
    if (outcome) session.handleVictoryDefeat?.(outcome);
  }

  return ctx.battle.createStartCommands(presentBattleStart);
}
