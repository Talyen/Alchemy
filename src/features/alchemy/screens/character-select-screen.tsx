// Character selection screen with hover-shimmer effect on cards.
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { characters, characterArt, type CharacterGender, type CharacterId } from "@/lib/game-data";

import { KeywordTag } from "../ui/keyword-tag";
import { ShimmerOverlay } from "../ui/shared-ui";
import { useShimmerController } from "../hooks";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { battleCardWidthClass, cardSurfaceClass, staticCardTransform } from "../config";

const defaultGender: Record<CharacterId, CharacterGender> = {
  knight: "male",
  rogue: "male",
  wizard: "female",
};

function CharacterCard({ id, isSelected, isShimmer, shimmerToken, onSelect, onHoverShimmer }: { id: CharacterId; isSelected: boolean; isShimmer: boolean; shimmerToken?: number; onSelect: (id: CharacterId) => void; onHoverShimmer: (id: CharacterId) => void }) {
  const char = characters[id];
  const gender = defaultGender[id];
  const art = characterArt[char.id][gender];

  return (
    <div className="flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-6 pb-6 pt-5">
      <button type="button" className={cn("tilt-surface relative rounded-[22px]", battleCardWidthClass, isSelected && "ring-2 ring-primary")} style={{ "--card-base-transform": staticCardTransform } as CSSProperties} data-tilt-strength="15" onMouseMove={setTiltFromEvent} onMouseEnter={() => onHoverShimmer(id)} onMouseLeave={clearTiltFromEvent} onClick={() => onSelect(id)}>
        <ShimmerOverlay active={isShimmer} token={shimmerToken} rounded="rounded-[22px]" />
        <img src={art} alt={char.name} className={cn(cardSurfaceClass, "w-full rounded-[22px]")} />
      </button>
      <p className="text-2xl font-semibold text-foreground">{char.name}</p>
      <div className="flex flex-wrap justify-center gap-1">{char.keywords.map((kw) => <KeywordTag key={kw} keywordId={kw} pill />)}</div>
    </div>
  );
}

export function CharacterSelectScreen({ onConfirm, onBack }: { onConfirm: (characterId: CharacterId, gender: CharacterGender) => void; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <h1 className="text-4xl font-semibold text-foreground">Choose Your Hero</h1>

      <div className="flex flex-wrap items-start justify-center gap-12">
        {charIds.map((id) => <CharacterCard key={id} id={id} isSelected={selectedId === id} isShimmer={shimmerState?.cardId === id} shimmerToken={shimmerState?.token} onSelect={setSelectedId} onHoverShimmer={maybeTriggerShimmer} />)}
      </div>

      <div className="mt-6 flex gap-4">
        <Button size="lg" className="w-40" disabled={!selectedChar} onClick={() => { if (selectedChar) onConfirm(selectedChar.id, defaultGender[selectedChar.id]); }}>Continue</Button>
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
