// Actor rail for the battle screen: hero/enemy panels, companion, turn badge, and combat text.
// Depends on screen store shimmer actions, actor UI widgets, and battle layout constants.
// Used only by BattleScreen to keep the main screen composition smaller.
import { BATTLE_ACTOR_TOP } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { ArtPanel, CompanionPanel, CombatTextRail } from "../../../shared/ui/battle-ui";
import { TurnBadge } from "../../../shared/ui/turn-badge";
import { battleActorSectionClass, bossCardWidthClass } from "@/features/alchemy/shared/config";
import type { BattleFeedbackProps, BattleHoverProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

export function BattleActors({
  view,
  hover,
  feedback,
  refs,
}: {
  view: RequiredBattleViewProps;
  hover: BattleHoverProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
}) {
  const { battleState, heroArt, playerName, aspectMode } = view;
  const { shimmerState, maybeTriggerShimmer: onHoverShimmer } = hover;
  const {
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    playerShaking,
    enemyShaking,
    companionShaking,
    playerHurtFlashToken,
    enemyHurtFlashToken,
    activeLabyrinthModifiers,
  } = feedback;
  const { playerPanelRef, enemyPanelRef } = refs;
  const isPlayerTurn = battleState.turnPhase === "player";
  const enemyDead = battleState.enemyHealth <= 0;
  const hasCompanion = Boolean(battleState.activeCompanion);
  const isBoss = battleState.currentEnemy.enemyType === "boss";
  const bossStatsCardWidthClass = isBoss ? bossCardWidthClass : undefined;

  return (
    <section
      className={cn(aspectMode === "ultrawide" ? battleActorSectionClass.ultrawide : battleActorSectionClass.desktop)}
      style={{ top: BATTLE_ACTOR_TOP }}
    >
      <div className="relative flex items-start justify-center transition-transform duration-500 ease-out">
        <div className="absolute left-[calc(100%+clamp(1.46cqw,3cqw,2.29cqw))] top-[30%] z-30 w-40">
          <CombatTextRail entries={playerCombatTexts} side="player" />
        </div>
        <div
          className={cn(
            "relative transition-transform duration-500 ease-out",
            hasCompanion && "-translate-x-[clamp(0.625cqw,1.2cqw,1.146cqw)]",
          )}
        >
          <ArtPanel
            side="player"
            title={playerName}
            art={heroArt}
            health={battleState.playerHealth}
            maxHealth={battleState.playerMaxHealth}
            statuses={playerStatusChips}
            shimmerId="player-card"
            shimmerActive={shimmerState?.cardId === "player-card"}
            shimmerToken={shimmerState?.token}
            onHoverShimmer={onHoverShimmer}
            deathsDoorActive={battleState.deathsDoorActive}
            surfaceRef={playerPanelRef}
            shaking={playerShaking}
            hurtFlashToken={playerHurtFlashToken}
          />
          {battleState.activeCompanion ? (
            <div className="absolute bottom-[clamp(8.56cqh,8.93cqh,11.48cqh)] left-[calc(100%-clamp(4.71cqh,5.58cqh,7.65cqh))] z-20">
              <CompanionPanel
                companion={battleState.activeCompanion}
                shaking={companionShaking}
                damageBonus={
                  battleState.companionDamageBuff +
                  battleState.talentEffects.companionDamage +
                  battleState.trinketEffects.companionDamageBonus +
                  (battleState.talentEffects.companionBondLevels[battleState.activeCompanion.id] ?? 0)
                }
              />
            </div>
          ) : null}
          <TurnBadge show={isPlayerTurn} variant="player" />
        </div>
      </div>

      <div className="relative flex flex-col items-center">
        <div className="absolute right-[calc(100%+clamp(1.46cqw,3cqw,2.29cqw))] top-[30%] z-30 w-40">
          <CombatTextRail entries={enemyCombatTexts} side="enemy" />
        </div>
        <ArtPanel
          side="enemy"
          title={battleState.currentEnemy.title}
          art={battleState.currentEnemy.art}
          health={battleState.enemyHealth}
          maxHealth={battleState.enemyMaxHealth}
          statuses={enemyStatusChips}
          shimmerId="enemy-card"
          shimmerActive={shimmerState?.cardId === "enemy-card"}
          shimmerToken={shimmerState?.token}
          onHoverShimmer={onHoverShimmer}
          surfaceRef={enemyPanelRef}
          isDead={battleState.enemyHealth <= 0}
          shaking={enemyShaking}
          hurtFlashToken={enemyHurtFlashToken}
          currentEnemy={battleState.currentEnemy}
          currentEnemyAttackEffects={battleState.enemyAttackEffects}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
          isBoss={isBoss}
          statsCardWidthClass={bossStatsCardWidthClass}
        />
        <TurnBadge show={!isPlayerTurn && !enemyDead} variant="enemy" urgentHide={enemyDead} />
      </div>
    </section>
  );
}
