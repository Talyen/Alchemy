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
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const continued = useRef(false);
  const committingRef = useRef(false);
  const continuationRequest = useRef({ revision: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboardInput = useRef(false);
  const restoreFocus = useRef(false);
  const selection = visit.transmutation;
  const canExchange = (card: BattleCard, index: number) => canTransmuteCard(selection?.choices ?? [], card, index);
  const available = runDeck.some(canExchange);
  const completed = visit.completed;
  const staleSource = !!selection?.source && !completed && !isTransmutationSourceCurrent(visit, runDeck);
  const source = staleSource ? null : selection?.source;
  const keyword = source ? selection?.keyword : null;
  const offers = getTransmutationOffers(visit);
  const locked = completed || isProgressSavePending();
  const phase = !source ? "source" : "preview";
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
    if ((completed || !available) && !continued.current) {
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
  }, [completed, available, onContinue, afterProgressSaved]);

  function select(command: TransmutationSelectionCommand) {
    if (locked || committingRef.current || continued.current) return;
    restoreFocus.current = keyboardInput.current && panelRef.current?.contains(document.activeElement) === true;
    if (onSelect(command)) {
      playUISound("transmuteSelect");
      setError("");
    } else {
      restoreFocus.current = false;
      setError("This choice is no longer available.");
    }
  }

  function confirm() {
    if (
      locked ||
      committingRef.current ||
      continued.current ||
      staleSource ||
      selection?.sourceIndex === null ||
      selection?.sourceIndex === undefined ||
      selection.offerIndex === null ||
      !offers[selection.offerIndex]
    )
      return;
    committingRef.current = true;
    setCommitting(true);
    if (onExchange(selection.sourceIndex, selection.offerIndex)) {
      playUISound("transmuteSelect");
    } else {
      committingRef.current = false;
      setCommitting(false);
      setError("This alteration is no longer available.");
    }
  }

  if (!available && !completed) return null;
  // Completed visits resume directly onward, with no result screen.
  if (completed && !committing) return null;
  return (
    <TitledScreenShell title="Transmutation">
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
        {!source ? (
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
            <Button size="lg" variant="outline" disabled={locked} onClick={onContinue}>
              Leave
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-5" role="group" aria-label="Alterations">
              {selection?.choices.map((choice) => (
                <KeywordTag
                  key={choice.keyword}
                  keywordId={choice.keyword}
                  pill
                  showTooltip
                  selected={keyword === choice.keyword}
                  disabled={locked || !offers.some((offer) => offer.transmuted === choice.keyword)}
                  className="px-6 py-4 text-lg"
                  onSelect={() => select({ kind: "keyword", keyword: choice.keyword })}
                />
              ))}
            </div>
            {preview && (
              <div
                className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3"
                aria-label="Transmutation comparison"
              >
                <BattleCardButton
                  card={source}
                  ariaLabel={`Original: ${getCardDisplayTitle(source)}`}
                  className={viewCardWidthClass}
                  shineColor={getCardInspectionShineColors(source)}
                  shimmerActive={false}
                  shimmerToken={undefined}
                />
                <MoveRight aria-hidden="true" className="h-10 w-10 self-center text-gold-pale" />
                <BattleCardButton
                  card={preview}
                  ariaLabel={`Preview: ${getCardDisplayTitle(preview)}`}
                  className={viewCardWidthClass}
                  shineColor={getCardInspectionShineColors(preview)}
                  shimmerActive={false}
                  shimmerToken={undefined}
                />
                <div className={controlLabelClass}>
                  <CardTitle card={source} />
                </div>
                <div className={cn("col-start-3", controlLabelClass)}>
                  <CardTitle card={preview} />
                </div>
              </div>
            )}
          </>
        )}
        {source && (
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="outline" disabled={locked} onClick={() => select({ kind: "back" })}>
              Back
            </Button>
            {keyword && (
              <Button size="lg" variant="primary" disabled={locked || selection?.offerIndex === null} onClick={confirm}>
                Transmute
              </Button>
            )}
          </div>
        )}
        {(error || staleSource) && <p role="alert">{error || "Your deck changed. Choose a card again."}</p>}
      </div>
    </TitledScreenShell>
  );
}
