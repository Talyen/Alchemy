// Hero selection screen with character art, keyword previews, tilt, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";

import { KeywordTag } from "../ui/keyword-tag";
import { ScreenHeader, ShimmerOverlay } from "../ui/shared-ui";
import { useShimmerController } from "../hooks";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { cardSurfaceClass, staticCardTransform } from "../config";

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
  const char = characters[id];
  const art = characterArt[char.id];

  return (
    <div
      className="stagger-item relative flex flex-col items-center gap-3"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <button
        type="button"
        className={cn("tilt-surface relative rounded-[20px]", charCardWidthClass, isSelected && "ring-2 ring-primary")}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
        onMouseMove={setTiltFromEvent}
        onMouseEnter={() => {
          onHoverShimmer(id);
          setShowTooltip(true);
        }}
        onMouseLeave={(e) => {
          clearTiltFromEvent(e);
          setShowTooltip(false);
        }}
        onClick={() => onSelect(id)}
      >
        <ShimmerOverlay active={isShimmer} token={shimmerToken} rounded="rounded-[20px]" />
        <img src={art} alt={char.name} className={cn(cardSurfaceClass, "w-full rounded-[20px] aspect-[3/4]")} />
      </button>
      <p className="font-display text-lg font-bold text-amber-100/90 mt-1">{char.name}</p>
      {showTooltip ? (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-xl border border-border/80 bg-card px-4 py-3 text-left shadow-lg">
          <p className="mb-2 font-display text-lg font-bold text-amber-100/90">{char.name}</p>

          {char.startingDeck.length > 0 ? (
            <>
              <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Starting Deck</p>
              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                {char.startingDeck.map((c) => c.title).join(", ")}
              </p>
            </>
          ) : (
            <>
              <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Draft a Deck</p>
              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">Choose your own fate</p>
            </>
          )}

          {char.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {char.keywords.map((kw) => (
                <KeywordTag key={kw} keywordId={kw} pill />
              ))}
            </div>
          ) : (
            <div className="flex">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold leading-none text-amber-100/90"
                style={{ backgroundColor: "color-mix(in srgb, currentColor 15%, transparent)" }}
              >
                All Keywords
              </span>
            </div>
          )}
        </div>
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
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

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
