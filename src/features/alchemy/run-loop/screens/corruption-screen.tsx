// Altar of Corruption screen — choose a deck card, corrupt it, and reveal the altered card.
// Depends on card UI primitives, placeholder destination art, and corruption result shape.
// Used by run navigation as a free rare route event with possible upside or downside.
import { useMemo, useState, type ReactNode } from "react";
import { Dices, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { corruptionAltar, type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { CorruptionResult } from "../corruption";
import { viewCardWidthClass } from "@/features/alchemy/config";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import { BattleCardButton } from "../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { ScreenDescription, ScreenHeader } from "../../shared/ui/shared-ui";

function CorruptionDeckCard({
  card,
  isSelected,
  onSelect,
}: {
  card: BattleCard;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
      className={cn(viewCardWidthClass, isSelected && "ring-2 ring-red-500/70 ring-offset-4 ring-offset-background")}
      selected={false}
    />
  );
}

function CorruptionDeckPicker({
  runDeck,
  selectedIndex,
  onSelect,
  page,
  onPageChange,
}: {
  runDeck: BattleCard[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const corruptionOptions = useMemo(
    () => runDeck.map((card, index) => ({ card, index })).filter(({ card }) => !card.corrupted),
    [runDeck],
  );

  return (
    <CardSelectionGrid
      items={corruptionOptions}
      page={page}
      onPageChange={onPageChange}
      pageSize={SELECTION_GRID_PAGE_SIZE}
      emptyMessage="No uncorrupted cards remain."
      renderItem={({ card, index }) => (
        <CorruptionDeckCard card={card} isSelected={selectedIndex === index} onSelect={() => onSelect(index)} />
      )}
    />
  );
}

function CorruptionActionButton({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className={cn("relative rounded-xl", disabled && "opacity-50")}>
      <Button
        size="lg"
        className="relative bg-gradient-to-br from-red-950 via-black to-red-950 bg-[length:200%_200%] animate-shine text-red-400 disabled:opacity-100"
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
      <ScreenDescription tone="danger">Select a Card to Corrupt</ScreenDescription>
      <img
        src={corruptionAltar}
        alt="Altar of Corruption"
        className="block w-full max-w-[38.89cqh] rounded-shell-panel object-contain"
        loading="eager"
        decoding="sync"
      />
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="outline" onClick={onLeave}>
          Leave
        </Button>
        <CorruptionActionButton onClick={onBegin}>Corrupt a Card</CorruptionActionButton>
      </div>
    </div>
  );
}

function CorruptionResultView({ result, onContinue }: { result: CorruptionResult; onContinue: () => void }) {
  const [hoveredOriginal, setHoveredOriginal] = useState(false);
  const [hoveredResult, setHoveredResult] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5">
      <ScreenHeader title="Altar of Corruption" />
      <ScreenDescription className="text-red-100/75">The altar returns your card changed.</ScreenDescription>
      {result.transformed ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3">
          <div className="col-start-1 flex flex-col items-center">
            <BattleCardButton
              card={result.originalCard}
              hovered={hoveredOriginal}
              onHoverStart={() => setHoveredOriginal(true)}
              onHoverEnd={() => setHoveredOriginal(false)}
              ariaLabel={`Original: ${getCardDisplayTitle(result.originalCard)}`}
              shimmerActive={false}
              shimmerToken={undefined}
              className={viewCardWidthClass}
            />
          </div>
          <MoveRight className="col-start-2 h-8 w-8 shrink-0 self-center text-red-800" />
          <div className="col-start-3 flex flex-col items-center">
            <BattleCardButton
              card={result.corruptedCard}
              hovered={hoveredResult}
              onHoverStart={() => setHoveredResult(true)}
              onHoverEnd={() => setHoveredResult(false)}
              ariaLabel={`Result: ${getCardDisplayTitle(result.corruptedCard)}`}
              shimmerActive={false}
              shimmerToken={undefined}
              className={viewCardWidthClass}
            />
          </div>
          <p className="col-start-1 text-sm font-semibold text-foreground">
            <CardTitle card={result.originalCard} />
          </p>
          <p className="col-start-3 text-sm font-semibold text-foreground">
            <CardTitle card={result.corruptedCard} />
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <BattleCardButton
            card={result.corruptedCard}
            hovered={hoveredResult}
            onHoverStart={() => setHoveredResult(true)}
            onHoverEnd={() => setHoveredResult(false)}
            ariaLabel={`Inspect ${getCardDisplayTitle(result.corruptedCard)}`}
            shimmerActive={false}
            shimmerToken={undefined}
            className={viewCardWidthClass}
          />
          <p className="text-base font-semibold text-foreground">
            <CardTitle card={result.corruptedCard} />
          </p>
        </div>
      )}
      <Button size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

export function CorruptionScreen({
  runDeck,
  result,
  onCorrupt,
  onExit,
}: {
  runDeck: BattleCard[];
  result: CorruptionResult | null;
  onCorrupt: (cardIndex: number) => void;
  onExit: () => void;
}) {
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
        <CorruptionResultView result={result} onContinue={onExit} />
      ) : selecting ? (
        <div className="state-swap">
          <ScreenHeader title="Altar of Corruption" />
          <ScreenDescription className="mb-4 mt-3 text-red-100/75">
            Select one card. The altar may weaken, strengthen, or remake it.
          </ScreenDescription>
          <CorruptionDeckPicker
            runDeck={runDeck}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            page={page}
            onPageChange={setPage}
          />
          <div className="mt-5 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelecting(false);
                setSelectedIndex(null);
                setPage(0);
              }}
            >
              Cancel
            </Button>
            <CorruptionActionButton disabled={selectedIndex === null} onClick={handleConfirm}>
              Corrupt
            </CorruptionActionButton>
          </div>
        </div>
      ) : (
        <CorruptionIntro
          onBegin={() => {
            setSelecting(true);
            setPage(0);
          }}
          onLeave={onExit}
        />
      )}
    </div>
  );
}
