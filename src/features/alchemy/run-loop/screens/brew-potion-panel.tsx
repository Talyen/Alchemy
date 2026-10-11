import { PotionComparison } from "./potion-comparison";
import { playUISound } from "@/lib/audio";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import { isBrewablePotion, strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { collectionTileWidthClass } from "../../shared/config";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { useCaptureEscapeCancel } from "../../shared/ui/use-modal-escape-dismiss";

export function BrewPotionPanel({
  deck,
  offers = [],
  kind,
  price = 0,
  gold = 0,
  potency = 0,
  selectionSound = "selection",
  onConfirm,
  isProgressSavePending = () => false,
  onBack,
}: {
  deck: BattleCard[];
  offers?: BattleCard[];
  kind: BrewOperation["kind"];
  price?: number;
  gold?: number;
  potency?: number;
  selectionSound?: "selection" | "shopSelect";
  onConfirm: (operation: BrewOperation) => BattleCard | null;
  isProgressSavePending?: () => boolean;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [selectionDeck, setSelectionDeck] = useState(deck);
  if (selectionDeck !== deck) {
    setSelectionDeck(deck);
    setSelected([]);
    setPage(0);
    setError(submitted ? "" : "Deck changed. Select again.");
  }
  useLayoutEffect(() => {
    if (kind === "strengthen" && selected.length === 1 && document.activeElement === document.body)
      confirmRef.current?.focus();
  }, [kind, selected]);
  useCaptureEscapeCancel(onBack);
  const items =
    kind === "new"
      ? offers.map((card, index) => ({ card, index }))
      : deck
          .map((card, index) => ({ card, index }))
          .filter(({ card }) => isBrewablePotion(card) && (kind !== "strengthen" || strengthenPotion(card) !== null));
  const a = selected[0] ?? -1;
  const b = selected[1] ?? -1;
  const operation: BrewOperation =
    kind === "new" ? { kind, offerIndex: a } : kind === "strengthen" ? { kind, index: a } : { kind, indices: [a, b] };
  const result =
    kind === "new"
      ? offers[a]
      : kind === "strengthen"
        ? deck[a]
          ? strengthenPotion(deck[a])
          : null
        : a !== b
          ? tryCreateMixedPotion(deck[a], deck[b], potency)
          : null;
  const afford = gold >= price;
  function confirm(operation: BrewOperation) {
    if (submitted || isProgressSavePending()) return;
    if (onConfirm(operation)) setSubmitted(true);
    else setError(kind === "new" ? "This Potion is no longer available." : "This brew is no longer available.");
  }
  function choose(index: number) {
    if (submitted || (kind === "new" && isProgressSavePending())) return;
    playUISound(selectionSound);
    setError("");
    if (kind === "new") {
      confirm({ kind: "new", offerIndex: index });
      return;
    }
    setSelected((previous) =>
      previous.includes(index)
        ? previous.filter((i) => i !== index)
        : kind === "combine"
          ? [...previous.slice(-1), index]
          : [index],
    );
  }
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-5">
      <h2 className="text-xl">
        {kind === "new" ? "Choose a Potion" : kind === "combine" ? "Mix Potion" : "Select a Potion to Distill"}
      </h2>
      {!items.length ? (
        <p role="status">
          {kind === "strengthen"
            ? "No eligible Potions."
            : kind === "new"
              ? "No Potion recipes are available."
              : "Two eligible Potions required."}
        </p>
      ) : kind === "strengthen" && result && deck[a] ? (
        <PotionComparison original={deck[a]} result={result} />
      ) : (
        <CardSelectionGrid
          items={items}
          {...(kind === "new" ? { pageSize: items.length } : {})}
          page={page}
          onPageChange={setPage}
          selectedIndex={items.findIndex((item) => item.index === a)}
          renderItem={({ card, index }) => (
            <SelectableCard
              card={card}
              chrome="shop"
              isSelected={selected.includes(index)}
              disabled={submitted}
              onSelect={() => choose(index)}
            />
          )}
        />
      )}
      {kind === "combine" && items.length === 1 && <p role="status">Two eligible Potions required.</p>}
      {kind === "combine" && result && (
        <div className="flex flex-col items-center gap-3" aria-label="Brew preview">
          <BattleCardButton
            card={result}
            ariaLabel={`Inspect brew result: ${result.title}`}
            className={collectionTileWidthClass}
            shimmerActive={false}
            shimmerToken={undefined}
          />
        </div>
      )}
      {!afford && <p role="status">Not enough Gold. Brewing costs {price} Gold.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        {kind !== "new" && (
          <>
            {kind === "strengthen" && result && (
              <Button variant="outline" onClick={() => setSelected([])}>
                Choose Another Potion
              </Button>
            )}
            <Button
              ref={confirmRef}
              disabled={submitted || !result || !afford || isProgressSavePending()}
              onClick={() => confirm(operation)}
            >
              {kind === "combine" ? "Mix" : "Distill"}
              {price ? ` · ${price} Gold` : ""}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
