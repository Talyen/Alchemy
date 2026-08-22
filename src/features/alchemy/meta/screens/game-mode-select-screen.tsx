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
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { ChooserArtTile } from "../../shared/ui/chooser-art-tile";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader } from "../../shared/ui/tooltip-panel";
import { PortaledTooltip } from "../../shared/ui/portaled-tooltip";
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
  canResume,
  onSelect,
}: {
  modeId: GameModeId;
  meta: GameModeMeta;
  isLocked: boolean;
  canResume: boolean;
  onSelect: () => void;
}) {
  const Icon = meta.icon;
  const ariaLabel = isLocked ? `${meta.title} (Locked)` : canResume ? `Resume ${meta.title}` : meta.title;
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
        ) : null
      }
    />
  );
}

export function GameModeSelectScreen({
  resumableModes,
  finishedRunCharacters,
  onSelectCampaign,
  onSelectLabyrinth,
  onSelectWildwood,
  onOpenMenu,
}: {
  resumableModes: Record<GameModeId, boolean>;
  finishedRunCharacters: CharacterId[];
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const handlers: Record<GameModeId, () => void> = {
    campaign: onSelectCampaign,
    labyrinth: onSelectLabyrinth,
    wildwood: onSelectWildwood,
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
                canResume={resumableModes[modeId]}
                onSelect={handlers[modeId]}
              />
            );
          })}
        </div>
      </div>
    </TitledScreenShell>
  );
}
