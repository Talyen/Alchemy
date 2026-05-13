// Focused mystery-screen subviews for rewards and follow-up choices.
// Depends on shared card/trinket UI and mystery effect badges.
// Used only by MysteryScreen to keep event flow separate from rendering details.
import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionCardWidthClass, handCardWidthClass, staticCardTransform } from "../../config";
import type { MysteryChoice, MysteryEvent, MysteryEffect } from "../../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent } from "../../utils";
import { BattleCardButton, DetailPopup } from "../../ui/card-ui";
import { MysteryEffectBadge, MysteryEffectList } from "../../ui/mystery-effect-badge";
import { PaginationControls, ScreenHeader } from "../../ui/shared-ui";

type LookupProps = {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
};

/** True when any mystery effect is a net positive (card gain, heal, gold, materials, etc). */
export function hasPositiveMysteryEffect(effects: MysteryEffect[]) {
  return effects.some((e) =>
    ["addCard", "addRandomCard", "chooseCard", "gainTrinket", "gainRandomTrinket", "healHP", "gainGold", "gainMaxMana", "gainXP", "gainMaterial"].includes(e.kind)
  );
}

/** True when the choice opens a card-selection picker that pauses further effect resolution. */
export function choiceOffersCardSelection(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "chooseCard");
}

/** True when the choice opens a remove-card picker that pauses further effect resolution. */
export function choiceRequiresCardRemoval(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "removeCard" && e.mode === "choose");
}

// Renders the final consequence summary after the controller has already mutated run state.
export function MysteryRewardSummary({
  choice,
  runDeck,
  findCard,
  findTrinket,
  onContinue,
  eventTitle,
}: {
  choice: MysteryChoice;
  runDeck: BattleCard[];
  onContinue: () => void;
  eventTitle: string;
} & LookupProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  function renderCardReward(card: BattleCard, key: number) {
    const isHovered = hoveredItemId === card.id;
    return (
      <div key={key} className="flex flex-col items-center gap-3">
        <BattleCardButton
          card={card}
          hovered={isHovered}
          onHoverStart={() => setHoveredItemId(card.id)}
          onHoverEnd={() => setHoveredItemId(null)}
          ariaLabel={card.title}
          shimmerActive={false}
          shimmerToken={undefined}
          className={handCardWidthClass}
        />
        <p className="text-sm font-semibold text-foreground">{card.title}</p>
        <p className="text-sm text-muted-foreground">Added {card.title} to your Deck</p>
      </div>
    );
  }

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title={eventTitle} />

      {choice.effects.map((effect, i) => {
        switch (effect.kind) {
          case "addCard": {
            const card = findCard(effect.cardId);
            return card ? renderCardReward(card, i) : null;
          }
          case "addRandomCard":
          case "chooseCard": {
            const card = runDeck[runDeck.length - 1];
            return card ? renderCardReward(card, i) : null;
          }
          case "gainTrinket": {
            const trinket = findTrinket(effect.trinketId);
            if (!trinket) return null;
            const isHovered = hoveredItemId === trinket.id;
            return (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="relative" onMouseEnter={() => setHoveredItemId(trinket.id)} onMouseLeave={() => setHoveredItemId(null)}>
                  {isHovered ? (
                    <DetailPopup idPrefix={trinket.id} title={trinket.title} subtitle={undefined} descriptionLines={trinket.descriptionLines} />
                  ) : null}
                  <div
                    className={cn("tilt-surface", cardSurfaceClass, collectionCardWidthClass)}
                    data-tilt-strength="11"
                    onMouseMove={setTiltFromEvent}
                    onMouseLeave={clearTiltFromEvent}
                    style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
                  >
                    <img src={trinket.art} alt={trinket.title} className="block w-full rounded-[30px] aspect-square" loading="eager" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">{trinket.title}</p>
                <p className="text-sm text-muted-foreground">Added {trinket.title} to your Inventory</p>
              </div>
            );
          }
          case "gainRandomTrinket":
            return <p key={i} className="text-base font-semibold text-foreground">Gained a random trinket</p>;
          case "gainGold":
          case "gainMaterial":
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
          case "removeCard":
            return null;
          case "none":
            return null;
          default:
            return <p key={i} className="text-base text-muted-foreground"><MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} /></p>;
        }
      })}

      <Button size="lg" onClick={onContinue}>Continue</Button>
    </div>
  );
}

// Lets the player choose the exact deck card removed by a mystery consequence.
export function RemoveCardPicker({
  runDeck,
  onSelect,
}: {
  runDeck: BattleCard[];
  onSelect: (index: number) => void;
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
              className={cn("flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent hover:border-border")}
            >
              <BattleCardButton card={card} hovered={isSelected} onHoverStart={() => {}} onHoverEnd={() => {}} ariaLabel={card.title} shimmerActive={false} shimmerToken={undefined} className={collectionCardWidthClass} />
              <p className="text-xs text-foreground">{card.title}</p>
            </button>
          );
        })}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} size="sm" />
      <div className="flex justify-center gap-4">
        <Button size="lg" disabled={selectedIndex === null} onClick={() => { if (selectedIndex !== null) onSelect(selectedIndex); }}>Remove Card</Button>
      </div>
    </div>
  );
}

// Presents the card options generated by the controller for choose-card mystery effects.
export function CardChoicePicker({
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
              shimmerActive={false}
              shimmerToken={undefined}
              className={collectionCardWidthClass}
              wrapperClassName="stagger-item relative flex justify-center"
              wrapperStyle={{ "--stagger-index": i } as CSSProperties}
              selected={isSelected}
            />
          );
        })}
      </div>
      <Button size="lg" disabled={selectedId === null} onClick={() => { if (selectedId !== null) onSelect(selectedId); }}>Add Card</Button>
    </div>
  );
}

// Renders the event narrative, featured card art, and choice buttons with effect tooltips.
// Used as the initial state of the mystery screen before the player picks a choice.
export function MysteryEventIntro({
  event,
  findCard,
  findTrinket,
  onPick,
}: {
  event: MysteryEvent;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onPick: (choice: MysteryChoice) => void;
}) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;

  return (
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
                onClick={() => onPick(choice)}
              >
                {choice.label}
              </Button>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 translate-y-1 rounded-[16px] border border-border/80 bg-card px-3 py-2 text-left text-sm leading-6 text-muted-foreground opacity-0 transition-[opacity,transform] duration-150 ease-alchemy-out will-change-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <MysteryEffectList effects={choice.effects} findCard={findCard} findTrinket={findTrinket} choiceLabel={choice.label} />
              </div>
            </div>
          </BlurFade>
        ))}
      </div>
    </div>
  );
}
