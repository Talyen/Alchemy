import { playUISound } from "@/lib/audio";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { alchemyLab } from "@/features/alchemy/shared/config/game-data-catalog";
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
  allowStrengthen = false,
  price = 0,
  gold = 0,
  potency = 0,
  onConfirm,
  onBack,
}: {
  deck: BattleCard[];
  offers?: BattleCard[];
  allowStrengthen?: boolean;
  price?: number;
  gold?: number;
  potency?: number;
  onConfirm: (operation: BrewOperation) => BattleCard | null;
  onBack: () => void;
}) {
  const [kind, setKind] = useState<BrewOperation["kind"]>(() => {
    if (offers.length) return "new";
    return allowStrengthen && deck.filter(isBrewablePotion).length < 2 && deck.some((card) => strengthenPotion(card))
      ? "strengthen"
      : "combine";
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [selectionDeck, setSelectionDeck] = useState(deck);
  if (selectionDeck !== deck) {
    setSelectionDeck(deck);
    setSelected([]);
    setPage(0);
    setError("Your deck changed. Choose your Potions again.");
  }
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
  function chooseKind(next: BrewOperation["kind"]) {
    setKind(next);
    setSelected([]);
    setPage(0);
    setError("");
  }
  function choose(index: number) {
    playUISound(allowStrengthen ? "shopSelect" : "selection");
    setError("");
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
      <img src={alchemyLab} alt="Alchemy Lab" className="max-h-40 w-full rounded-shell-panel object-cover" />
      <div className="flex flex-wrap justify-center gap-3">
        {offers.length > 0 && (
          <Button
            aria-pressed={kind === "new"}
            variant={kind === "new" ? "primary" : "outline"}
            onClick={() => chooseKind("new")}
          >
            New Potion
          </Button>
        )}
        <Button
          aria-pressed={kind === "combine"}
          variant={kind === "combine" ? "primary" : "outline"}
          onClick={() => chooseKind("combine")}
        >
          Combine
        </Button>
        {allowStrengthen && (
          <Button
            aria-pressed={kind === "strengthen"}
            variant={kind === "strengthen" ? "primary" : "outline"}
            onClick={() => chooseKind("strengthen")}
          >
            Strengthen
          </Button>
        )}
      </div>
      <p>
        {kind === "combine"
          ? "Choose two Potions to replace with one Mixed Potion."
          : kind === "strengthen"
            ? "Choose a Potion to strengthen. Each Potion can be brewed once."
            : "Choose one Potion to add to your run deck."}
      </p>
      {!items.length ? (
        <p role="status">
          {kind === "strengthen"
            ? "No Potions have effects that can be strengthened."
            : kind === "new"
              ? "No Potion recipes are available."
              : "You need two unbrewed standard Potions to combine."}
        </p>
      ) : (
        <CardSelectionGrid
          items={items}
          page={page}
          onPageChange={setPage}
          selectedIndex={items.findIndex((item) => item.index === a)}
          renderItem={({ card, index }) => (
            <SelectableCard
              card={card}
              chrome="shop"
              isSelected={selected.includes(index)}
              onSelect={() => choose(index)}
            />
          )}
        />
      )}
      {kind === "combine" && items.length === 1 && (
        <p role="status">You need two unbrewed standard Potions to combine.</p>
      )}
      {result && (
        <div className="flex flex-col items-center gap-3" aria-label="Brew preview">
          <p>
            {kind === "new"
              ? "Added to your run deck. Available each battle."
              : kind === "combine"
                ? `Replaces ${deck[a]?.title} and ${deck[b]?.title} with one Mixed Potion.`
                : `Replaces ${deck[a]?.title} with this strengthened Potion.`}
          </p>
          <BattleCardButton
            card={result}
            ariaLabel={`Inspect brew result: ${result.title}`}
            className={collectionTileWidthClass}
            shimmerActive={false}
            shimmerToken={undefined}
          />
          <p>{price ? `Costs ${price} Gold` : "No Gold or materials required"}</p>
        </div>
      )}
      {!afford && <p role="status">Not enough Gold. Brewing costs {price} Gold.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={!result || !afford}
          onClick={() => {
            if (!onConfirm(operation))
              setError("This brew is no longer available. Select eligible Potions and try again.");
          }}
        >
          Brew{price ? ` · ${price} Gold` : ""}
        </Button>
      </div>
    </div>
  );
}
