import { useGameTranslation } from "@/components/use-game-translation";
import { displayText } from "@/lib/localization/runtime";
import type { BattlePresentationStore } from "../../battle/battle-presentation-store";
import { isPlayerDefeated, getBattleCompanionDamageModifiers } from "@/lib/battle";
import { BATTLE_ACTOR_TOP, BATTLE_ACTOR_VIEWPORT_OFFSET } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  battleActorEnemyCellClass,
  battleActorHeroCellClass,
  battleActorSectionClass,
  battleCompanionCornerClass,
  getBossShineColors,
  getCharacterShineColors,
  getCompanionShineColors,
  getEnemyKeywordShineColors,
  getPlasmaColorPairForCharacter,
} from "@/features/alchemy/shared/config";
import { ManaPanel } from "../../battle/presentation/ui/mana-dock";
import { ShakingArtPanel, ShakingCompanionPanel } from "../../battle/presentation/actor-vfx";
import { getActiveCcKeyword } from "@/features/alchemy/shared/utils";
import type { BattleFeedbackProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

export function BattleActors({
  presentation,
  view,
  feedback,
  refs,
  onInspectEnemy,
  enemyInspectionOpen,
}: {
  presentation: BattlePresentationStore;
  view: RequiredBattleViewProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
  onInspectEnemy?: ((trigger: HTMLElement) => void) | undefined;
  enemyInspectionOpen?: boolean | undefined;
}) {
  useGameTranslation();
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
      style={{
        top: `calc(${BATTLE_ACTOR_TOP} + ${BATTLE_ACTOR_VIEWPORT_OFFSET}px - max(0px, calc((var(--content-scale, 1) - 1) * 120px)))`,
      }}
    >
      <div className={battleActorHeroCellClass}>
        <div
          className={cn(
            "relative transition-transform duration-500 ease-out",
            hasCompanion && "-translate-x-[clamp(0.625cqw,1.146cqw,1.2cqw)]",
          )}
        >
          <ShakingArtPanel
            presentation={presentation}
            side="player"
            title={displayText(playerName)}
            art={heroArt}
            health={battleState.playerHealth}
            maxHealth={battleState.playerMaxHealth}
            statuses={playerStatusChips}
            shimmerId="player-card"
            isDead={isPlayerDefeated(battleState)}
            turnUrgentHide={isPlayerDefeated(battleState)}
            deathsDoorActive={battleState.deathsDoorActive}
            deathsDoorGraceTurnsRemaining={battleState.deathsDoorGraceTurnsRemaining}
            surfaceRef={playerPanelRef}
            turnActive={isPlayerTurn}
            turnShineColors={getCharacterShineColors(characterId)}
            ccKeyword={playerCcKeyword}
            plasmaColorPair={getPlasmaColorPairForCharacter(characterId)}
            artOverlay={<ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} presentation={presentation} />}
            artCorner={
              battleState.activeCompanion ? (
                <div className={battleCompanionCornerClass}>
                  <ShakingCompanionPanel
                    presentation={presentation}
                    companion={battleState.activeCompanion}
                    ccKeyword={playerCcKeyword}
                    turnActive={isPlayerTurn}
                    turnShineColors={getCompanionShineColors(battleState.activeCompanion)}
                    bondLevel={battleState.talentEffects.companionBondLevels[battleState.activeCompanion.id] ?? 0}
                    damageBonus={getBattleCompanionDamageModifiers(battleState)}
                  />
                </div>
              ) : null
            }
          />
        </div>
      </div>

      <div className={battleActorEnemyCellClass}>
        <ShakingArtPanel
          presentation={presentation}
          side="enemy"
          title={displayText(battleState.currentEnemy.title)}
          art={battleState.currentEnemy.art}
          health={battleState.enemyHealth}
          maxHealth={battleState.enemyMaxHealth}
          statuses={enemyStatusChips}
          shimmerId="enemy-card"
          surfaceRef={enemyPanelRef}
          isDead={battleState.enemyHealth <= 0}
          currentEnemy={battleState.currentEnemy}
          enemyDescriptionContext={battleState}
          onInspect={onInspectEnemy}
          inspectionOpen={enemyInspectionOpen ?? false}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
          isBoss={isBoss}
          turnActive={!isPlayerTurn && !enemyDead}
          turnUrgentHide={enemyDead}
          ccKeyword={enemyCcKeyword}
          turnShineColors={
            isBoss
              ? getBossShineColors(battleState.currentEnemy, activeLabyrinthModifiers)
              : getEnemyKeywordShineColors(battleState.currentEnemy, activeLabyrinthModifiers)
          }
        />
      </div>
    </section>
  );
}
