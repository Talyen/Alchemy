import { useState } from "react";
import { cn } from "@/lib/utils";
import { gameModeMeta } from "@/features/alchemy/shared/config";
import { PressableMotion } from "../../shared/ui/pressable-motion";
import { ActionButtonRow, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { useAppStore } from "../../shared/stores/app-store";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader, TooltipPanel } from "../../shared/ui/tooltip-panel";

const GAME_MODE_IDS = ["campaign", "labyrinth", "wildwood"] as const;
type GameModeId = (typeof GAME_MODE_IDS)[number];

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
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);

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
          const isLocked =
            (modeId === "labyrinth" && !finishedRunCharacters.includes("rogue")) ||
            (modeId === "wildwood" && !finishedRunCharacters.includes("ranger"));
          const isSelected = selectedModeId === modeId;
          const selectMode = () => handleModeSelect(modeId, isLocked, setSelectedModeId);

          return (
            <StaggerItem key={modeId} index={index} className="relative">
              <PressableMotion>
                <TiltSurface
                  as="button"
                  tiltEnabled={!isLocked}
                  ariaLabel={meta.title}
                  ariaPressed={isSelected}
                  onClick={selectMode}
                  onMouseEnter={() => setHoveredModeId(modeId)}
                  onMouseLeave={() => setHoveredModeId(null)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-8 pb-7 pt-6 text-left",
                    isSelected && "ring-2 ring-primary",
                    isLocked && "cursor-not-allowed opacity-50 grayscale-[30%]",
                  )}
                >
                  <img
                    src={meta.art}
                    alt=""
                    aria-hidden
                    className="w-full max-w-[32.59cqh] rounded-shell-card object-contain"
                  />
                  <h2 className="font-display text-base font-bold text-amber-100/75">{meta.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
                </TiltSurface>
              </PressableMotion>
              {hoveredModeId === modeId && isLocked && (
                <TooltipPanel width="w-64" visible className="z-50 mb-3 text-center">
                  <TooltipHeader>{meta.title}</TooltipHeader>
                  <TooltipBody>
                    <p>
                      {modeId === "labyrinth"
                        ? "Finish a Run as the Rogue to unlock"
                        : "Finish a Run as the Ranger to unlock"}
                    </p>
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
