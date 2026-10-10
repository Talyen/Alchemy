import { playUISound } from "@/lib/audio";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import type { AlchemyVisit, TransmutationSelectionCommand } from "@/lib/active-run-session/alchemy-visits";
import { getTransmutationOffers, canTransmuteCard, isTransmutationSourceCurrent } from "@/lib/alchemist/transmutation";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { CardTitle } from "../../shared/ui/cards/card-description-ui";
import { controlLabelClass } from "../../shared/config";
import { KeywordTag } from "../../shared/ui/keyword-tag";

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
  const selection = visit.transmutation;
  const canExchange = (card: BattleCard) => canTransmuteCard(selection?.choices ?? [], card);
  const available = runDeck.some(canExchange);
  const completed = visit.completed;
  const staleSource = !!selection?.source && !completed && !isTransmutationSourceCurrent(visit, runDeck);
  const source = staleSource ? null : selection?.source;
  const keyword = source ? selection?.keyword : null;
  const offers = getTransmutationOffers(visit);
  const locked = completed || isProgressSavePending();

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
    if (onSelect(command)) {
      playUISound("transmuteSelect");
      setError("");
    } else setError("This choice is no longer available.");
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
      setError("This exchange is no longer available. Choose another card.");
    }
  }

  if (!available && !completed) return null;
  // Completed visits resume directly onward, with no result screen.
  if (completed && !committing) return null;
  return (
    <TitledScreenShell title="Transmutation">
      <div className="mt-5 flex flex-col items-center gap-5 text-center">
        {!source ? (
          <>
            <h2 className="text-2xl font-semibold">Transform a Card</h2>
            <CardSelectionGrid
              items={runDeck.map((card, index) => ({ card, index }))}
              page={page}
              onPageChange={setPage}
              selectedIndex={-1}
              renderItem={({ card, index }) => (
                <SelectableCard
                  card={card}
                  isSelected={false}
                  disabled={locked || !canExchange(card)}
                  onSelect={() => select({ kind: "source", index, card })}
                />
              )}
            />
          </>
        ) : !keyword ? (
          <div className="flex flex-wrap justify-center gap-5 py-8" role="group" aria-label="Choose a keyword">
            {selection?.choices.map((choice) => (
              <KeywordTag
                key={choice.keyword}
                keywordId={choice.keyword}
                pill
                showTooltip
                disabled={locked}
                className="px-6 py-4 text-lg"
                onSelect={() => select({ kind: "keyword", keyword: choice.keyword })}
              />
            ))}
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">Choose an Outcome</h2>
            <KeywordTag keywordId={keyword} pill showTooltip />
            <div className="flex flex-wrap justify-center gap-4">
              {offers.map((card, index) => (
                <div key={card.id} className="flex flex-col items-center gap-3">
                  <SelectableCard
                    card={card}
                    isSelected={selection?.offerIndex === index}
                    disabled={locked}
                    onSelect={() => select({ kind: "outcome", index })}
                  />
                  <div className={controlLabelClass}>
                    <CardTitle card={card} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {source && (
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              disabled={locked}
              onClick={() => select({ kind: "back", to: keyword ? "keyword" : "source" })}
            >
              Back
            </Button>
            {keyword && (
              <Button size="lg" variant="primary" disabled={locked || selection?.offerIndex === null} onClick={confirm}>
                Continue
              </Button>
            )}
          </div>
        )}
        {(error || staleSource) && <p role="alert">{error || "Your deck changed. Transform a card again."}</p>}
      </div>
    </TitledScreenShell>
  );
}
