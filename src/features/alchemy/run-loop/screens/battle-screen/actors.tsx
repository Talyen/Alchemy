// Actor rail for the battle screen: hero/enemy panels, companion, turn shine, and combat text.
// Depends on screen store shimmer actions, actor UI widgets, and battle layout constants.
// Used only by BattleScreen to keep the main screen composition smaller.
import type { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { BATTLE_ACTOR_TOP } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { ArtPanel, CompanionPanel, CombatTextRail } from "../../../shared/ui/battle-ui";
import {
  battleActorEnemyCellClass,
  battleActorHeroCellClass,
  battleActorSectionClass,
  battleCompanionCornerClass,
} from "@/features/alchemy/shared/config";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattlePresentationStore } from "../../battle/battle-presentation-store";
import type { BattleFeedbackProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

// High-frequency presentation reads live here, isolated from the BattleScreen subtree:
// floating combat text add/remove and hit shake/flash tokens only re-render the rail / actor.
function CombatTextRailSide({ side }: { side: "player" | "enemy" }) {
  const entries = useBattlePresentationStore(
    useShallow((s) => s.floatingCombatTexts.filter((text) => text.target === side)),
  );
  return <CombatTextRail entries={entries} />;
}

type ShakingArtPanelProps = Omit<
  ComponentProps<typeof ArtPanel>,
  "shaking" | "hurtFlashToken" | "shimmerActive" | "shimmerToken" | "onHoverShimmer"
> & {
  side: "player" | "enemy";
  shimmerId: string;
};

function ShakingArtPanel({ side, shimmerId, ...props }: ShakingArtPanelProps) {
  const shaking = useBattlePresentationStore((s) => (side === "player" ? s.playerShaking : s.enemyShaking));
  const hurtFlashToken = useBattlePresentationStore((s) =>
    side === "player" ? s.playerHurtFlashToken : s.enemyHurtFlashToken,
  );
  const shimmerActive = useUiStore((s) => s.shimmerState?.cardId === shimmerId);
  const shimmerToken = useUiStore((s) => (s.shimmerState?.cardId === shimmerId ? s.shimmerState.token : undefined));
  const onHoverShimmer = useUiStore((s) => s.maybeTriggerShimmer);
  return (
    <ArtPanel
      {...props}
      side={side}
      shimmerId={shimmerId}
      shaking={shaking}
      hurtFlashToken={hurtFlashToken}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      onHoverShimmer={onHoverShimmer}
    />
  );
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
  const { playerStatusChips, enemyStatusChips, activeLabyrinthModifiers } = feedback;
  const { playerPanelRef, enemyPanelRef } = refs;
  const isPlayerTurn = battleState.turnPhase === "player";
  const enemyDead = battleState.enemyHealth <= 0;
  const hasCompanion = Boolean(battleState.activeCompanion);
  const isBoss = battleState.currentEnemy.enemyType === "boss";

  return (
    <section
      className={cn(aspectMode === "ultrawide" ? battleActorSectionClass.ultrawide : battleActorSectionClass.desktop)}
      style={{ top: BATTLE_ACTOR_TOP }}
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
            deathsDoorActive={battleState.deathsDoorActive}
            surfaceRef={playerPanelRef}
            turnActive={isPlayerTurn}
            artCorner={
              battleState.activeCompanion ? (
                <div className={battleCompanionCornerClass}>
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
        >
          <CombatTextRailSide side="enemy" />
        </ShakingArtPanel>
      </div>
    </section>
  );
}
