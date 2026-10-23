import { focusControl } from "@/features/alchemy/shared/ui/dialogs/focus-navigation";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { PotionComparison } from "./potion-comparison";
import { playUISound } from "@/lib/audio";
import { useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { FlaskConical, Merge, MoveRight, Pipette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BattleCard, isPotionCard } from "@/lib/game-data";
import { strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { cn } from "@/lib/utils";
import { collectionShellWidthClass, collectionTileWidthClass } from "../../shared/config";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/cards/card-selection-grid";
import { FlankingPagination, PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { Surface } from "../../shared/ui/surface";
import { GoldCost } from "../../shared/ui/display-elements";
import { BrewPotionChoiceOverlay } from "./brew-potion-choice-overlay";
import { usePotionDrag } from "./use-potion-drag";
import { useCaptureEscapeCancel } from "../../shared/ui/dialogs/use-modal-escape-dismiss";

export interface BrewPotionPanelHandle {
  back: () => void;
}
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
  onContinue,
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
  onContinue?: (() => void) | undefined;
}) {
  const i18n = useGameTranslation();
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const recipeSlot = useRef<HTMLButtonElement>(null);
  const priceId = useId();
  const recipeBrew = kind === "new" && variant === "alchemist";
  const preparationWidthClass =
    variant === "alchemist" ? collectionTileWidthClass : "w-[calc(12*var(--content-rem,1rem))]";
  const [error, setError] = useState<"deck" | "potion" | "brew" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectionDeck, setSelectionDeck] = useState(deck);
  const [selectionOffers, setSelectionOffers] = useState(offers);

  const confirmRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const completed = Boolean(onContinue);
  useLayoutEffect(() => {
    if (completed) focusControl(continueRef.current);
  }, [completed]);
  if (!submitted && (selectionDeck !== deck || selectionOffers !== offers)) {
    setSelectionDeck(deck);
    setSelectionOffers(offers);
    setSelected([]);
    setPage(0);
    setError("deck");
    setRecipeOpen(false);
  }
  const sourceDeck = submitted ? selectionDeck : deck;
  const sourceCards = kind === "new" ? (submitted ? selectionOffers : offers) : sourceDeck;
  const drag = usePotionDrag({ disabled: submitted || isProgressSavePending(), identity: sourceCards, onDrop: place });
  useLayoutEffect(() => {
    if ((kind === "strengthen" || kind === "new") && selected.length === 1 && document.activeElement === document.body)
      focusControl(confirmRef.current);
  }, [kind, selected]);
  function back() {
    if (recipeOpen) {
      setRecipeOpen(false);
      return;
    }
    if (drag.cancel()) return;
    if (submitted) {
      onBack();
      return;
    }
    if (!recipeBrew && selected.some((index) => index >= 0)) {
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
    if (submitted || recipeOpen || isProgressSavePending()) return;
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
    if (recipeBrew) {
      setSelected([index]);
      setRecipeOpen(false);
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
  const resultCard = (card: BattleCard, label: string) => (
    <BattleCardButton
      card={card}
      ariaLabel={label}
      shimmerActive={false}
      shimmerToken={undefined}
      className="h-full w-full"
      wrapperClassName="absolute inset-0"
    />
  );
  const ingredients = (
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
          className={cn(preparationWidthClass, "shrink-0 touch-none")}
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
  );
  return (
    <div
      data-potion-preparation
      className={cn("flex w-full flex-col items-center", variant === "alchemist" ? "gap-6" : "max-w-4xl gap-5")}
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
      ) : recipeBrew ? null : kind === "combine" || variant === "alchemist" ? (
        <>
          {variant === "alchemist" ? (
            <FlankingPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              className={collectionShellWidthClass}
            >
              {ingredients}
            </FlankingPagination>
          ) : (
            <>
              {ingredients}
              <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
            </>
          )}
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
                  preparationWidthClass,
                  "relative aspect-[3/4] shrink-0 rounded-shell-card",
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
                    buttonRef={recipeBrew ? recipeSlot : undefined}
                    ariaLabel={
                      recipeBrew
                        ? i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")
                        : i18n.text("brewing.clear-slot", "Remove Potion from slot {{slot}}", { slot: slot + 1 })
                    }
                    className="h-full w-full"
                    wrapperClassName="absolute inset-0"
                    suppressTooltip={recipeOpen}
                    shimmerActive={false}
                    shimmerToken={undefined}
                    ariaDisabled={submitted}
                    onClick={() => {
                      if (recipeBrew) {
                        if (!submitted && !isProgressSavePending()) setRecipeOpen(true);
                        return;
                      }
                      if (!submitted)
                        setSelected((previous) => {
                          const next = [...previous];
                          next[slot] = -1;
                          return next;
                        });
                    }}
                  />
                ) : recipeBrew ? (
                  <Surface
                    as="button"
                    buttonRef={recipeSlot}
                    ariaLabel={i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")}
                    disabled={submitted || isProgressSavePending()}
                    onClick={() => setRecipeOpen(true)}
                    className="absolute inset-0 flex h-full w-full items-center justify-center rounded-shell-card border border-dashed border-border bg-transparent text-muted-foreground hover:border-emerald-300 hover:text-emerald-300"
                    clipContents={false}
                  >
                    <FlaskConical aria-hidden="true" className="h-10 w-10" />
                  </Surface>
                ) : (
                  <div
                    role="img"
                    aria-label={i18n.text("brewing.empty-slot", "Empty Potion slot {{slot}}", { slot: slot + 1 })}
                    className="pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center rounded-shell-card border border-dashed border-border text-muted-foreground"
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
              <div className={cn(preparationWidthClass, "relative aspect-[3/4] shrink-0")}>
                {result ? (
                  resultCard(
                    result,
                    i18n.text("ui.brew-potion-panel.3", "Inspect brew result: {{value0}}", {
                      value0: i18n.displayText(result.title),
                    }),
                  )
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex h-full w-full items-center justify-center rounded-shell-card border border-dashed border-border"
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
      <div className="grid">
        <div
          className={cn("col-start-1 row-start-1 flex items-start justify-center gap-3", onContinue && "invisible")}
          inert={Boolean(onContinue)}
          aria-hidden={onContinue ? true : undefined}
        >
          <Button
            size={variant === "alchemist" ? "lg" : "default"}
            variant="outline"
            className={variant === "alchemist" ? "min-w-32" : undefined}
            onClick={back}
          >
            {i18n.text("ui.brew-potion-panel.6", "Back")}
          </Button>
          {(kind !== "new" || variant === "alchemist") && (
            <div className="flex flex-col items-center gap-3">
              <Button
                size={variant === "alchemist" ? "lg" : "default"}
                ref={confirmRef}
                className={variant === "alchemist" ? "min-w-32" : undefined}
                aria-describedby={price > 0 || variant === "alchemist" ? priceId : undefined}
                disabled={submitted || recipeOpen || !result || !afford || isProgressSavePending()}
                onClick={() => confirm(operation)}
              >
                {i18n.displayText(
                  kind === "new"
                    ? i18n.text("shop.brewing.brew", "Brew")
                    : kind === "combine"
                      ? i18n.text("ui.brew-potion-panel.d7", "Mix")
                      : i18n.text("ui.brew-potion-panel.d8", "Distill"),
                )}
              </Button>
              {(price > 0 || variant === "alchemist") && (
                <div id={priceId} className="flex h-10 items-center justify-center">
                  <GoldCost amount={price} affordable={afford} />
                </div>
              )}
            </div>
          )}
        </div>
        {onContinue && (
          <div className="col-start-1 row-start-1 flex items-start justify-center">
            <Button ref={continueRef} size="lg" className="min-w-56" onClick={onContinue}>
              {i18n.text("shop.brewing.continue", "Continue")}
            </Button>
          </div>
        )}
      </div>
      {recipeBrew && (
        <BrewPotionChoiceOverlay
          open={recipeOpen}
          offers={sourceCards}
          onChoose={choose}
          onClose={() => setRecipeOpen(false)}
          returnFocusRef={recipeSlot}
        />
      )}
    </div>
  );
}
