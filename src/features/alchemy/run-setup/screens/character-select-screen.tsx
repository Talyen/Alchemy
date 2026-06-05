// Hero selection screen with character art, keyword previews, tilt, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";

import { KeywordTag } from "../../shared/ui/keyword-tag";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import {
  TooltipBody,
  TooltipHeader,
  TooltipPanel,
  TooltipSubheader,
  useTooltipFlip,
} from "../../shared/ui/tooltip-panel";
import { cardSurfaceClass } from "@/features/alchemy/shared/config";
import { useUiStore } from "../../shared/stores/ui-store";

const charCardWidthClass = "w-[clamp(18vh,20.5vh,28vh)]";

function CharacterCard({
  id,
  index,
  isSelected,
  isShimmer,
  shimmerToken,
  onSelect,
  onHoverShimmer,
}: {
  id: CharacterId;
  index: number;
  isSelected: boolean;
  isShimmer: boolean;
  shimmerToken: number | undefined;
  onSelect: (id: CharacterId) => void;
  onHoverShimmer: (id: CharacterId) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref: tooltipRef, flip } = useTooltipFlip(showTooltip);
  const char = characters[id];
  const art = characterArt[char.id];

  return (
    <div
      className={cn("stagger-item relative flex flex-col items-center gap-3", showTooltip && "z-50")}
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <TiltSurface
        as="button"
        ariaLabel={`Select ${char.name}`}
        className={cn(charCardWidthClass, "relative rounded-shell-tooltip")}
        shimmerActive={isShimmer}
        shimmerToken={shimmerToken}
        shimmerRounded="rounded-shell-tooltip"
        selected={isSelected}
        onClick={() => onSelect(id)}
        onMouseEnter={() => {
          onHoverShimmer(id);
          setShowTooltip(true);
        }}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <img src={art} alt={char.name} className={cn(cardSurfaceClass, "w-full rounded-shell-tooltip aspect-[3/4]")} />
      </TiltSurface>
      <p className="font-display text-lg font-bold text-amber-100/90 mt-1">{char.name}</p>
      {showTooltip ? (
        <TooltipPanel
          width="w-80"
          ref={tooltipRef}
          className={cn("z-50", flip ? "top-full mt-2 bottom-auto" : "mb-2")}
          flip={flip}
        >
          <TooltipHeader>{char.name}</TooltipHeader>

          <TooltipBody>
            <p>{char.description}</p>
          </TooltipBody>

          {char.startingDeck.length > 0 ? (
            <>
              <TooltipSubheader>Starting Deck</TooltipSubheader>
              <TooltipBody>
                <p>{char.startingDeck.map((c) => c.title).join(", ")}</p>
              </TooltipBody>
            </>
          ) : (
            <>
              <TooltipSubheader>Draft a Deck</TooltipSubheader>
              <TooltipBody>
                <p>Choose your own fate</p>
              </TooltipBody>
            </>
          )}

          {char.keywords.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {char.keywords.map((kw) => (
                <KeywordTag key={kw} keywordId={kw} pill />
              ))}
            </div>
          ) : (
            <div className="mt-2 flex">
              <span className="character-keyword-pill-tint inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold leading-none text-amber-100/90">
                All Keywords
              </span>
            </div>
          )}
        </TooltipPanel>
      ) : null}
    </div>
  );
}

export function CharacterSelectScreen({
  onConfirm,
  onBack,
}: {
  onConfirm: (characterId: CharacterId) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const shimmerState = useUiStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-4 text-center">
      <ScreenHeader title="Choose Your Hero" />

      <div className="grid grid-cols-2 justify-items-center gap-x-8 gap-y-6 sm:grid-cols-4">
        {charIds.map((id, index) => (
          <CharacterCard
            key={id}
            id={id}
            index={index}
            isSelected={selectedId === id}
            isShimmer={shimmerState?.cardId === id}
            shimmerToken={shimmerState?.token}
            onSelect={setSelectedId}
            onHoverShimmer={maybeTriggerShimmer}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
            Back
          </Button>
          <Button
            size="lg"
            className="w-40"
            disabled={!selectedChar}
            onClick={() => {
              if (selectedChar) onConfirm(selectedChar.id);
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
