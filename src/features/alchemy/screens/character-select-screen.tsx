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

function CharacterCard({ id, gender, index, isSelected, isShimmer, shimmerToken, onSelect, onHoverShimmer }: { id: CharacterId; gender: CharacterGender; index: number; isSelected: boolean; isShimmer: boolean; shimmerToken?: number; onSelect: (id: CharacterId) => void; onHoverShimmer: (id: CharacterId) => void }) {
  const char = characters[id];
  const art = characterArt[char.id][gender];

  return (
    <div className={cn("stagger-item flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-6 pb-6 pt-5", isSelected && "ring-2 ring-primary")} style={{ "--stagger-index": index } as CSSProperties}>
      <button type="button" className={cn("tilt-surface relative rounded-[22px]", battleCardWidthClass)} style={{ "--card-base-transform": staticCardTransform } as CSSProperties} data-tilt-strength="15" onMouseMove={setTiltFromEvent} onMouseEnter={() => onHoverShimmer(id)} onMouseLeave={clearTiltFromEvent} onClick={() => onSelect(id)}>
        <ShimmerOverlay active={isShimmer} token={shimmerToken} rounded="rounded-[22px]" />
        <img src={art} alt={char.name} className={cn(cardSurfaceClass, "w-full rounded-[22px]")} />
      </button>
      <p className="text-2xl text-foreground">{char.name}</p>
      <div className="flex flex-wrap justify-center gap-1">{char.keywords.map((kw) => <KeywordTag key={kw} keywordId={kw} pill />)}</div>
    </div>
  );
}

function GenderToggle({ gender, onChange }: { gender: CharacterGender; onChange: (gender: CharacterGender) => void }) {
  const genderOptions: { value: CharacterGender; label: string; className: string }[] = [
    { value: "male", label: "♂", className: "text-sky-200 hover:bg-sky-500/10 hover:text-sky-100 data-[selected=true]:border-sky-300/45 data-[selected=true]:bg-sky-500/20 data-[selected=true]:text-sky-100" },
    { value: "female", label: "♀", className: "text-rose-200 hover:bg-rose-500/10 hover:text-rose-100 data-[selected=true]:border-rose-300/45 data-[selected=true]:bg-rose-500/20 data-[selected=true]:text-rose-100" },
  ];

  return (
    <div className="flex rounded-full border border-border/50 bg-background/35 p-1" aria-label="Character gender variant">
      {genderOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn("h-8 w-9 rounded-full border border-transparent text-lg leading-none transition-colors active:scale-95", option.className)}
          data-selected={gender === option.value}
          aria-label={`${option.value} character variant`}
          aria-pressed={gender === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CharacterSelectScreen({ onConfirm, onBack }: { onConfirm: (characterId: CharacterId, gender: CharacterGender) => void; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const [selectedGender, setSelectedGender] = useState<CharacterGender>("male");
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <h1 className="text-4xl text-foreground">Choose Your Hero</h1>

      <div className="flex flex-wrap items-start justify-center gap-12">
        {charIds.map((id, index) => <CharacterCard key={id} id={id} gender={selectedGender} index={index} isSelected={selectedId === id} isShimmer={shimmerState?.cardId === id} shimmerToken={shimmerState?.token} onSelect={setSelectedId} onHoverShimmer={maybeTriggerShimmer} />)}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <GenderToggle gender={selectedGender} onChange={setSelectedGender} />
        <div className="flex gap-4">
        <Button size="lg" className="w-40" disabled={!selectedChar} onClick={() => { if (selectedChar) onConfirm(selectedChar.id, selectedGender); }}>Continue</Button>
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>Back</Button>
        </div>
      </div>
    </div>
  );
}
