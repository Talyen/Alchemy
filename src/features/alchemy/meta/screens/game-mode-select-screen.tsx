import { useState } from "react";
import type { CSSProperties } from "react";
import type { MotionStyle } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gameModeMeta, staticCardTransform } from "@/features/alchemy/config";
import { PressableMotion } from "../../shared/ui/pressable-motion";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { clearTiltFromEvent, setTiltFromEvent } from "../../shared/utils";

const GAME_MODE_IDS = ["campaign", "labyrinth", "wildwood"] as const;
type GameModeId = (typeof GAME_MODE_IDS)[number];

export function GameModeSelectScreen({
  hasActiveRun,
  onSelectCampaign,
  onSelectLabyrinth,
  onSelectWildwood,
  onBack,
}: {
  hasActiveRun: boolean;
  onSelectCampaign: () => void;
  onSelectLabyrinth: () => void;
  onSelectWildwood: () => void;
  onBack: () => void;
}) {
  const [selectedModeId, setSelectedModeId] = useState<GameModeId | null>(null);

  const handlers: Record<GameModeId, () => void> = {
    campaign: onSelectCampaign,
    labyrinth: onSelectLabyrinth,
    wildwood: onSelectWildwood,
  };
  const hasResume: Record<GameModeId, boolean> = {
    campaign: hasActiveRun,
    labyrinth: hasActiveRun,
    wildwood: false,
  };

  const selected = selectedModeId ? handlers[selectedModeId] : null;
  const buttonLabel = selectedModeId && hasResume[selectedModeId] ? "Resume" : "Play";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Adventure" />

      <div className="flex flex-wrap items-start justify-center gap-8">
        {GAME_MODE_IDS.map((modeId, index) => {
          const meta = gameModeMeta[modeId];
          return (
            <PressableMotion
              key={modeId}
              className="stagger-item"
              style={{ "--stagger-index": index } as MotionStyle}
              disableHoverScale
            >
              <button
                type="button"
                aria-label={meta.title}
                aria-pressed={selectedModeId === modeId}
                onClick={() => setSelectedModeId(modeId)}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-8 pb-7 pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selectedModeId === modeId && "ring-2 ring-primary",
                )}
              >
                <div
                  className="tilt-surface rounded-shell-card"
                  style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
                  onMouseMove={setTiltFromEvent}
                  onMouseLeave={clearTiltFromEvent}
                >
                  <img
                    src={meta.art}
                    alt={meta.title}
                    className="w-full max-w-[32.59cqh] rounded-shell-card object-contain"
                  />
                </div>
                <h2 className="font-display text-base font-bold text-amber-100/75">{meta.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
              </button>
            </PressableMotion>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          className="w-40"
          disabled={!selected}
          onClick={() => {
            selected?.();
          }}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
