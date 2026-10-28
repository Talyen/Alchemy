import { preloadBattleSounds, playBattleEvent } from "@/lib/audio";
import { playResolvedCombatSound, presentCombatTexts } from "./controller-utils";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import type { BattleStarted } from "@/features/alchemy/shared/stores/commands/battle-start-commands";
import { presentCompanionAction } from "./companion-presentation";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function presentBattleStart({
    startingTexts,
    companionId,
    companionActions,
    outcome,
    openingCardIds,
  }: BattleStarted) {
    const battleState = ctx.battle.read().battleState;
    preloadBattleSounds(openingCardIds, battleState.currentEnemy.abilityIds);
    session.resetBattleSession();
    const presentationStore = ctx.getPresentation();
    if (!ctx.playback.beginOpening(ctx.playback.id)) return;
    presentationStore.setOpeningDrawPending(true);
    presentationStore.setCardTransferInProgress(true);
    const focalSound = companionId
      ? playResolvedCombatSound(undefined, startingTexts, battleState.deathsDoorActive)
      : battleState.deathsDoorActive
        ? playBattleEvent("deathsDoor")
        : undefined;
    if (companionActions) presentationStore.enqueueCompanionActions(companionActions);
    else if (companionId) {
      presentCompanionAction(presentationStore, battleState.activeCompanion);
    }
    presentCombatTexts(presentationStore, startingTexts, focalSound);
    if (outcome) session.handleVictoryDefeat?.(outcome);
  }

  return ctx.battle.createStartCommands(presentBattleStart);
}
