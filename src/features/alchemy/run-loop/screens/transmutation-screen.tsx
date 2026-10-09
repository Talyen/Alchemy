import { playUISound } from "@/lib/audio";
import { useEffect, useRef, useState } from "react";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import type { BattleCard } from "@/lib/game-data";
import type { AlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { isTransmutableCard } from "@/lib/alchemist/transmutation";
export function TransmutationScreen({
  runDeck,
  visit,
  onExchange,
  onContinue,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
}: {
  runDeck: BattleCard[];
  visit: AlchemyVisit;
  onExchange: (source: number, offer: number) => BattleCard | null;
  onContinue: () => void;
  afterProgressSaved?: (feedback: () => void) => void;
  isProgressSavePending?: () => boolean;
}) {
  const [source, setSource] = useState(-1);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [selectionDeck, setSelectionDeck] = useState(runDeck);
  const continued = useRef(false);
  const continuationRequest = useRef({ revision: 0 });
  if (selectionDeck !== runDeck) {
    setSelectionDeck(runDeck);
    setSource(-1);
    setPage(0);
    setError("Your deck changed. Choose a Card again.");
  }
  const canExchange = (card: BattleCard) =>
    isTransmutableCard(card) && visit.offers.some((offer) => offer.id !== card.id);
  const available = runDeck.some(canExchange);
  useEffect(() => {
    const requests = continuationRequest.current;
    if ((visit.completed || !available) && !continued.current) {
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
  }, [visit.completed, available, onContinue, afterProgressSaved]);
  const original = runDeck[source];
  const items = runDeck.map((card, index) => ({ card, index }));
  if (visit.completed || !available) return null;
  return (
    <TitledScreenShell title="Transmutation">
      <div className="mt-5 flex flex-col items-center gap-5 text-center">
        {!original ? (
          <>
            <h2 className="text-2xl font-semibold">Choose a Card</h2>
            <CardSelectionGrid
              items={items}
              page={page}
              onPageChange={setPage}
              selectedIndex={source}
              renderItem={({ card, index }) => (
                <SelectableCard
                  card={card}
                  isSelected={source === index}
                  disabled={!canExchange(card)}
                  onSelect={() => {
                    if (continued.current || !canExchange(card)) return;
                    playUISound("transmuteSelect");
                    setSource(index);
                    setError("");
                  }}
                />
              )}
            />
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">Your card is transmuted into...</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {visit.offers.map((card, index) => (
                <div key={card.id}>
                  <SelectableCard
                    card={card}
                    isSelected={false}
                    disabled={original.id === card.id}
                    onSelect={() => {
                      if (continued.current || !canExchange(original) || original.id === card.id) return;
                      playUISound("transmuteSelect");
                      if (isProgressSavePending()) return;
                      if (onExchange(source, index)) {
                        const requests = continuationRequest.current;
                        const request = ++requests.revision;
                        afterProgressSaved(() => {
                          if (request !== requests.revision || continued.current) return;
                          continued.current = true;
                          onContinue();
                        });
                      } else {
                        setError("This exchange is no longer available. Choose another card.");
                      }
                    }}
                  />
                  {original.id === card.id && <p>Already the selected card</p>}
                </div>
              ))}
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </TitledScreenShell>
  );
}
