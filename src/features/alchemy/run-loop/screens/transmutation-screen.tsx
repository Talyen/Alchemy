import { useGameTranslation } from "@/components/use-game-translation";

import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { MoveRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import type { AlchemyVisit, TransmutationSelectionCommand } from "@/lib/active-run-session/alchemy-visits";
import { getTransmutationOffers, canTransmuteCard, isTransmutationSourceCurrent } from "@/lib/alchemist/transmutation";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { CardTitle } from "../../shared/ui/cards/card-description-ui";
import { controlLabelClass, viewCardWidthClass, getCardInspectionShineColors } from "../../shared/config";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../shared/ui/cards/card-description-ui";
import { FadeSlot } from "../../shared/ui/use-fade";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { focusableControls, focusControl, isFocusAvailable } from "../../shared/ui/focus-navigation";

export function TransmutationScreen({
  runDeck,
  visit,
  onSelect,
  onExchange,
  onContinue,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
}: {
  runDeck: BattleCard[];
  visit: AlchemyVisit;
  onSelect: (selection: TransmutationSelectionCommand) => boolean;
  onExchange: (source: number, offer: number) => BattleCard | null;
  onContinue: () => void;
  afterProgressSaved?: (feedback: () => void) => void;
  isProgressSavePending?: () => boolean;
}) {
  const i18n = useGameTranslation();
  const [page, setPage] = useState(0);
  const [error, setError] = useState<"choice" | "alteration" | "">("");
  const [committedHere, setCommittedHere] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [readyPreviewKey, setReadyPreviewKey] = useState<string | number | null>(null);
  const resultAcknowledged = useRef(false);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const continued = useRef(false);
  const committingRef = useRef(false);
  const continuationRequest = useRef({ revision: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboardInput = useRef(false);
  const restoreFocus = useRef(false);
  const selection = visit.transmutation;
  const canExchange = (card: BattleCard, index: number) =>
    canTransmuteCard(selection?.choices ?? [], card, index, runDeck);
  const available = runDeck.some(canExchange);
  const completed = visit.completed;
  const staleSource = !!selection?.source && !completed && !isTransmutationSourceCurrent(visit, runDeck);
  const source = staleSource ? null : selection?.source;
  const keyword = source ? selection?.keyword : null;
  const offers = getTransmutationOffers(visit);
  const locked = completed || isProgressSavePending();
  const showResult = completed && resultSaved && !!visit.result;
  const phase = showResult ? "result" : !source ? "source" : "preview";
  const previewKey = `${selection?.sourceIndex}:${selection?.offerIndex}`;
  const previewReady = readyPreviewKey === previewKey;
  const preview =
    selection?.offerIndex === null || selection?.offerIndex === undefined ? undefined : offers[selection.offerIndex];
  const previousPhase = useRef(phase);

  useLayoutEffect(() => {
    if (previousPhase.current === phase) return;
    previousPhase.current = phase;
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    const panel = panelRef.current;
    if (!panel) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && isFocusAvailable(active)) return;
    focusControl(focusableControls(panel).find((control) => control.getAttribute("aria-disabled") !== "true"));
  }, [phase]);

  useEffect(() => {
    const requests = continuationRequest.current;
    if (((completed && !visit.result) || (!completed && !available)) && !continued.current) {
      const request = ++requests.revision;
      afterProgressSaved(() => {
        if (request !== requests.revision || continued.current) return;
        continued.current = true;
        onContinue();
      });
    }
    return () => {
      requests.revision++;
    };
  }, [completed, visit.result, available, onContinue, afterProgressSaved]);

  useEffect(() => {
    if (!completed || !visit.result || resultAcknowledged.current) return;
    let active = true;
    afterProgressSaved(() => {
      if (!active || resultAcknowledged.current) return;
      resultAcknowledged.current = true;
      setResultSaved(true);
      if (committingRef.current) playUISound("talentUnlock");
    });
    return () => {
      active = false;
    };
  }, [completed, visit.result, afterProgressSaved]);

  useLayoutEffect(() => {
    if (showResult && resultReady) focusControl(continueButtonRef.current);
  }, [showResult, resultReady]);

  function select(command: TransmutationSelectionCommand) {
    if (locked || isProgressSavePending() || committingRef.current || continued.current) return;
    restoreFocus.current = keyboardInput.current && panelRef.current?.contains(document.activeElement) === true;
    if (onSelect(command)) {
      if (command.kind !== "keyword") setReadyPreviewKey(null);
      playUISound("transmuteSelect");
      setError("");
    } else {
      restoreFocus.current = false;
      setError("choice");
    }
  }

  function confirm() {
    if (
      locked ||
      isProgressSavePending() ||
      committingRef.current ||
      continued.current ||
      staleSource ||
      !previewReady ||
      selection?.sourceIndex === null ||
      selection?.sourceIndex === undefined ||
      selection.offerIndex === null ||
      !offers[selection.offerIndex]
    )
      return;
    committingRef.current = true;
    if (onExchange(selection.sourceIndex, selection.offerIndex)) {
      setCommittedHere(true);
    } else {
      committingRef.current = false;
      setError("alteration");
    }
  }

  function leave() {
    if (locked || isProgressSavePending() || committingRef.current || continued.current) return;
    continued.current = true;
    onContinue();
  }

  if (!available && !completed) return null;
  const resultCard = visit.result;

  return (
    <TitledScreenShell title={i18n.text("ui.transmutation-screen.1", "Transmutation")}>
      <div
        ref={panelRef}
        className="mt-5 flex flex-col items-center gap-5 text-center"
        onKeyDownCapture={() => {
          keyboardInput.current = true;
        }}
        onPointerDownCapture={() => {
          keyboardInput.current = false;
          restoreFocus.current = false;
        }}
      >
        {showResult && resultCard ? (
          <>
            <FadeSlot
              swapKey="result"
              className="flex flex-col items-center gap-3"
              onReady={() => setResultReady(true)}
              aria-label={i18n.text("ui.transmutation-screen.2", "Transmutation result")}
            >
              <div className={cn("reward-choice relative", resultReady && committedHere && "reward-choice-selected")}>
                <BattleCardButton
                  card={resultCard}
                  comparisonCard={visit.original ?? undefined}
                  ariaLabel={i18n.text("ui.transmutation-screen.3", "Transmuted: {{value0}}", {
                    value0: i18n.read(() => getCardDisplayTitle(resultCard)),
                  })}
                  className={viewCardWidthClass}
                  shineColor={getCardInspectionShineColors(resultCard)}
                  selected
                  shimmerActive={false}
                  shimmerToken={undefined}
                />
              </div>
              <div className={controlLabelClass}>
                <CardTitle card={resultCard} />
              </div>
            </FadeSlot>
            <Button
              ref={continueButtonRef}
              size="lg"
              disabled={!resultReady || isProgressSavePending()}
              onClick={() => {
                if (!resultReady || isProgressSavePending() || continued.current) return;
                continued.current = true;
                onContinue();
              }}
            >
              {i18n.text("ui.transmutation-screen.4", "Continue")}
            </Button>
          </>
        ) : !source ? (
          <>
            <CardSelectionGrid
              items={runDeck.map((card, index) => ({ card, index }))}
              page={page}
              onPageChange={setPage}
              selectedIndex={-1}
              renderItem={({ card, index }) => (
                <SelectableCard
                  card={card}
                  isSelected={false}
                  disabled={locked || !canExchange(card, index)}
                  onSelect={() => select({ kind: "source", index, card })}
                />
              )}
            />
            <Button size="lg" variant="outline" disabled={locked} onClick={leave}>
              {i18n.text("ui.transmutation-screen.5", "Leave")}
            </Button>
          </>
        ) : (
          <>
            <div
              className="flex flex-wrap justify-center gap-5"
              role="group"
              aria-label={i18n.text("ui.transmutation-screen.6", "Alterations")}
            >
              {selection?.choices.map((choice) => (
                <KeywordTag
                  key={choice.keyword}
                  keywordId={choice.keyword}
                  pill
                  choice
                  showTooltip
                  selected={keyword === choice.keyword}
                  disabled={locked || !canTransmuteCard([choice], source, selection?.sourceIndex ?? undefined, runDeck)}
                  onSelect={() => select({ kind: "keyword", keyword: choice.keyword })}
                />
              ))}
            </div>
            {preview && (
              <div
                className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3"
                aria-label={i18n.text("ui.transmutation-screen.7", "Transmutation comparison")}
              >
                <div className={cn(viewCardWidthClass, "flex flex-col items-center gap-3")}>
                  <BattleCardButton
                    card={source}
                    ariaLabel={i18n.text("ui.transmutation-screen.8", "Original: {{value0}}", {
                      value0: i18n.read(() => getCardDisplayTitle(source)),
                    })}
                    className={viewCardWidthClass}
                    shineColor={getCardInspectionShineColors(source)}
                    shimmerActive={false}
                    shimmerToken={undefined}
                  />
                  <div className={cn(controlLabelClass, "min-h-[2lh] w-full")}>
                    <CardTitle card={source} />
                  </div>
                </div>
                <MoveRight aria-hidden="true" className="h-10 w-10 self-center text-gold-pale" />
                <FadeSlot
                  swapKey={previewKey}
                  onReady={setReadyPreviewKey}
                  className={cn(viewCardWidthClass, "col-start-3 flex flex-col items-center gap-3")}
                >
                  <BattleCardButton
                    card={preview}
                    comparisonCard={source}
                    ariaLabel={i18n.text("ui.transmutation-screen.9", "Preview: {{value0}}", {
                      value0: i18n.read(() => getCardDisplayTitle(preview)),
                    })}
                    className={viewCardWidthClass}
                    shineColor={getCardInspectionShineColors(preview)}
                    shimmerActive={false}
                    shimmerToken={undefined}
                  />
                  <div className={cn(controlLabelClass, "min-h-[2lh] w-full")}>
                    <CardTitle card={preview} />
                  </div>
                </FadeSlot>
              </div>
            )}
          </>
        )}
        {source && !showResult && (
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="outline" disabled={locked} onClick={() => select({ kind: "back" })}>
              {i18n.text("ui.transmutation-screen.10", "Back")}
            </Button>
            {keyword && (
              <Button
                size="lg"
                variant="primary"
                disabled={
                  locked ||
                  !preview ||
                  !previewReady ||
                  !canTransmuteCard(
                    selection?.choices.filter((choice) => choice.keyword === preview.transmuted) ?? [],
                    source,
                    selection?.sourceIndex ?? undefined,
                    runDeck,
                  )
                }
                onClick={confirm}
              >
                {i18n.text("ui.transmutation-screen.11", "Transmute")}
              </Button>
            )}
          </div>
        )}
        {(error || staleSource) && (
          <p role="alert">
            {i18n.displayText(
              error === "choice"
                ? "This choice is no longer available."
                : error === "alteration"
                  ? "This alteration is no longer available."
                  : "Your deck changed. Choose a card again.",
            )}
          </p>
        )}
      </div>
    </TitledScreenShell>
  );
}
