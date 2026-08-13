import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  gameModeMeta,
  bodyTextClass,
  chooserArtWidthClass,
  chooserPaddedTileClass,
  chooserRowGapClass,
  chooserRowShellWidthClass,
  sectionTitleClass,
} from "@/features/alchemy/shared/config";
import { PressableSound } from "../../shared/ui/pressable-sound";
import { ActionButtonRow, TitledScreenShell } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
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

function handleModeSelect(modeId: GameModeId, isLocked: boolean, setSelectedModeId: (id: GameModeId) => void) {
  if (isLocked) {
    playUISound("error");
  } else {
    setSelectedModeId(modeId);
  }
}

function GameModeTile({
  modeId,
  meta,
  isLocked,
  isSelected,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  modeId: GameModeId;
  meta: GameModeMeta;
  isLocked: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
}) {
  // Each tile owns its tooltip anchor so the lock tooltip positions beside the
  // hovered tile — a ref shared across the list would resolve to the last tile.
  const tileRef = useRef<HTMLDivElement>(null);

  return (
    <div className={chooserPaddedTileClass}>
      <div ref={tileRef} className="relative h-full w-full min-w-0">
        <PressableSound className="block h-full w-full">
          <TiltSurface
            as="button"
            tiltEnabled={!isLocked}
            ariaLabel={meta.title}
            ariaPressed={isSelected}
            selected={isSelected}
            onClick={onSelect}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            className={cn(
              "flex h-full w-full min-w-0 flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-5 pt-6 pb-7 text-left",
              isLocked && "cursor-not-allowed opacity-50 grayscale-[30%]",
            )}
          >
            <img
              src={meta.art}
              alt=""
              aria-hidden
              className={cn(chooserArtWidthClass, "rounded-shell-card object-contain")}
            />
            <h2 className={cn("text-center font-sans", sectionTitleClass)}>{meta.title}</h2>
            <p className={cn(bodyTextClass, "text-center")}>{meta.description}</p>
          </TiltSurface>
        </PressableSound>
        {isHovered && isLocked && (
          <PortaledTooltip triggerRef={tileRef} visible className="text-center">
            <TooltipHeader>{meta.title}</TooltipHeader>
            <TooltipBody>
              <p>{getGameModeUnlockMessage(modeId)}</p>
            </TooltipBody>
          </PortaledTooltip>
        )}
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
  onBack,
  onOpenMenu,
}: {
  hasActiveRun: boolean;
  activeContentSystemType?: string | null;
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onBack: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const [selectedModeId, setSelectedModeId] = useState<GameModeId | null>(null);
  const [hoveredModeId, setHoveredModeId] = useState<GameModeId | null>(null);
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

  const selected = selectedModeId ? handlers[selectedModeId] : null;
  const buttonLabel = selectedModeId && hasResume[selectedModeId] ? "Resume" : "Play";

  return (
    <TitledScreenShell
      title="Choose Your Adventure"
      onOpenMenu={onOpenMenu}
      menuLabel="Open game mode menu"
      maxWidthClass={chooserRowShellWidthClass}
    >
      <div className={cn("mt-6 flex w-full flex-nowrap items-stretch justify-center", chooserRowGapClass)}>
        {GAME_MODE_IDS.map((modeId) => {
          const meta = gameModeMeta[modeId];
          if (!meta) return null;
          const isLocked = !isGameModeUnlocked(modeId, finishedRunCharacters);
          const isSelected = selectedModeId === modeId;

          return (
            <GameModeTile
              key={modeId}
              modeId={modeId}
              meta={meta}
              isLocked={isLocked}
              isSelected={isSelected}
              isHovered={hoveredModeId === modeId}
              onHoverStart={() => setHoveredModeId(modeId)}
              onHoverEnd={() => setHoveredModeId(null)}
              onSelect={() => handleModeSelect(modeId, isLocked, setSelectedModeId)}
            />
          );
        })}
      </div>

      <ActionButtonRow
        className="mt-6"
        width="dialog"
        secondary={{ label: "Back", onClick: onBack }}
        primary={{
          label: buttonLabel,
          disabled: !selected,
          onClick: () => {
            selected?.();
          },
        }}
      />
    </TitledScreenShell>
  );
}
