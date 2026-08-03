// Altar of Corruption screen — choose a deck card, corrupt it, and reveal the altered card.
// Depends on card UI primitives, placeholder destination art, and corruption result shape.
// Used by run navigation as a free rare route event with possible upside or downside.
import { useMemo, useState } from "react";
import { Dices, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { corruptionAltar, type BattleCard } from "@/lib/game-data";
import type { CorruptionResult } from "../corruption";
import {
  SHINE_PALETTES,
  viewCardWidthClass,
  BUTTON_WIDTH_ACTION,
  controlLabelClass,
} from "@/features/alchemy/shared/config";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import { BattleCardButton } from "../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { SelectableShopCard } from "../../shared/ui/shop-card-item";
import {
  ScreenDescription,
  ScreenHeader,
  ShineAccentButton,
  StaggerGroup,
  StaggerItem,
} from "../../shared/ui/shared-ui";
import { cn } from "@/lib/utils";

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
        <SelectableShopCard
          card={card}
          chrome="corruption"
          isSelected={selectedIndex === index}
          onSelect={() => onSelect(index)}
        />
      )}
    />
  );
}

function CorruptionIntro({ onBegin, onLeave }: { onBegin: () => void; onLeave: () => void }) {
  return (
    <StaggerGroup className="flex flex-col items-center gap-5">
      <StaggerItem index={0}>
        <ScreenHeader title="Altar of Corruption" />
      </StaggerItem>
      <StaggerItem index={1}>
        <ScreenDescription tone="danger">Select a Card to Corrupt</ScreenDescription>
      </StaggerItem>
      <StaggerItem index={2}>
        <img
          src={corruptionAltar}
          alt="Altar of Corruption"
          className="block w-full max-w-[46.67cqh] rounded-shell-panel object-contain"
          loading="eager"
          decoding="sync"
        />
      </StaggerItem>
      <StaggerItem index={3} className="flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="outline" className={BUTTON_WIDTH_ACTION} onClick={onLeave}>
          Leave
        </Button>
        <ShineAccentButton
          icon={Dices}
          accentClassName="text-red-400"
          shineColor={SHINE_PALETTES.corruption}
          onClick={onBegin}
        >
          Corrupt a Card
        </ShineAccentButton>
      </StaggerItem>
    </StaggerGroup>
  );
}

function CorruptionResultView({ result, onContinue }: { result: CorruptionResult; onContinue: () => void }) {
  const [hoveredOriginal, setHoveredOriginal] = useState(false);
  const [hoveredResult, setHoveredResult] = useState(false);

  return (
    <StaggerGroup className="flex flex-col items-center gap-5">
      <StaggerItem index={0}>
        <ScreenHeader title="Altar of Corruption" />
      </StaggerItem>
      <StaggerItem index={1}>
        <ScreenDescription className="text-red-100/75">The altar returns your card changed.</ScreenDescription>
      </StaggerItem>
      {result.transformed ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3">
          <StaggerItem index={2} className="col-start-1 flex flex-col items-center">
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
          </StaggerItem>
          <StaggerItem index={3} className="col-start-2 flex shrink-0 self-center">
            <MoveRight className="h-10 w-10 text-red-800" />
          </StaggerItem>
          <StaggerItem index={4} className="col-start-3 flex flex-col items-center">
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
          </StaggerItem>
          <StaggerItem index={5} className={cn("col-start-1", controlLabelClass)}>
            <CardTitle card={result.originalCard} />
          </StaggerItem>
          <StaggerItem index={6} className={cn("col-start-3", controlLabelClass)}>
            <CardTitle card={result.corruptedCard} />
          </StaggerItem>
        </div>
      ) : (
        <StaggerItem index={2} className="flex flex-col items-center gap-3">
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
          <p className="text-xl font-semibold text-foreground">
            <CardTitle card={result.corruptedCard} />
          </p>
        </StaggerItem>
      )}
      <StaggerItem index={result.transformed ? 7 : 3}>
        <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
          Continue
        </Button>
      </StaggerItem>
    </StaggerGroup>
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
        <StaggerGroup className="flex flex-col items-center gap-5">
          <StaggerItem index={0}>
            <ScreenHeader title="Altar of Corruption" />
          </StaggerItem>
          <StaggerItem index={1}>
            <ScreenDescription className="text-red-100/75">
              Select one card. The altar may weaken, strengthen, or remake it.
            </ScreenDescription>
          </StaggerItem>
          <CorruptionDeckPicker
            runDeck={runDeck}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            page={page}
            onPageChange={setPage}
          />
          <StaggerItem index={SELECTION_GRID_PAGE_SIZE + 2} className="flex justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setSelecting(false);
                setSelectedIndex(null);
                setPage(0);
              }}
            >
              Cancel
            </Button>
            <ShineAccentButton
              icon={Dices}
              accentClassName="text-red-400"
              shineColor={SHINE_PALETTES.corruption}
              disabled={selectedIndex === null}
              onClick={handleConfirm}
            >
              Corrupt
            </ShineAccentButton>
          </StaggerItem>
        </StaggerGroup>
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
