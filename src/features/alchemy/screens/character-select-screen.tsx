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
import { battleCardWidthClass, cardSurfaceClass, staticCardTransform } from "../config";

function CharacterCard({ id, index, isSelected, isShimmer, shimmerToken, onSelect, onHoverShimmer }: { id: CharacterId; index: number; isSelected: boolean; isShimmer: boolean; shimmerToken: number | undefined; onSelect: (id: CharacterId) => void; onHoverShimmer: (id: CharacterId) => void }) {
  const char = characters[id];
  const art = characterArt[char.id];

  return (
    <div className={cn("stagger-item flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-6 pb-6 pt-5", isSelected && "ring-2 ring-primary")} style={{ "--stagger-index": index } as CSSProperties}>
      <button type="button" className={cn("tilt-surface relative rounded-[22px]", battleCardWidthClass)} style={{ "--card-base-transform": staticCardTransform } as CSSProperties} data-tilt-strength="15" onMouseMove={setTiltFromEvent} onMouseEnter={() => onHoverShimmer(id)} onMouseLeave={clearTiltFromEvent} onClick={() => onSelect(id)}>
        <ShimmerOverlay active={isShimmer} token={shimmerToken} rounded="rounded-[22px]" />
        <img src={art} alt={char.name} className={cn(cardSurfaceClass, "w-full rounded-[22px]")} />
      </button>
      <p className="text-[22px] text-amber-100/75">{char.name}</p>
      <div className="flex flex-wrap justify-center gap-1">{char.keywords.map((kw) => <KeywordTag key={kw} keywordId={kw} pill />)}</div>
    </div>
  );
}

export function CharacterSelectScreen({ onConfirm, onBack }: { onConfirm: (characterId: CharacterId) => void; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Hero" />

      <div className="flex flex-wrap items-start justify-center gap-12">
        {charIds.map((id, index) => <CharacterCard key={id} id={id} index={index} isSelected={selectedId === id} isShimmer={shimmerState?.cardId === id} shimmerToken={shimmerState?.token} onSelect={setSelectedId} onHoverShimmer={maybeTriggerShimmer} />)}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-4">
        <Button size="lg" className="w-40" disabled={!selectedChar} onClick={() => { if (selectedChar) onConfirm(selectedChar.id); }}>Continue</Button>
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>Back</Button>
        </div>
      </div>
    </div>
  );
}
