import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  gameModeMeta,
  cardInteractiveGlowClass,
  gameModeArtWidthClass,
  gameModePaddedTileClass,
  chooserRowGapClass,
  gameModeRowShellWidthClass,
} from "@/features/alchemy/shared/config";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";
import { useFinishedRunCharacters } from "../../shared/stores/profile-store";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader } from "../../shared/ui/tooltip-panel";
import { PortaledTooltip } from "../../shared/ui/portaled-tooltip";
import {
  getGameModeUnlockMessage,
  isGameModeUnlocked,
  type GameModeId,
} from "@/features/alchemy/shared/config/game-data-catalog";

const GAME_MODE_IDS: readonly GameModeId[] = ["campaign", "labyrinth", "wildwood"];

type GameModeMeta = (typeof gameModeMeta)[string];

function GameModeTile({
  modeId,
  meta,
  isLocked,
  canResume,
  onSelect,
}: {
  modeId: GameModeId;
  meta: GameModeMeta;
  isLocked: boolean;
  canResume: boolean;
  onSelect: () => void;
}) {
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("game-mode", modeId);
  const artWrapperRef = useRef<HTMLButtonElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const Icon = meta.icon;
  const ariaLabel = isLocked ? `${meta.title} (Locked)` : canResume ? `Resume ${meta.title}` : meta.title;

  return (
    <div className={cn("group flex flex-col items-center gap-5", gameModePaddedTileClass)}>
      <TiltSurface
        as="button"
        buttonRef={artWrapperRef}
        tiltEnabled={false}
        ariaLabel={ariaLabel}
        onClick={() => {
          if (isLocked) {
            playUISound("error");
            return;
          }
          onSelect();
        }}
        onMouseEnter={() => {
          setTooltipVisible(true);
          onHoverStart();
        }}
        onMouseLeave={() => {
          setTooltipVisible(false);
          onHoverEnd();
        }}
        onFocus={() => {
          setTooltipVisible(true);
          onHoverStart();
        }}
        onBlur={() => {
          setTooltipVisible(false);
          onHoverEnd();
        }}
        shimmerActive={isLocked ? false : shimmerActive}
        shimmerToken={isLocked ? undefined : shimmerToken}
        shimmerRounded="rounded-shell-card"
        className={cn(
          "group relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md focus:outline-none",
          gameModeArtWidthClass,
          !isLocked && cardInteractiveGlowClass,
          isLocked && "cursor-not-allowed opacity-50 grayscale-[30%]",
        )}
      >
        <img
          src={meta.art}
          alt=""
          aria-hidden
          className="pointer-events-none h-full w-full object-cover select-none"
          draggable={false}
        />
      </TiltSurface>
      {tooltipVisible ? (
        <PortaledTooltip triggerRef={artWrapperRef} visible className="text-center">
          <TooltipHeader>{meta.title}</TooltipHeader>
          <TooltipBody>
            {isLocked ? (
              <p>{getGameModeUnlockMessage(modeId)}</p>
            ) : (
              <>
                <p>{meta.description}</p>
                {canResume ? <p>Resume your run</p> : null}
              </>
            )}
          </TooltipBody>
        </PortaledTooltip>
      ) : null}
      <div className="pointer-events-none flex items-center justify-center gap-2.5 pt-1 text-center select-none">
        <Icon className={cn("h-5 w-5 shrink-0", meta.accentClassName)} />
        <span className={cn("font-sans text-lg font-bold tracking-wide sm:text-xl", meta.accentClassName)}>
          {meta.title}
        </span>
      </div>
    </div>
  );
}

export function GameModeSelectScreen({
  hasActiveRun,
  activeContentSystemType,
  onSelectCampaign,
  onSelectLabyrinth,
  onSelectWildwood,
  onOpenMenu,
}: {
  hasActiveRun: boolean;
  activeContentSystemType?: string | null;
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const finishedRunCharacters = useFinishedRunCharacters();

  const handlers: Record<GameModeId, () => void> = {
    campaign: onSelectCampaign,
    labyrinth: onSelectLabyrinth,
    wildwood: onSelectWildwood,
  };
  const hasResume: Record<GameModeId, boolean> = {
    campaign: hasActiveRun && activeContentSystemType === "campaign",
    labyrinth: hasActiveRun && activeContentSystemType === "labyrinth",
    wildwood: hasActiveRun && activeContentSystemType === "wildwood",
  };

  return (
    <TitledScreenShell
      title="Choose Your Adventure"
      onOpenMenu={onOpenMenu}
      menuLabel="Open game mode menu"
      minHeightClass="min-h-[50cqh]"
      maxWidthClass={gameModeRowShellWidthClass}
    >
      <div className="my-auto flex flex-1 flex-col justify-center py-4">
        <div className={cn("flex w-full flex-nowrap items-start justify-center", chooserRowGapClass)}>
          {GAME_MODE_IDS.map((modeId) => {
            const meta = gameModeMeta[modeId];
            if (!meta) return null;
            const isLocked = !isGameModeUnlocked(modeId, finishedRunCharacters);

            return (
              <GameModeTile
                key={modeId}
                modeId={modeId}
                meta={meta}
                isLocked={isLocked}
                canResume={hasResume[modeId]}
                onSelect={handlers[modeId]}
              />
            );
          })}
        </div>
      </div>
    </TitledScreenShell>
  );
}
