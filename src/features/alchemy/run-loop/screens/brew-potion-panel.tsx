import { focusControl } from "@/features/alchemy/shared/ui/dialogs/focus-navigation";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { PotionComparison } from "./potion-comparison";
import { playUISound } from "@/lib/audio";
import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { FlaskConical, Merge, MoveRight, Pipette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BattleCard, isPotionCard } from "@/lib/game-data";
import { strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { cn } from "@/lib/utils";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { usePotionDrag } from "./use-potion-drag";
import { useCaptureEscapeCancel } from "../../shared/ui/dialogs/use-modal-escape-dismiss";

export interface BrewPotionPanelHandle {
  back: () => void;
}
const PREPARATION_CARD_WIDTH = "w-[calc(12*var(--content-rem,1rem))]";
const EMPTY_OFFERS: BattleCard[] = [];
export function BrewPotionPanel({
  ref,
  deck,
  offers = EMPTY_OFFERS,
  kind,
  variant = "campfire",
  price = 0,
  gold = 0,
  selectionSound = "selection",
  onConfirm,
  isProgressSavePending = () => false,
  onBack,
}: {
  ref?: Ref<BrewPotionPanelHandle>;
  deck: BattleCard[];
  offers?: BattleCard[];
  kind: BrewOperation["kind"];
  variant?: "campfire" | "alchemist";
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
  const [error, setError] = useState<"deck" | "potion" | "brew" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectionDeck, setSelectionDeck] = useState(deck);
  const [selectionOffers, setSelectionOffers] = useState(offers);

  const confirmRef = useRef<HTMLButtonElement>(null);
  if (!submitted && (selectionDeck !== deck || selectionOffers !== offers)) {
    setSelectionDeck(deck);
    setSelectionOffers(offers);
    setSelected([]);
    setPage(0);
    setError("deck");
  }
  const sourceDeck = submitted ? selectionDeck : deck;
  const sourceCards = kind === "new" ? (submitted ? selectionOffers : offers) : sourceDeck;
  const drag = usePotionDrag({ disabled: submitted || isProgressSavePending(), identity: sourceCards, onDrop: place });
  useLayoutEffect(() => {
    if ((kind === "strengthen" || kind === "new") && selected.length === 1 && document.activeElement === document.body)
      focusControl(confirmRef.current);
  }, [kind, selected]);
  function back() {
    if (drag.cancel()) return;
    if (submitted) {
      onBack();
      return;
    }
    if (selected.some((index) => index >= 0)) {
      setSelected([]);
      setError(null);
    } else onBack();
  }
  useImperativeHandle(ref, () => ({ back }));
  useCaptureEscapeCancel(back);
  const items =
    kind === "new"
      ? sourceCards.map((card, index) => ({ card, index, preview: card }))
      : sourceDeck.flatMap((card, index) => {
          if (!isPotionCard(card)) return [];
          const preview = kind === "strengthen" ? strengthenPotion(card) : null;
          return kind === "strengthen" && !preview ? [] : [{ card, index, preview }];
        });
  const a = selected[0] ?? -1;
  const b = selected[1] ?? -1;
  const operation: BrewOperation =
    kind === "new" ? { kind, offerIndex: a } : kind === "strengthen" ? { kind, index: a } : { kind, indices: [a, b] };
  const result =
    kind === "new"
      ? (submitted ? selectionOffers : offers)[a]
      : kind === "strengthen"
        ? items.find((item) => item.index === a)?.preview
        : a >= 0 && b >= 0 && a !== b
          ? tryCreateMixedPotion(sourceDeck[a], sourceDeck[b])
          : null;
  const afford = gold >= price;
  function confirm(operation: BrewOperation) {
    if (submitted || isProgressSavePending()) return;
    if (onConfirm(operation)) setSubmitted(true);
    else setError(kind === "new" ? "potion" : "brew");
  }
  function choose(index: number) {
    if (submitted || isProgressSavePending()) return;
    playUISound(selectionSound);
    setError(null);
    if (kind === "new" && variant === "campfire") {
      confirm({ kind: "new", offerIndex: index });
      return;
    }
    setSelected((previous) => {
      if (kind !== "combine") return previous.includes(index) ? [] : [index];
      const next = [previous[0] ?? -1, previous[1] ?? -1];
      const existing = next.indexOf(index);
      if (existing >= 0) {
        next[existing] = -1;
        return next;
      }
      const empty = next.indexOf(-1);
      if (empty >= 0) {
        next[empty] = index;
        return next;
      }
      return [next[1]!, index];
    });
  }
  function place(index: number, slot: number) {
    if (submitted || isProgressSavePending() || !items.some((item) => item.index === index)) return;
    playUISound(selectionSound);
    setError(null);
    setSelected((previous) => {
      if (kind !== "combine") return [index];
      const next = [previous[0] ?? -1, previous[1] ?? -1];
      const other = 1 - slot;
      if (next[other] === index) next[other] = next[slot]!;
      next[slot] = index;
      return next;
    });
  }
  const pagination = getPagination(items.length, page, 4);
  const renderCard = (card: BattleCard, index: number) => (
    <SelectableCard
      card={card}
      chrome="shop"
      isSelected={selected.includes(index)}
      disabled={submitted}
      onSelect={() => choose(index)}
    />
  );
  const resultCard = (card: BattleCard, width: string, label: string) => (
    <BattleCardButton card={card} ariaLabel={label} shimmerActive={false} shimmerToken={undefined} className={width} />
  );
  return (
    <div
      data-potion-preparation
      className={cn("flex w-full max-w-4xl flex-col items-center", variant === "alchemist" ? "gap-6" : "gap-5")}
    >
      {variant === "campfire" && (
        <h2 className="text-xl">
          {i18n.displayText(
            kind === "new"
              ? i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")
              : kind === "combine"
                ? i18n.text("ui.brew-potion-panel.d2", "Mix Potion")
                : i18n.text("ui.brew-potion-panel.d3", "Select a Potion to Distill"),
          )}
        </h2>
      )}
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
      ) : kind === "strengthen" && variant === "campfire" && result && sourceDeck[a] ? (
        <PotionComparison original={sourceDeck[a]} result={result} />
      ) : kind === "combine" || variant === "alchemist" ? (
        <>
          <div
            className="flex flex-wrap justify-center gap-5"
            aria-label={
              kind === "combine"
                ? i18n.text("brewing.choose-two", "Choose two Potions")
                : i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")
            }
          >
            {items.slice(pagination.page * 4, (pagination.page + 1) * 4).map(({ card, index }) => (
              <div
                key={index}
                data-potion-choice={index}
                className={cn(PREPARATION_CARD_WIDTH, "touch-none")}
                onPointerDown={(event) => drag.onPointerDown(index, event)}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
                onPointerCancel={drag.onPointerCancel}
                onLostPointerCapture={drag.onLostPointerCapture}
                onClickCapture={drag.onClickCapture}
              >
                <div data-potion-movable className="relative">
                  <SelectableCard
                    card={card}
                    chrome="shop"
                    widthClass="w-full"
                    suppressTooltip={drag.draggedIndex !== null}
                    isSelected={selected.includes(index)}
                    disabled={submitted}
                    onSelect={() => choose(index)}
                  />
                </div>
              </div>
            ))}
          </div>
          <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
        </>
      ) : (
        <CardSelectionGrid
          items={items}
          {...(kind === "new" ? { pageSize: items.length } : {})}
          page={page}
          onPageChange={setPage}
          selectedIndex={items.findIndex((item) => item.index === a)}
          renderItem={({ card, index }) => renderCard(card, index)}
        />
      )}
      {(kind === "combine" || variant === "alchemist") && items.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-center gap-4"
          aria-label={i18n.text("ui.brew-potion-panel.2", "Brew preview")}
        >
          {(kind === "combine" ? [0, 1] : [0]).map((slot) => (
            <div key={slot} className="contents">
              {slot === 1 && <Plus aria-hidden="true" className="h-6 w-6 text-muted-foreground" />}
              <div
                className={cn(
                  PREPARATION_CARD_WIDTH,
                  "rounded-shell-card",
                  drag.dropTarget === slot &&
                    (kind === "new"
                      ? "outline-2 outline-offset-4 outline-emerald-300"
                      : kind === "strengthen"
                        ? "outline-2 outline-offset-4 outline-amber-300"
                        : "outline-2 outline-offset-4 outline-violet-300"),
                )}
                data-mix-slot={kind === "combine" ? slot : undefined}
                data-preparation-slot={slot}
              >
                {sourceCards[selected[slot] ?? -1] ? (
                  <BattleCardButton
                    card={sourceCards[selected[slot]!]!}
                    ariaLabel={i18n.text("brewing.clear-slot", "Remove Potion from slot {{slot}}", { slot: slot + 1 })}
                    className="w-full"
                    shimmerActive={false}
                    shimmerToken={undefined}
                    ariaDisabled={submitted}
                    onClick={() => {
                      if (!submitted)
                        setSelected((previous) => {
                          const next = [...previous];
                          next[slot] = -1;
                          return next;
                        });
                    }}
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={i18n.text("brewing.empty-slot", "Empty Potion slot {{slot}}", { slot: slot + 1 })}
                    className="pointer-events-none flex aspect-[3/4] items-center justify-center rounded-shell-card border border-dashed border-border text-muted-foreground"
                  >
                    <FlaskConical aria-hidden="true" className="h-10 w-10" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {kind !== "new" && (
            <>
              <MoveRight
                aria-hidden="true"
                className={cn("h-9 w-9", kind === "strengthen" ? "text-amber-300" : "text-violet-300")}
              />
              <div className={PREPARATION_CARD_WIDTH}>
                {result ? (
                  resultCard(
                    result,
                    "w-full",
                    i18n.text("ui.brew-potion-panel.3", "Inspect brew result: {{value0}}", {
                      value0: i18n.displayText(result.title),
                    }),
                  )
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex aspect-[3/4] items-center justify-center rounded-shell-card border border-dashed border-border"
                  >
                    {kind === "strengthen" ? (
                      <Pipette className="h-10 w-10 text-amber-300" />
                    ) : (
                      <Merge className="h-10 w-10 text-violet-300" />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
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
      {error && (
        <p role="alert">
          {i18n.displayText(
            error === "deck"
              ? "Deck changed. Select again."
              : error === "potion"
                ? "This Potion is no longer available."
                : "This brew is no longer available.",
          )}
        </p>
      )}
      <div className="flex justify-center gap-3">
        <Button size={variant === "alchemist" ? "lg" : "default"} variant="outline" onClick={back}>
          {i18n.text("ui.brew-potion-panel.6", "Back")}
        </Button>
        {(kind !== "new" || variant === "alchemist") && (
          <Button
            size={variant === "alchemist" ? "lg" : "default"}
            ref={confirmRef}
            disabled={submitted || !result || !afford || isProgressSavePending()}
            onClick={() => confirm(operation)}
          >
            {i18n.displayText(
              kind === "new"
                ? i18n.text("shop.brewing.brew", "Brew")
                : kind === "combine"
                  ? i18n.text("ui.brew-potion-panel.d7", "Mix")
                  : i18n.text("ui.brew-potion-panel.d8", "Distill"),
            )}
            {i18n.displayText(
              price ? i18n.text("ui.brew-potion-panel.d9", " · {{value0}} Gold", { value0: price }) : "",
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
