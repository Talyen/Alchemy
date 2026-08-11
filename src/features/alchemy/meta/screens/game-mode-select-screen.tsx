import { useState } from "react";
import { cn } from "@/lib/utils";
import { gameModeMeta, bodyTextClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import { PressableSound } from "../../shared/ui/pressable-sound";
import { ActionButtonRow, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { useFinishedRunCharacters } from "../../shared/stores/profile-store";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader, TooltipPanel } from "../../shared/ui/tooltip-panel";
import {
  getGameModeUnlockMessage,
  isGameModeUnlocked,
  type GameModeId,
} from "@/features/alchemy/shared/config/game-data-catalog";

const GAME_MODE_IDS: readonly GameModeId[] = ["campaign", "labyrinth", "wildwood"];

function handleModeSelect(modeId: GameModeId, isLocked: boolean, setSelectedModeId: (id: GameModeId) => void) {
  if (isLocked) {
    playUISound("error");
  } else {
    setSelectedModeId(modeId);
  }
}

export function GameModeSelectScreen({
  hasActiveRun,
  activeContentSystemType,
  onSelectCampaign,
  onSelectLabyrinth,
  onSelectWildwood,
  onBack,
}: {
  hasActiveRun: boolean;
  activeContentSystemType?: string | null;
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onBack: () => void;
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Adventure" />

      <StaggerGroup className="flex flex-wrap items-start justify-center gap-8">
        {GAME_MODE_IDS.map((modeId, index) => {
          const meta = gameModeMeta[modeId];
          if (!meta) return null;
          const isLocked = !isGameModeUnlocked(modeId, finishedRunCharacters);
          const isSelected = selectedModeId === modeId;
          const selectMode = () => handleModeSelect(modeId, isLocked, setSelectedModeId);

          return (
            <StaggerItem key={modeId} index={index} className="relative">
              <PressableSound>
                <TiltSurface
                  as="button"
                  tiltEnabled={!isLocked}
                  ariaLabel={meta.title}
                  ariaPressed={isSelected}
                  selected={isSelected}
                  onClick={selectMode}
                  onMouseEnter={() => setHoveredModeId(modeId)}
                  onMouseLeave={() => setHoveredModeId(null)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-8 pt-6 pb-7 text-left",
                    isLocked && "cursor-not-allowed opacity-50 grayscale-[30%]",
                  )}
                >
                  <img
                    src={meta.art}
                    alt=""
                    aria-hidden
                    className="w-full max-w-[39.11cqh] rounded-shell-card object-contain"
                  />
                  <h2 className={cn("font-sans", sectionTitleClass)}>{meta.title}</h2>
                  <p className={bodyTextClass}>{meta.description}</p>
                </TiltSurface>
              </PressableSound>
              {hoveredModeId === modeId && isLocked && (
                <TooltipPanel width="w-64" visible className="z-50 mb-3 text-center">
                  <TooltipHeader>{meta.title}</TooltipHeader>
                  <TooltipBody>
                    <p>{getGameModeUnlockMessage(modeId)}</p>
                  </TooltipBody>
                </TooltipPanel>
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <ActionButtonRow
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
    </div>
  );
}
