// Actor rail for the battle screen: hero/enemy panels, companion, turn shine, and combat text.
// Depends on screen store shimmer actions, actor UI widgets, and battle layout constants.
// Used only by BattleScreen to keep the main screen composition smaller.
import type { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { BATTLE_ACTOR_TOP } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { ArtPanel, CompanionPanel, CombatTextRail } from "../../../shared/ui/battle-ui";
import { battleActorSectionClass, bossCardWidthClass } from "@/features/alchemy/shared/config";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattlePresentationStore } from "../../battle/battle-presentation-store";
import type { BattleFeedbackProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

// High-frequency presentation reads live here, isolated from the BattleScreen subtree:
// floating combat text add/remove and hit shake/flash tokens only re-render the rail / actor.
function CombatTextRailSide({ side }: { side: "player" | "enemy" }) {
  const entries = useBattlePresentationStore(
    useShallow((s) => s.floatingCombatTexts.filter((text) => text.target === side)),
  );
  return <CombatTextRail entries={entries} side={side} />;
}

function ShakingArtPanel({
  side,
  ...props
}: Omit<ComponentProps<typeof ArtPanel>, "shaking" | "hurtFlashToken"> & { side: "player" | "enemy" }) {
  const shaking = useBattlePresentationStore((s) => (side === "player" ? s.playerShaking : s.enemyShaking));
  const hurtFlashToken = useBattlePresentationStore((s) =>
    side === "player" ? s.playerHurtFlashToken : s.enemyHurtFlashToken,
  );
  return <ArtPanel {...props} side={side} shaking={shaking} hurtFlashToken={hurtFlashToken} />;
}

function ShakingCompanionPanel(props: ComponentProps<typeof CompanionPanel>) {
  const shaking = useBattlePresentationStore((s) => s.companionShaking);
  return <CompanionPanel {...props} shaking={shaking} />;
}

export function BattleActors({
  view,
  feedback,
  refs,
}: {
  view: RequiredBattleViewProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
}) {
  const { battleState, heroArt, playerName, aspectMode } = view;
  const shimmerState = useUiStore((state) => state.shimmerState);
  const onHoverShimmer = useUiStore((state) => state.maybeTriggerShimmer);
  const { playerStatusChips, enemyStatusChips, activeLabyrinthModifiers } = feedback;
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
        <div className="absolute top-[30%] left-[calc(100%+clamp(3cqw,5cqw,6.5cqw))] z-30 w-40">
          <CombatTextRailSide side="player" />
        </div>
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
            shimmerActive={shimmerState?.cardId === "player-card"}
            shimmerToken={shimmerState?.token}
            onHoverShimmer={onHoverShimmer}
            deathsDoorActive={battleState.deathsDoorActive}
            surfaceRef={playerPanelRef}
            turnActive={isPlayerTurn}
          />
          {battleState.activeCompanion ? (
            <div className="absolute bottom-[clamp(8.56cqh,8.93cqh,11.48cqh)] left-[calc(100%-clamp(4.71cqh,5.58cqh,7.65cqh))] z-20">
              <ShakingCompanionPanel
                companion={battleState.activeCompanion}
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
        <div className="absolute top-[30%] right-[calc(100%+clamp(3cqw,5cqw,6.5cqw))] z-30 w-40">
          <CombatTextRailSide side="enemy" />
        </div>
        <ShakingArtPanel
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
          currentEnemy={battleState.currentEnemy}
          currentEnemyAttackEffects={battleState.enemyAttackEffects}
          activeLabyrinthModifiers={activeLabyrinthModifiers}
          isBoss={isBoss}
          statsCardWidthClass={bossStatsCardWidthClass}
          turnActive={!isPlayerTurn && !enemyDead}
          turnUrgentHide={enemyDead}
        />
      </div>
    </section>
  );
}
