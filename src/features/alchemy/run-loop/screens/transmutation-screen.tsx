import { playUISound } from "@/lib/audio";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { transmutationCrucible } from "@/features/alchemy/shared/config/game-data-catalog";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { collectionTileWidthClass } from "../../shared/config";
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
}: {
  runDeck: BattleCard[];
  visit: AlchemyVisit;
  onExchange: (source: number, offer: number) => BattleCard | null;
  onContinue: () => void;
}) {
  const [source, setSource] = useState(-1);
  const [offer, setOffer] = useState(-1);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [selectionDeck, setSelectionDeck] = useState(runDeck);
  if (selectionDeck !== runDeck) {
    setSelectionDeck(runDeck);
    setSource(-1);
    setPage(0);
    setError("Your deck changed. Choose a card to surrender again.");
  }
  const original = runDeck[source];
  const replacement = visit.offers[offer];
  const valid = original && replacement && isTransmutableCard(original) && original.id !== replacement.id;
  const items = runDeck.map((card, index) => ({ card, index }));
  return (
    <TitledScreenShell title="Transmutation">
      <div className="mt-5 flex flex-col items-center gap-5 text-center">
        <img
          src={transmutationCrucible}
          alt="Transmutation Crucible"
          className="max-h-48 w-full max-w-3xl rounded-shell-panel object-cover"
        />
        {visit.completed ? (
          <>
            <p role="status">
              {visit.original?.title} was replaced by {visit.result?.title}.
            </p>
            {visit.result && <SelectableCard card={visit.result} isSelected onSelect={() => {}} />}
            <Button onClick={onContinue}>Continue</Button>
          </>
        ) : (
          <>
            <p>One free exchange. Choose a card to surrender and a replacement.</p>
            <p>Mixed and strengthened Potions cannot be exchanged.</p>
            <CardSelectionGrid
              items={items}
              page={page}
              onPageChange={setPage}
              selectedIndex={source}
              renderItem={({ card, index }) => (
                <SelectableCard
                  card={card}
                  isSelected={source === index}
                  disabled={!isTransmutableCard(card)}
                  onSelect={() => {
                    if (source !== index) playUISound("transmuteSelect");
                    setSource(index);
                    setError("");
                  }}
                />
              )}
            />
            <p>Choose a new card</p>
            <div className="flex flex-wrap justify-center gap-4">
              {visit.offers.map((card, index) => (
                <div key={card.id}>
                  <SelectableCard
                    card={card}
                    isSelected={offer === index}
                    disabled={original?.id === card.id}
                    onSelect={() => {
                      if (offer !== index) playUISound("transmuteSelect");
                      setOffer(index);
                      setError("");
                    }}
                  />
                  {original?.id === card.id && <p>Already the selected card</p>}
                </div>
              ))}
            </div>
            {valid && (
              <section aria-label="Exchange preview" className="flex flex-col items-center gap-3">
                <p role="status">
                  {original.title} leaves your deck. {replacement.title} replaces it.
                </p>
                <div className="flex flex-wrap justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <p>Surrender</p>
                    <BattleCardButton
                      card={original}
                      ariaLabel={`Inspect surrendered card: ${original.title}`}
                      className={collectionTileWidthClass}
                      shimmerActive={false}
                      shimmerToken={undefined}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p>Receive</p>
                    <BattleCardButton
                      card={replacement}
                      ariaLabel={`Inspect replacement: ${replacement.title}`}
                      className={collectionTileWidthClass}
                      shimmerActive={false}
                      shimmerToken={undefined}
                    />
                  </div>
                </div>
              </section>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={onContinue}>
                Leave
              </Button>
              <Button
                disabled={!valid}
                onClick={() => {
                  if (!onExchange(source, offer))
                    setError("This exchange is no longer available. Choose an eligible card and replacement.");
                }}
              >
                Transmute
              </Button>
            </div>
          </>
        )}
      </div>
    </TitledScreenShell>
  );
}
