// Altar of Corruption screen — choose a deck card, corrupt it, and reveal the altered card.
// Depends on card UI primitives, placeholder destination art, and corruption result shape.
// Used by run navigation as a free rare route event with possible upside or downside.
import { useState, type ReactNode } from "react";
import { Dices } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { ANIMATION_STAGGER_UNIT, SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { placeholderDestination, type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { CorruptionResult } from "../corruption";
import { collectionCardWidthClass, handCardWidthClass } from "../config";
import { CardSelectionGrid } from "../ui/card-selection-grid";
import { BattleCardButton, CardTitle, getCardDisplayTitle } from "../ui/card-ui";
import { ScreenDescription, ScreenHeader } from "../ui/shared-ui";

function CorruptionDeckCard({ card, isSelected, onSelect }: { card: BattleCard; isSelected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <BattleCardButton
      card={card}
      hovered={hovered}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onSelect}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={collectionCardWidthClass}
      selected={isSelected}
    />
  );
}

function CorruptionDeckPicker({ runDeck, selectedIndex, onSelect, page, onPageChange, cardRevealDelay = 0 }: { runDeck: BattleCard[]; selectedIndex: number | null; onSelect: (index: number) => void; page: number; onPageChange: (page: number) => void; cardRevealDelay?: number }) {
  const corruptionOptions = runDeck
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => !card.corrupted);

  return (
    <CardSelectionGrid
      items={corruptionOptions}
      page={page}
      onPageChange={onPageChange}
      pageSize={SELECTION_GRID_PAGE_SIZE}
      revealDelay={cardRevealDelay}
      emptyMessage="No uncorrupted cards remain."
      renderItem={({ card, index }) => (
        <CorruptionDeckCard card={card} isSelected={selectedIndex === index} onSelect={() => onSelect(index)} />
      )}
    />
  );
}

function CorruptionActionButton({ children, disabled = false, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <div className={cn("relative rounded-xl", disabled && "opacity-50")}>
      {!disabled && (
        <ShineBorder
          shineColor={["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"]}
          borderWidth={2}
          duration={8}
          className="z-10 rounded-xl"
        />
      )}
      <Button
        size="lg"
        className="relative border border-red-700/90 bg-black text-red-400 hover:bg-red-950/95 hover:text-red-200 disabled:opacity-100"
        disabled={disabled}
        onClick={onClick}
      >
        <Dices className="h-4 w-4" /> {children}
      </Button>
    </div>
  );
}

function CorruptionIntro({ onBegin, onLeave }: { onBegin: () => void; onLeave: () => void }) {
  return (
    <div className="state-swap flex flex-col items-center gap-5">
      <ScreenHeader title="Altar of Corruption" />
      <ScreenDescription className="text-red-100/75">Select a Card to Corrupt</ScreenDescription>
      <BlurFade delay={ANIMATION_STAGGER_UNIT} direction="up" offset={8}>
        <img src={placeholderDestination} alt="Altar of Corruption" className="block w-full max-w-[420px] rounded-[22px] object-contain" loading="eager" decoding="sync" />
      </BlurFade>
      <div className="flex flex-wrap justify-center gap-3">
        <BlurFade delay={ANIMATION_STAGGER_UNIT * 2} direction="up" offset={6}>
          <Button size="lg" variant="outline" onClick={onLeave}>Leave</Button>
        </BlurFade>
        <BlurFade delay={ANIMATION_STAGGER_UNIT * 3} direction="up" offset={6}>
          <CorruptionActionButton onClick={onBegin}>Corrupt a Card</CorruptionActionButton>
        </BlurFade>
      </div>
    </div>
  );
}

function CorruptionResultView({ result, onContinue }: { result: CorruptionResult; onContinue: () => void }) {
  const [hovered, setHovered] = useState(true);

  return (
    <div className="flex flex-col items-center gap-5">
      <ScreenHeader title="Altar of Corruption" />
      <ScreenDescription className="text-red-100/75">The altar returns your card changed.</ScreenDescription>
      <BlurFade delay={ANIMATION_STAGGER_UNIT} direction="up" offset={8}>
        <div className="flex flex-col items-center gap-3">
          <BattleCardButton card={result.corruptedCard} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${getCardDisplayTitle(result.corruptedCard)}`} shimmerActive={false} shimmerToken={undefined} className={handCardWidthClass} />
          <p className="text-base font-semibold text-foreground"><CardTitle card={result.corruptedCard} /></p>
        </div>
      </BlurFade>
      <BlurFade delay={ANIMATION_STAGGER_UNIT * 2} direction="up" offset={6}>
        <Button size="lg" onClick={onContinue}>Continue</Button>
      </BlurFade>
    </div>
  );
}

export function CorruptionScreen({ runDeck, result, onCorrupt, onLeave, onContinue }: { runDeck: BattleCard[]; result: CorruptionResult | null; onCorrupt: (cardIndex: number) => void; onLeave: () => void; onContinue: () => void }) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  function handleConfirm() {
    if (selectedIndex === null) return;
    onCorrupt(selectedIndex);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      {result ? (
        <CorruptionResultView result={result} onContinue={onContinue} />
      ) : selecting ? (
        <div className="state-swap">
          <ScreenHeader title="Altar of Corruption" />
          <ScreenDescription className="mb-4 mt-3 text-red-100/75">Select one card. The altar may weaken, strengthen, or remake it.</ScreenDescription>
          <CorruptionDeckPicker runDeck={runDeck} selectedIndex={selectedIndex} onSelect={setSelectedIndex} page={page} onPageChange={setPage} cardRevealDelay={ANIMATION_STAGGER_UNIT} />
          <div className="mt-5 flex justify-center gap-3">
            <BlurFade delay={ANIMATION_STAGGER_UNIT * 9} direction="up" offset={6}>
              <Button variant="ghost" onClick={() => { setSelecting(false); setSelectedIndex(null); setPage(0); }}>Cancel</Button>
            </BlurFade>
            <BlurFade delay={ANIMATION_STAGGER_UNIT * 10} direction="up" offset={6}>
              <CorruptionActionButton disabled={selectedIndex === null} onClick={handleConfirm}>Corrupt</CorruptionActionButton>
            </BlurFade>
          </div>
        </div>
      ) : (
        <CorruptionIntro onBegin={() => { setSelecting(true); setPage(0); }} onLeave={onLeave} />
      )}
    </div>
  );
}
