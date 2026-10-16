import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
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
  selectionSound?: "selection" | "shopSelect";
  onConfirm: (operation: BrewOperation) => BattleCard | null;
  isProgressSavePending?: () => boolean;
  onBack: () => void;
}) {
  const i18n = useGameTranslation();
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [selectionDeck, setSelectionDeck] = useState(deck);
  if (!submitted && selectionDeck !== deck) {
    setSelectionDeck(deck);
    setSelected([]);
    setPage(0);
    setError("Deck changed. Select again.");
  }
  // An accepted brew changes the live deck before its saved result replaces this panel.
  const sourceDeck = submitted ? selectionDeck : deck;
  useLayoutEffect(() => {
    if (kind === "strengthen" && selected.length === 1 && document.activeElement === document.body)
      confirmRef.current?.focus();
  }, [kind, selected]);
  useCaptureEscapeCancel(onBack);
  const items =
    kind === "new"
      ? offers.map((card, index) => ({ card, index }))
      : sourceDeck
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
        ? sourceDeck[a]
          ? strengthenPotion(sourceDeck[a])
          : null
        : a !== b
          ? tryCreateMixedPotion(sourceDeck[a], sourceDeck[b])
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
        {i18n.displayText(
          kind === "new"
            ? i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")
            : kind === "combine"
              ? i18n.text("ui.brew-potion-panel.d2", "Mix Potion")
              : i18n.text("ui.brew-potion-panel.d3", "Select a Potion to Distill"),
        )}
      </h2>
      {!items.length ? (
        <p role="status">
          {i18n.displayText(
            kind === "strengthen"
              ? i18n.text("ui.brew-potion-panel.d4", "No eligible Potions.")
              : kind === "new"
                ? i18n.text("ui.brew-potion-panel.d5", "No Potion recipes are available.")
                : i18n.text("ui.brew-potion-panel.d6", "Two eligible Potions required."),
          )}
        </p>
      ) : kind === "strengthen" && result && sourceDeck[a] ? (
        <PotionComparison original={sourceDeck[a]} result={result} />
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
      {kind === "combine" && items.length === 1 && (
        <p role="status">{i18n.text("ui.brew-potion-panel.1", "Two eligible Potions required.")}</p>
      )}
      {kind === "combine" && result && (
        <div
          className="flex flex-col items-center gap-3"
          aria-label={i18n.text("ui.brew-potion-panel.2", "Brew preview")}
        >
          <BattleCardButton
            card={result}
            ariaLabel={i18n.text("ui.brew-potion-panel.3", "Inspect brew result: {{value0}}", {
              value0: i18n.displayText(result.title),
            })}
            className={collectionTileWidthClass}
            shimmerActive={false}
            shimmerToken={undefined}
          />
        </div>
      )}
      {!submitted && !afford && (
        <p role="status">
          <GameMessage
            id="ui.brew-potion-panel.s1"
            defaultValue="Not enough Gold. Brewing costs <part0/> Gold."
            parts={{ part0: price }}
          />
        </p>
      )}
      {error && <p role="alert">{i18n.displayText(error)}</p>}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          {i18n.text("ui.brew-potion-panel.6", "Back")}
        </Button>
        {kind !== "new" && (
          <>
            {kind === "strengthen" && result && (
              <Button variant="outline" disabled={submitted} onClick={() => setSelected([])}>
                {i18n.text("ui.brew-potion-panel.7", "Choose Another Potion")}
              </Button>
            )}
            <Button
              ref={confirmRef}
              disabled={submitted || !result || !afford || isProgressSavePending()}
              onClick={() => confirm(operation)}
            >
              {i18n.displayText(
                kind === "combine"
                  ? i18n.text("ui.brew-potion-panel.d7", "Mix")
                  : i18n.text("ui.brew-potion-panel.d8", "Distill"),
              )}
              {i18n.displayText(
                price ? i18n.text("ui.brew-potion-panel.d9", " · {{value0}} Gold", { value0: price }) : "",
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
