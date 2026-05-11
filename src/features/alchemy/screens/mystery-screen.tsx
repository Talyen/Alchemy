// Mystery event screen — shows a random narrative event with choices.
// After choosing, transitions to a dedicated reward screen with victory
// sounds and visual summaries of all gains.
import { useState } from "react";
import type { CSSProperties } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { playVictory } from "@/lib/audio";
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { PaginationControls, ScreenHeader } from "../ui/shared-ui";
import { cardSurfaceClass, collectionCardWidthClass, handCardWidthClass, staticCardTransform } from "../config";
import { MysteryEffectBadge, MysteryEffectList } from "../ui/mystery-effect-badge";
import type { MysteryEvent, MysteryChoice, MysteryEffect } from "../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { AnimatedHeight } from "../ui/animated-height";
import { BattleCardButton, DetailPopup } from "../ui/card-ui";

function RewardScreen({
  choice,
  runDeck,
  findCard,
  findTrinket,
  onContinue,
  eventTitle,
}: {
  choice: MysteryChoice;
  runDeck: BattleCard[];
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onContinue: () => void;
  eventTitle: string;
}) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title={eventTitle} />

      {choice.effects.map((effect, i) => {
        switch (effect.kind) {
          case "addCard": {
            const card = findCard(effect.cardId);
            if (!card) return null;
            const isHovered = hoveredItemId === card.id;
            return (
              <div key={i} className="flex flex-col items-center gap-3">
                <BattleCardButton
                  card={card}
                  hovered={isHovered}
                  onHoverStart={() => setHoveredItemId(card.id)}
                  onHoverEnd={() => setHoveredItemId(null)}
                  ariaLabel={card.title}
                  shimmerActive={false} shimmerToken={undefined}
                  className={handCardWidthClass}
                />
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground">Added {card.title} to your Deck</p>
              </div>
            );
          }
          case "addRandomCard": {
            // The controller has already appended the random card before this reward view
            // renders, so the newest deck card is the card to display.
            const card = runDeck[runDeck.length - 1];
            if (!card) return null;
            const isHovered = hoveredItemId === card.id;
            return (
              <div key={i} className="flex flex-col items-center gap-3">
                <BattleCardButton
                  card={card}
                  hovered={isHovered}
                  onHoverStart={() => setHoveredItemId(card.id)}
                  onHoverEnd={() => setHoveredItemId(null)}
                  ariaLabel={card.title}
                  shimmerActive={false} shimmerToken={undefined}
                  className={handCardWidthClass}
                />
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground">Added {card.title} to your Deck</p>
              </div>
            );
          }
          case "gainTrinket": {
            const trinket = findTrinket(effect.trinketId);
            if (!trinket) return null;
            const isHovered = hoveredItemId === trinket.id;
            return (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="relative" onMouseEnter={() => setHoveredItemId(trinket.id)} onMouseLeave={() => setHoveredItemId(null)}>
                  {isHovered ? (
                    <DetailPopup idPrefix={trinket.id} title={trinket.title} subtitle="Trinket" descriptionLines={trinket.descriptionLines} />
                  ) : null}
                  <div
                    className={cn("tilt-surface", cardSurfaceClass, collectionCardWidthClass)}
                    data-tilt-strength="11"
                    onMouseMove={setTiltFromEvent}
                    onMouseLeave={clearTiltFromEvent}
                    style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
                  >
                    <img
                      src={trinket.art}
                      alt={trinket.title}
                      className="block w-full rounded-[30px] aspect-square"
                      loading="eager"
                    />
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">{trinket.title}</p>
                <p className="text-sm text-muted-foreground">Added {trinket.title} to your Inventory</p>
              </div>
            );
          }
          case "gainRandomTrinket":
            return (
              <p key={i} className="text-base font-semibold text-foreground">
                Gained a random trinket
              </p>
            );
          case "gainGold":
            return (
              <div key={i} className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                Found
                <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
              </div>
            );
          case "loseGold":
            return (
              <div key={i} className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                Lost
                <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
              </div>
            );
          case "gainMaterial":
            return (
              <div key={i} className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                Found
                <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
              </div>
            );
          case "chooseCard": {
          // Card choice confirmation also mutates the deck before this summary appears;
          // show the last deck card as the selected reward result.
          const card = runDeck[runDeck.length - 1];
          if (!card) return null;
          const isHovered = hoveredItemId === card.id;
          return (
            <div key={i} className="flex flex-col items-center gap-3">
              <BattleCardButton
                card={card}
                hovered={isHovered}
                onHoverStart={() => setHoveredItemId(card.id)}
                onHoverEnd={() => setHoveredItemId(null)}
                ariaLabel={card.title}
                shimmerActive={false} shimmerToken={undefined}
                className={handCardWidthClass}
              />
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
              <p className="text-sm text-muted-foreground">Added {card.title} to your Deck</p>
            </div>
          );
        }
        case "none":
            return null;
          default:
            return (
              <p key={i} className="text-base text-muted-foreground">
                <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} />
              </p>
            );
        }
      })}

      <Button size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function RemoveCardPicker({
  runDeck,
  onSelect,
  onCancel,
}: {
  runDeck: BattleCard[];
  onSelect: (index: number) => void;
  onCancel: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(runDeck.length / COLLECTION_PAGE_SIZE);
  const start = page * COLLECTION_PAGE_SIZE;
  const visible = runDeck.slice(start, start + COLLECTION_PAGE_SIZE);

  return (
    <div className="state-swap space-y-6 text-center">
      <h2 className="text-3xl text-foreground">Select a card to remove</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {visible.map((card, i) => {
          const idx = start + i;
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-transparent hover:border-border"
              )}
            >
              <BattleCardButton
                card={card}
                hovered={isSelected}
                onHoverStart={() => {}}
                onHoverEnd={() => {}}
                ariaLabel={card.title}
                shimmerActive={false} shimmerToken={undefined}
                className={collectionCardWidthClass}
              />
              <p className="text-xs text-foreground">{card.title}</p>
            </button>
          );
        })}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} size="sm" />
      <div className="flex justify-center gap-4">
        <Button size="lg" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="lg"
          disabled={selectedIndex === null}
          onClick={() => { if (selectedIndex !== null) onSelect(selectedIndex); }}
        >
          Remove Card
        </Button>
      </div>
    </div>
  );
}

