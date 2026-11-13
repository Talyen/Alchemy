import { useGameTranslation } from "@/components/use-game-translation";

import { playUISound } from "@/lib/audio";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { Dices, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { corruptionAltar, type BattleCard } from "@/lib/game-data";
import { canCorruptCard, type CorruptionResult } from "@/lib/corruption";
import {
  SHINE_PALETTES,
  viewCardWidthClass,
  controlLabelClass,
  getCardInspectionShineColors,
} from "@/features/alchemy/shared/config";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { CardTitle, getCardDisplayTitle } from "../../shared/ui/cards/card-description-ui";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { ScreenDescription, TitledScreenShell } from "../../shared/ui/layout-components";
import { ShineAccentButton } from "../../shared/ui/shine-accent-button";
import { cn } from "@/lib/utils";
import { useCaptureEscapeCancel } from "../../shared/ui/dialogs/use-modal-escape-dismiss";
import { useArtworkReady } from "../../shared/ui/use-artwork-ready";
import { fadePhaseClass, useHeldWhile } from "../../shared/ui/use-fade";

type EntryView = "intro" | "picker";

function blockOutgoingInput(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function blockOutgoingKey(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key !== "Tab") event.preventDefault();
}

function CorruptionEntryPanel({
  view,
  requested,
  shown,
  reducedMotion,
  onReady,
  children,
}: {
  view: EntryView;
  requested: boolean;
  shown: boolean;
  reducedMotion: boolean;
  onReady: (view: EntryView) => void;
  children: ReactNode;
}) {
  const { ref, pending } = useArtworkReady(view, {
    initialRevealOnly: true,
  });
  const heldChildren = useHeldWhile(requested, children);
  const heldPending = useHeldWhile(requested, pending);
  useEffect(() => {
    if (requested && !pending) onReady(view);
  }, [requested, pending, view, onReady]);

  const visible = shown && !heldPending;
  const interactive = requested && visible;
  return (
    <div
      ref={ref}
      data-corruption-entry-panel={view}
      data-artwork-pending={heldPending}
      aria-hidden={!interactive}
      inert={!interactive}
      className={cn("col-start-1 row-start-1 min-w-0", !reducedMotion && fadePhaseClass(visible ? "enter" : "exit"))}
      style={{ opacity: visible ? 1 : 0 }}
      onClickCapture={!interactive ? blockOutgoingInput : undefined}
      onKeyDownCapture={!interactive ? blockOutgoingKey : undefined}
    >
      {heldChildren}
    </div>
  );
}

function CorruptionEntry({ selecting, intro, picker }: { selecting: boolean; intro: ReactNode; picker: ReactNode }) {
  const target = selecting ? "picker" : "intro";
  // Keep the last ready view visible while the requested view decodes, then
  // crossfade locally without hiding the altar heading or changing shared fades.
  const [shown, setShown] = useState<EntryView>(target);
  const reducedMotion = useReducedMotionPreference();
  return (
    // Both panels reserve the same grid footprint, so revealing the picker
    // does not reposition the heading or the outgoing illustration.
    <div className="grid w-full min-w-0">
      <CorruptionEntryPanel
        view="intro"
        requested={target === "intro"}
        shown={shown === "intro"}
        reducedMotion={reducedMotion}
        onReady={setShown}
      >
        {intro}
      </CorruptionEntryPanel>
      <CorruptionEntryPanel
        view="picker"
        requested={target === "picker"}
        shown={shown === "picker"}
        reducedMotion={reducedMotion}
        onReady={setShown}
      >
        {picker}
      </CorruptionEntryPanel>
    </div>
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
  const i18n = useGameTranslation();
  const corruptionOptions = useMemo(() => {
    const eligible: Array<{ card: BattleCard; index: number }> = [];
    runDeck.forEach((card, index) => {
      if (canCorruptCard(card)) eligible.push({ card, index });
    });
    return eligible;
  }, [runDeck]);

  return (
    <CardSelectionGrid
      items={corruptionOptions}
      selectedIndex={corruptionOptions.findIndex((item) => item.index === selectedIndex)}
      page={page}
      onPageChange={onPageChange}
      emptyMessage={i18n.text("ui.corruption-screen.1", "No eligible cards remain.")}
      paginationReserveSpace
      renderItem={({ card, index }) => (
        <SelectableCard
          card={card}
          chrome="corruption"
          isSelected={selectedIndex === index}
          shineColor={getCardInspectionShineColors(card)}
          onSelect={() => {
            if (selectedIndex !== index) playUISound("corruptSelect");
            onSelect(index);
          }}
        />
      )}
    />
  );
}

function CorruptionIntro({
  onBegin,
  onLeave,
  hasEligibleCards,
}: {
  onBegin: () => void;
  onLeave: () => void;
  hasEligibleCards: boolean;
}) {
  const i18n = useGameTranslation();
  return (
    <div className="flex flex-col items-center gap-4">
      {!hasEligibleCards ? (
        <ScreenDescription tone="danger">
          {i18n.text("ui.corruption-screen.2", "No eligible cards remain.")}
        </ScreenDescription>
      ) : null}
      <div>
        <img
          src={corruptionAltar}
          alt={i18n.text("ui.corruption-screen.3", "Altar of Corruption")}
          className="block w-full max-w-[calc(31.5023*var(--content-rem,1rem))] rounded-shell-panel object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="outline" className="min-w-56" onClick={onLeave}>
          {i18n.text("ui.corruption-screen.4", "Leave")}
        </Button>
        <ShineAccentButton
          icon={Dices}
          accentClassName="text-red-400"
          shineColor={SHINE_PALETTES.corruption}
          onClick={onBegin}
          disabled={!hasEligibleCards}
        >
          {i18n.text("ui.corruption-screen.5", "Corrupt a Card")}
        </ShineAccentButton>
      </div>
    </div>
  );
}

function CorruptionResultView({
  result,
  revealChange,
  onContinue,
}: {
  result: CorruptionResult;
  revealChange: boolean;
  onContinue: () => void;
}) {
  const i18n = useGameTranslation();
  return (
    <div className="flex flex-col items-center gap-4">
      <div>
        <ScreenDescription tone="danger">
          {i18n.text("ui.corruption-screen.6", "The altar returns your card changed.")}
        </ScreenDescription>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3">
        <div className="col-start-1 flex flex-col items-center">
          <BattleCardButton
            card={result.originalCard}
            ariaLabel={i18n.text("ui.corruption-screen.7", "Original: {{value0}}", {
              value0: i18n.read(() => getCardDisplayTitle(result.originalCard)),
            })}
            shineColor={getCardInspectionShineColors(result.originalCard)}
            className={viewCardWidthClass}
          />
        </div>
        <div className="col-start-2 flex shrink-0 self-center">
          <MoveRight className="h-10 w-10 text-red-800" />
        </div>
        <div className={cn("col-start-3 flex flex-col items-center", revealChange && "screen-fade-in")}>
          <BattleCardButton
            card={result.corruptedCard}
            comparisonCard={result.originalCard}
            ariaLabel={i18n.text("ui.corruption-screen.8", "Result: {{value0}}", {
              value0: i18n.read(() => getCardDisplayTitle(result.corruptedCard)),
            })}
            shineColor={getCardInspectionShineColors(result.corruptedCard)}
            className={viewCardWidthClass}
          />
        </div>
        <div className={cn("col-start-1", controlLabelClass)}>
          <CardTitle card={result.originalCard} />
        </div>
        <div className={cn("col-start-3", controlLabelClass, revealChange && "screen-fade-in")}>
          <CardTitle card={result.corruptedCard} />
        </div>
      </div>
      <div>
        <Button size="lg" variant="primary" className="min-w-56" onClick={onContinue}>
          {i18n.text("ui.corruption-screen.9", "Continue")}
        </Button>
      </div>
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
  const i18n = useGameTranslation();
  const [selecting, setSelecting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [selectionDeck, setSelectionDeck] = useState(runDeck);
  const [selectionNotice, setSelectionNotice] = useState("");
  if (selectionDeck !== runDeck) {
    setSelectionDeck(runDeck);
    setSelectedIndex(null);
    setPage(0);
    setSelectionNotice(selecting && !result ? "Your deck changed. Choose a card to corrupt again." : "");
  }
  const selectedCard = selectedIndex === null ? undefined : runDeck[selectedIndex];
  const canConfirm = selectedCard !== undefined && canCorruptCard(selectedCard);

  function cancelSelection() {
    setSelecting(false);
    setSelectedIndex(null);
    setPage(0);
    setSelectionNotice("");
  }

  useCaptureEscapeCancel(selecting && !result ? cancelSelection : undefined);

  function handleConfirm() {
    if (selectedIndex === null || !canConfirm) return;
    onCorrupt(selectedIndex);
  }

  function handleExit() {
    cancelSelection();
    onExit();
  }

  return (
    <TitledScreenShell title={i18n.text("ui.corruption-screen.10", "Altar of Corruption")}>
      <div className="mt-3 flex flex-col items-center gap-6 text-center">
        {result ? (
          <CorruptionResultView result={result} revealChange={selecting} onContinue={handleExit} />
        ) : (
          <CorruptionEntry
            selecting={selecting}
            intro={
              <CorruptionIntro
                hasEligibleCards={runDeck.some(canCorruptCard)}
                onBegin={() => {
                  setSelecting(true);
                  setPage(0);
                }}
                onLeave={handleExit}
              />
            }
            picker={
              <div className="flex w-full min-w-0 flex-col items-center gap-4">
                <div>
                  <ScreenDescription tone="danger">
                    {i18n.text("ui.corruption-screen.11", "The altar may weaken, strengthen, or remake your card.")}
                  </ScreenDescription>
                </div>
                <CorruptionDeckPicker
                  runDeck={runDeck}
                  selectedIndex={selectedIndex}
                  onSelect={(index) => {
                    setSelectedIndex(index);
                    setSelectionNotice("");
                  }}
                  page={page}
                  onPageChange={setPage}
                />
                {selectionNotice && <p role="status">{i18n.displayText(selectionNotice)}</p>}
                <div className="flex justify-center gap-3">
                  <Button size="lg" variant="outline" onClick={cancelSelection}>
                    {i18n.text("ui.corruption-screen.12", "Cancel")}
                  </Button>
                  <ShineAccentButton
                    icon={Dices}
                    accentClassName="text-red-400"
                    shineColor={SHINE_PALETTES.corruption}
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                  >
                    {i18n.text("ui.corruption-screen.13", "Corrupt")}
                  </ShineAccentButton>
                </div>
              </div>
            }
          />
        )}
      </div>
    </TitledScreenShell>
  );
}
