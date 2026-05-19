// Actor rail for the battle screen: hero/enemy panels, companion, turn badge, and combat text.
import { BATTLE_ACTOR_TOP_DESKTOP, BATTLE_ACTOR_TOP_MOBILE } from "@/lib/game-constants";

import { ArtPanel, CompanionPanel, CombatTextRail } from "../../components";
import { mobileStageBattleCardWidthClass, battleActorHalfGapClass, battleActorSectionClass } from "../../config";
import type { BattleFeedbackProps, BattleHoverProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useBattleStore } from "../../stores/battle-store";

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
  const { battleState, heroArt, playerName, isMobileLandscape, aspectMode = "standard" } = view;
  const { shimmerState } = hover;
  const onHoverShimmer = useBattleStore((s) => s.maybeTriggerShimmer);
  const {
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    playerShaking,
    enemyShaking,
    companionShaking,
    activeLabyrinthModifiers,
  } = feedback;
  const { playerPanelRef, enemyPanelRef } = refs;
  const isPlayerTurn = battleState.turnPhase === "player";
  const hasCompanion = Boolean(battleState.activeCompanion);
  const battleActorHalfGap =
    aspectMode === "ultrawide"
      ? battleActorHalfGapClass.ultrawide
      : isMobileLandscape
        ? battleActorHalfGapClass.mobile
        : battleActorHalfGapClass.desktop;
  const actorCardWidthClass = isMobileLandscape ? mobileStageBattleCardWidthClass : undefined;
  const playerTurnBadgeTransform = hasCompanion
    ? `translateX(calc(-50% - clamp(10.28cqh,11cqh,15.56cqh) - ${battleActorHalfGap} - clamp(0.625cqw,1.2cqw,1.146cqw)))`
    : `translateX(calc(-50% - clamp(10.28cqh,11cqh,15.56cqh) - ${battleActorHalfGap}))`;

  return (
    <section
      className={
        aspectMode === "ultrawide"
          ? battleActorSectionClass.ultrawide
          : isMobileLandscape
            ? battleActorSectionClass.mobile
            : battleActorSectionClass.desktop
      }
      style={{ top: isMobileLandscape ? BATTLE_ACTOR_TOP_MOBILE : BATTLE_ACTOR_TOP_DESKTOP }}
    >
      <div
        className={`pointer-events-none absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-all duration-500 ${
          isPlayerTurn ? "bg-emerald-900/80 text-emerald-300" : "bg-rose-900/80 text-rose-300"
        }`}
        style={{
          transform: isPlayerTurn
            ? playerTurnBadgeTransform
            : `translateX(calc(-50% + clamp(10.28cqh,11cqh,15.56cqh) + ${battleActorHalfGap}))`,
        }}
      >
        {isPlayerTurn ? "Your Turn" : "Enemy Turn"}
      </div>
      <div className="relative flex items-start justify-center transition-transform duration-500 ease-out">
        <div className="absolute left-[calc(100%+clamp(1.46cqw,3cqw,2.29cqw))] top-[30%] z-30 w-40">
          <CombatTextRail entries={playerCombatTexts} side="player" />
        </div>
        <div
          className={
            hasCompanion
              ? "relative transition-transform duration-500 ease-out -translate-x-[clamp(0.625cqw,1.2cqw,1.146cqw)]"
              : "relative transition-transform duration-500 ease-out"
          }
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
            combatTexts={playerCombatTexts}
            deathsDoorActive={battleState.deathsDoorActive}
            surfaceRef={(node) => {
              playerPanelRef.current = node;
            }}
            shaking={playerShaking}
            cardWidthClass={actorCardWidthClass}
          />
          {battleState.activeCompanion ? (
            <div className="absolute bottom-[clamp(8.15cqh,8.5cqh,10.93cqh)] left-[calc(100%-clamp(3.89cqh,4.6cqh,6.3cqh))] z-20">
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
          combatTexts={enemyCombatTexts}
          surfaceRef={(node) => {
            enemyPanelRef.current = node;
          }}
          isDead={battleState.enemyHealth <= 0}
          shaking={enemyShaking}
          currentEnemy={battleState.currentEnemy}
          currentEnemyAttackEffects={battleState.enemyAttackEffects}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
          cardWidthClass={actorCardWidthClass}
        />
      </div>
    </section>
  );
}