function CardChoicePicker({
  choices,
  onSelect,
}: {
  choices: BattleCard[];
  onSelect: (cardId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title="Choose a Card" />
      <p className="text-base text-muted-foreground">Select one of the scrolls to add to your deck</p>
      <div className="flex flex-wrap items-start justify-center gap-6">
        {choices.map((card, i) => {
          const isSelected = selectedId === card.id;
          return (
            <BattleCardButton
              key={card.id}
              card={card}
              hovered={isSelected}
              onHoverStart={() => setSelectedId(card.id)}
              onHoverEnd={() => {}}
              onClick={() => setSelectedId(card.id)}
              ariaLabel={`Select ${card.title}`}
              shimmerActive={false} shimmerToken={undefined}
              className={collectionCardWidthClass}
              wrapperClassName="stagger-item relative flex justify-center"
              wrapperStyle={{ "--stagger-index": i } as CSSProperties}
              selected={isSelected}
            />
          );
        })}
      </div>
      <Button
        size="lg"
        disabled={selectedId === null}
        onClick={() => { if (selectedId !== null) onSelect(selectedId); }}
      >
        Add Card
      </Button>
    </div>
  );
}

export function MysteryScreen({
  event,
  onChoose,
  onChooseCard,
  onRemoveCard,
  onContinue,
  runDeck,
  findCard,
  findTrinket,
  mysteryCardChoices,
}: {
  event: MysteryEvent;
  onChoose: (choice: MysteryChoice) => void;
  onChooseCard: (cardId: string) => void;
  onRemoveCard: (index: number) => void;
  onContinue: () => void;
  runDeck: BattleCard[];
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  mysteryCardChoices: BattleCard[] | null;
}) {
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MysteryChoice | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  function hasPositiveEffect(effects: MysteryEffect[]) {
    return effects.some((e) =>
      ["addCard", "addRandomCard", "chooseCard", "gainTrinket", "gainRandomTrinket", "healHP", "gainGold", "gainMaxMana", "gainXP", "gainMaterial"].includes(e.kind)
    );
  }
  function handlePick(choice: MysteryChoice) {
    // Follow-up card/removal choices split state mutation from the reward screen: the
    // controller applies effects first, then this screen shows the picker or summary.
    const hasChooseCard = choice.effects.some((e) => e.kind === "chooseCard");

    if (hasChooseCard) {
      setChosen(choice);
      onChoose(choice);
      return;
    }

    onChoose(choice);

    const needsRemoval = choice.effects.some((e) => e.kind === "removeCard" && e.mode === "choose");

    if (needsRemoval) {
      setPendingRemoval(choice);
    } else {
      setChosen(choice);
      if (hasPositiveEffect(choice.effects)) playVictory();
    }
  }

  function handleRemoveConfirm(index: number) {
    // pendingRemoval is expected here because this path is reachable only after choosing
    // a remove-card event; after removal, resume the delayed result screen.
    onRemoveCard(index);
    setPendingRemoval(null);
    if (!chosen) {
      const choice = pendingRemoval!;
      setChosen(choice);
      if (hasPositiveEffect(choice.effects)) playVictory();
    }
  }

  function handleCardChoiceConfirm(cardId: string) {
    onChooseCard(cardId);
    playVictory();
  }

  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-6 text-center">
      <AnimatedHeight deps={[pendingRemoval, chosen, mysteryCardChoices]}>
        {mysteryCardChoices ? (
          <CardChoicePicker choices={mysteryCardChoices} onSelect={handleCardChoiceConfirm} />
        ) : pendingRemoval ? (
          <RemoveCardPicker
            runDeck={runDeck}
            onSelect={handleRemoveConfirm}
            onCancel={() => setPendingRemoval(null)}
          />
        ) : chosen ? (
          <RewardScreen choice={chosen} runDeck={runDeck} findCard={findCard} findTrinket={findTrinket} onContinue={onContinue} eventTitle={event.title} />
        ) : (
          <div className="state-swap flex flex-col items-center gap-6">
            {featuredCard ? (
              <BattleCardButton
                card={featuredCard}
                hovered={isHovered}
                onHoverStart={() => setHoveredCardId(event.id)}
                onHoverEnd={() => setHoveredCardId(null)}
                ariaLabel={featuredCard.title}
                shimmerActive={false} shimmerToken={undefined}
                className={handCardWidthClass}
              />
            ) : event.art ? (
              <div
                className={cn("tilt-surface", cardSurfaceClass, handCardWidthClass)}
                data-tilt-strength="15"
                onMouseMove={setTiltFromEvent}
                onMouseLeave={clearTiltFromEvent}
                style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
              >
                <img
                  src={event.art}
                  alt={event.title}
                  className="block h-auto w-full rounded-[30px] aspect-[3/4]"
                  loading="eager"
                />
              </div>
            ) : null}
            <ScreenHeader title={event.title} />
            <TextAnimate
              animation="blurInUp"
              by="word"
              once
              className="max-w-lg text-base leading-relaxed text-muted-foreground"
            >
              {event.narrative}
            </TextAnimate>

            <div className="flex flex-wrap justify-center gap-4">
              {event.choices.map((choice, i) => (
                <BlurFade key={i} delay={0.6 + i * 0.15} direction="up" offset={8}>
                  <div className="group relative">
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-w-32"
                      onClick={() => handlePick(choice)}
                    >
                      {choice.label}
                    </Button>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 translate-y-1 rounded-[16px] border border-border/80 bg-card px-3 py-2 text-left text-sm leading-6 text-muted-foreground opacity-0 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <MysteryEffectList effects={choice.effects} findCard={findCard} findTrinket={findTrinket} />
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        )}
      </AnimatedHeight>
    </div>
  );
}
