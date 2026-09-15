import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  gameModeMeta,
  gameModeArtWidthClass,
  gameModePaddedTileClass,
  chooserLockedSurfaceClass,
  chooserRowGapClass,
  gameModeRowShellWidthClass,
} from "@/features/alchemy/shared/config";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { ChooserArtTile } from "../../shared/ui/chooser-art-tile";
import { playUISound } from "@/lib/audio";
import { renderUnlockMessage } from "../../shared/ui/unlock-text";
import { TooltipBody, TooltipHeader } from "../../shared/ui/tooltips/tooltip-panel";
import { PortaledTooltip } from "../../shared/ui/tooltips/portaled-tooltip";
import {
  getGameModeUnlockMessage,
  isGameModeUnlocked,
  type CharacterId,
  type GameModeId,
} from "@/features/alchemy/shared/config/game-data-catalog";

const GAME_MODE_IDS: readonly GameModeId[] = ["campaign", "labyrinth", "wildwood"];

type GameModeMeta = (typeof gameModeMeta)[string];

function GameModeTile({
  modeId,
  meta,
  isLocked,
  onSelect,
}: {
  modeId: GameModeId;
  meta: GameModeMeta;
  isLocked: boolean;
  onSelect: () => void;
}) {
  const Icon = meta.icon;
  const ariaLabel = isLocked ? `${meta.title} (Locked)` : meta.title;
  const tileTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <ChooserArtTile
      interactionKey="game-mode"
      interactionId={modeId}
      art={meta.art}
      icon={Icon}
      label={meta.title}
      ariaLabel={ariaLabel}
      accentClassName={meta.accentClassName}
      plasmaColorPair={isLocked ? null : meta.plasmaColorPair}
      widthClass={gameModeArtWidthClass}
      paddedTileClass={gameModePaddedTileClass}
      disabled={isLocked}
      surfaceClassName={isLocked ? chooserLockedSurfaceClass : undefined}
      onClick={() => {
        if (isLocked) {
          playUISound("error");
          return;
        }
        onSelect();
      }}
      tooltipTriggerRef={tileTriggerRef}
      renderTooltip={(visible) =>
        visible ? (
          <PortaledTooltip triggerRef={tileTriggerRef} visible className="text-center">
            <TooltipHeader>{meta.title}</TooltipHeader>
            <TooltipBody>
              {isLocked ? <p>{renderUnlockMessage(getGameModeUnlockMessage(modeId))}</p> : <p>{meta.description}</p>}
            </TooltipBody>
          </PortaledTooltip>
        ) : null
      }
    />
  );
}

export function GameModeSelectScreen({
  finishedRunCharacters,
  onSelectCampaign,
  onSelectLabyrinth,
  onSelectWildwood,
  onBack,
  onMenu,
}: {
  finishedRunCharacters: CharacterId[];
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  const handlers: Record<GameModeId, () => void> = {
    campaign: onSelectCampaign,
    labyrinth: onSelectLabyrinth,
    wildwood: onSelectWildwood,
  };

  return (
    <TitledScreenShell
      title="Choose a Path"
      minHeightClass="min-h-[50cqh]"
      maxWidthClass={gameModeRowShellWidthClass}
      onBack={onBack}
      onMenu={onMenu}
    >
      <div className="my-auto flex flex-1 flex-col justify-center py-4">
        <div className={cn("flex w-full flex-nowrap items-start justify-center", chooserRowGapClass)}>
          {GAME_MODE_IDS.map((modeId) => {
            const meta = gameModeMeta[modeId];
            if (!meta) return null;
            const isLocked = !isGameModeUnlocked(modeId, finishedRunCharacters);

            return (
              <GameModeTile key={modeId} modeId={modeId} meta={meta} isLocked={isLocked} onSelect={handlers[modeId]} />
            );
          })}
        </div>
      </div>
    </TitledScreenShell>
  );
}
