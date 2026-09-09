import { useMemo, type MouseEvent } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { CardGhostLayer, CardTransferLayer } from "../../battle/presentation/presentation-layers";
import { useCardTransferInProgress } from "../../battle/presentation/use-hand-presentation";
import { BattleActors } from "./actors";
import { BattleBottomBar } from "./controls";
import { PageLayout } from "../../../shared/ui/shared-ui";
import { BattleBoonInspectOverlay } from "./boon-inspect";
import { hasInspectableBoons } from "./unique-run-boons";
import { WishOverlay } from "./wish-overlay";
import type { BattleActionsProps, BattleFeedbackProps, BattleRefsProps, BattleScreenData } from "./types";
import { getEnemyStatusChips, getPlayerStatusChips, isAlchemyDevBuild } from "../../../shared/utils";
import { BackgroundParticles } from "../../../shared/ui/background-particles";
import { getScreenParticleConfig } from "@/app/screen-particle-config";
import { useSettingsStore } from "../../../shared/stores/settings-store";

interface BattleScreenProps {
  onInspectEnemy?: ((trigger: HTMLElement) => void) | undefined;
  enemyInspectionOpen?: boolean | undefined;
  onInspectPile?: BattleActionsProps["onInspectPile"];
  inspectionAvailable?: boolean | undefined;
  battleScreenData: BattleScreenData;
  characterId: CharacterId;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  refs: BattleRefsProps;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onWishChoice: (card: BattleCard) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  boonInspectOpen: boolean;
  onCloseBoonInspect: () => void;
}

export function BattleScreen(props: BattleScreenProps) {
  const {
    onInspectPile,
    inspectionAvailable,
    battleScreenData,
    characterId,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    refs,
    onCardClick,
    onWishChoice,
    onSkipCombatDevMode,
    onEndTurn,
    boonInspectOpen,
    onCloseBoonInspect,
  } = props;

  const { battleState, displayOverrides, activeLabyrinthModifiers, runBoons } = battleScreenData;
  const cardTransferInProgress = useCardTransferInProgress();

  const displayState = useMemo(() => ({ ...battleState, ...displayOverrides }), [battleState, displayOverrides]);

  const isBossBattle = battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier, particleCount } = getScreenParticleConfig("battle", isBossBattle);
  const backgroundParticlesIntensity = useSettingsStore((s) => s.backgroundParticlesIntensity);
  const particleAlpha = ((particleAlphaMultiplier ?? 1) * backgroundParticlesIntensity) / 100;

  const playerStatusChips = useMemo(() => getPlayerStatusChips(displayState), [displayState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);

  const view = useMemo(
    () => ({
      battleState: displayState,
      characterId,
      heroArt,
      playerName,
      aspectMode,
      stagePixelRatio,
    }),
    [displayState, characterId, heroArt, playerName, aspectMode, stagePixelRatio],
  );

  const feedback: BattleFeedbackProps = useMemo(
    () => ({
      playerStatusChips,
      enemyStatusChips,
      activeLabyrinthModifiers,
    }),
    [playerStatusChips, enemyStatusChips, activeLabyrinthModifiers],
  );

  const isDev = isAlchemyDevBuild();
  const actions: BattleActionsProps = useMemo(
    () => ({
      onInspectPile,
      inspectionAvailable,
      onCardClick,
      onWishChoice,
      onSkipCombatDevMode,
      onEndTurn,
      isDevMode: isDev,
    }),
    [onInspectPile, inspectionAvailable, onCardClick, onWishChoice, onSkipCombatDevMode, onEndTurn, isDev],
  );

  const { battleSceneRef: sceneRef } = refs;

  const inspectUiOpen = boonInspectOpen && hasInspectableBoons(runBoons) && !battleState.wishOptions;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {backgroundParticlesIntensity > 0 ? (
          <BackgroundParticles
            variant="embers"
            {...(particleColors ? { colors: particleColors } : {})}
            alphaMultiplier={particleAlpha}
            {...(particleCount ? { particleCount } : {})}
          />
        ) : null}
      </div>

      <PageLayout>
        <div className="relative flex w-full max-w-[calc(100*var(--content-rem,1rem))] flex-1 flex-col p-7 pb-1">
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div
              ref={sceneRef}
              data-testid="battle-scene"
              className="[container-type:size] absolute inset-0 overflow-visible"
            >
              <BattleActors
                view={view}
                feedback={feedback}
                refs={refs}
                onInspectEnemy={props.onInspectEnemy}
                enemyInspectionOpen={props.enemyInspectionOpen}
              />

              <BattleBottomBar view={view} refs={refs} actions={actions} playabilityState={battleState} />

              <WishOverlay
                open={Boolean(battleState.wishOptions) && !cardTransferInProgress}
                battleState={displayState}
                actions={actions}
              />

              <BattleBoonInspectOverlay open={inspectUiOpen} trinketIds={runBoons} onClose={onCloseBoonInspect} />

              <CardGhostLayer />
              <CardTransferLayer />
            </div>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
