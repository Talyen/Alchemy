import { useCallback, useMemo, useState, type MouseEvent } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { CardGhostLayer } from "../../battle/presentation/card-ghost-layer";
import { CardTransferLayer } from "../../battle/presentation/card-transfer-layer";
import { BattleActors } from "./actors";
import { BattleBottomBar } from "./controls";
import { HamburgerTrigger, PageLayout } from "../../../shared/ui/shared-ui";
import { BattleAutoplayToggle } from "./autoplay-toggle";
import { BattleTrinketInspectButton, BattleBoonInspectOverlay } from "./trinket-inspect";
import { uniqueRunBoons } from "./unique-run-trinkets";
import { WishOverlay } from "./wish-overlay";
import type { BattleActionsProps, BattleFeedbackProps, BattleRefsProps, BattleScreenData } from "./types";
import { getEnemyStatusChips, getPlayerStatusChips, isAlchemyDevBuild } from "../../../shared/utils";
import { BackgroundParticles } from "../../../shared/ui/background-particles";
import { getScreenParticleConfig } from "@/app/screen-particle-config";

interface BattleScreenProps {
  battleScreenData: BattleScreenData;
  characterId: CharacterId;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  refs: BattleRefsProps;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard | null) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  isAutoplayEnabled: boolean;
  onToggleAutoplay: () => void;
}

export function BattleScreen(props: BattleScreenProps) {
  const {
    battleScreenData,
    characterId,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    refs,
    onCardClick,
    onOpenMenu,
    onWishChoice,
    onSkipCombatDevMode,
    onEndTurn,
    isAutoplayEnabled,
    onToggleAutoplay,
  } = props;

  const { battleState, displayOverrides, activeLabyrinthModifiers, runBoons } = battleScreenData;

  const displayState = useMemo(() => ({ ...battleState, ...displayOverrides }), [battleState, displayOverrides]);

  const isBossBattle = battleState.currentEnemy.enemyType === "boss";
  const { particleColors, particleAlphaMultiplier, particleCount } = getScreenParticleConfig("battle", isBossBattle);
  const particleAlpha = particleAlphaMultiplier ?? 1;

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
      onCardClick,
      onOpenMenu,
      onWishChoice,
      onSkipCombatDevMode,
      onEndTurn,
      isDevMode: isDev,
      isAutoplayEnabled,
      onToggleAutoplay,
    }),
    [onCardClick, onOpenMenu, onWishChoice, onSkipCombatDevMode, onEndTurn, isDev, isAutoplayEnabled, onToggleAutoplay],
  );

  const { battleSceneRef: sceneRef } = refs;

  const inspectBoons = useMemo(() => uniqueRunBoons(runBoons), [runBoons]);
  const [trinketInspectOpen, setTrinketInspectOpen] = useState(false);
  const closeTrinketInspect = useCallback(() => setTrinketInspectOpen(false), []);
  const inspectUiOpen = trinketInspectOpen && inspectBoons.length > 0 && !battleState.wishOptions;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <BackgroundParticles
          variant="embers"
          {...(particleColors ? { colors: particleColors } : {})}
          alphaMultiplier={particleAlpha}
          {...(particleCount ? { particleCount } : {})}
        />
      </div>

      <PageLayout>
        <div className="relative flex w-full max-w-[100rem] flex-1 flex-col p-7 pb-1">
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="absolute top-0 right-0 z-30 flex items-center gap-2">
              <BattleAutoplayToggle enabled={actions.isAutoplayEnabled} onToggle={actions.onToggleAutoplay} />
              {inspectBoons.length > 0 ? (
                <BattleTrinketInspectButton
                  open={inspectUiOpen}
                  onToggle={() => setTrinketInspectOpen((open) => !open)}
                />
              ) : null}
              <HamburgerTrigger onClick={actions.onOpenMenu} label="Open battle menu" />
            </div>

            <div
              ref={sceneRef}
              data-testid="battle-scene"
              className="[container-type:size] absolute inset-0 overflow-hidden"
            >
              <BattleActors view={view} feedback={feedback} refs={refs} />

              <BattleBottomBar view={view} refs={refs} actions={actions} playabilityState={battleState} />

              <WishOverlay open={Boolean(battleState.wishOptions)} battleState={displayState} actions={actions} />

              <BattleBoonInspectOverlay open={inspectUiOpen} trinketIds={runBoons} onClose={closeTrinketInspect} />

              <CardGhostLayer />
              <CardTransferLayer />
            </div>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
