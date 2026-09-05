import { isPlayerDefeated } from "@/lib/battle";
import { BATTLE_ACTOR_TOP } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  battleActorEnemyCellClass,
  battleActorHeroCellClass,
  battleActorSectionClass,
  battleCompanionCornerClass,
  getBossShineColors,
  getCharacterShineColors,
  getCompanionShineColors,
  getPlasmaColorPairForCharacter,
} from "@/features/alchemy/shared/config";
import { CombatTextRailSide, ShakingArtPanel, ShakingCompanionPanel } from "../../battle/presentation/actor-vfx";
import { getActiveCcKeyword } from "@/features/alchemy/shared/utils";
import type { BattleFeedbackProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

export function BattleActors({
  view,
  feedback,
  refs,
}: {
  view: RequiredBattleViewProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
}) {
  const { battleState, characterId, heroArt, playerName, aspectMode } = view;
  const { playerStatusChips, enemyStatusChips, activeLabyrinthModifiers } = feedback;
  const { playerPanelRef, enemyPanelRef } = refs;
  const isPlayerTurn = battleState.turnPhase === "player";
  const enemyDead = battleState.enemyHealth <= 0;
  const hasCompanion = Boolean(battleState.activeCompanion);
  const isBoss = battleState.currentEnemy.enemyType === "boss";
  const playerCcKeyword = getActiveCcKeyword(battleState.playerCC);
  const enemyCcKeyword = getActiveCcKeyword(battleState.enemyCC);

  return (
    <section
      className={cn(aspectMode === "ultrawide" ? battleActorSectionClass.ultrawide : battleActorSectionClass.desktop)}
      style={{ top: `calc(${BATTLE_ACTOR_TOP} - max(0px, calc((var(--content-scale, 1) - 1) * 120px)))` }}
    >
      <div className={battleActorHeroCellClass}>
        <div
          className={cn(
            "relative transition-transform duration-500 ease-out",
            hasCompanion && "-translate-x-[clamp(0.625cqw,1.2cqw,1.146cqw)]",
          )}
        >
          <ShakingArtPanel
            side="player"
            title={playerName}
            art={heroArt}
            health={battleState.playerHealth}
            maxHealth={battleState.playerMaxHealth}
            statuses={playerStatusChips}
            shimmerId="player-card"
            isDead={isPlayerDefeated(battleState)}
            turnUrgentHide={isPlayerDefeated(battleState)}
            deathsDoorActive={battleState.deathsDoorActive}
            surfaceRef={playerPanelRef}
            turnActive={isPlayerTurn}
            turnShineColors={getCharacterShineColors(characterId)}
            ccKeyword={playerCcKeyword}
            plasmaColorPair={getPlasmaColorPairForCharacter(characterId)}
            artCorner={
              battleState.activeCompanion ? (
                <div className={battleCompanionCornerClass}>
                  <ShakingCompanionPanel
                    companion={battleState.activeCompanion}
                    ccKeyword={playerCcKeyword}
                    turnActive={isPlayerTurn}
                    turnShineColors={getCompanionShineColors(battleState.activeCompanion)}
                    damageBonus={
                      battleState.companionDamageBuff +
                      battleState.talentEffects.companionDamage +
                      battleState.trinketEffects.companionDamageBonus +
                      (battleState.talentEffects.companionBondLevels[battleState.activeCompanion.id] ?? 0)
                    }
                  />
                </div>
              ) : null
            }
          >
            <CombatTextRailSide side="player" />
          </ShakingArtPanel>
        </div>
      </div>

      <div className={battleActorEnemyCellClass}>
        <ShakingArtPanel
          side="enemy"
          title={battleState.currentEnemy.title}
          art={battleState.currentEnemy.art}
          health={battleState.enemyHealth}
          maxHealth={battleState.enemyMaxHealth}
          statuses={enemyStatusChips}
          shimmerId="enemy-card"
          surfaceRef={enemyPanelRef}
          isDead={battleState.enemyHealth <= 0}
          currentEnemy={battleState.currentEnemy}
          currentEnemyAttackEffects={battleState.enemyAttackEffects}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
          isBoss={isBoss}
          turnActive={!isPlayerTurn && !enemyDead}
          turnUrgentHide={enemyDead}
          ccKeyword={enemyCcKeyword}
          {...(isBoss ? { turnShineColors: getBossShineColors(battleState.currentEnemy) } : {})}
        >
          <CombatTextRailSide side="enemy" />
        </ShakingArtPanel>
      </div>
    </section>
  );
}
