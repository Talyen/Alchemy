// Focused mystery-screen subviews for rewards and follow-up choices.
// Depends on shared card/trinket UI and mystery effect badges.
// Used only by MysteryScreen to keep event flow separate from rendering details.
import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionCardWidthClass, handCardWidthClass, staticCardTransform } from "../config";
import type { MysteryChoice } from "../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { BattleCardButton, DetailPopup } from "../ui/card-ui";
import { MysteryEffectBadge } from "../ui/mystery-effect-badge";
import { PaginationControls, ScreenHeader } from "../ui/shared-ui";

type LookupProps = {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
};

// Renders the final consequence summary after the controller has already mutated run state.
export function RewardScreen({
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
                    <DetailPopup idPrefix={trinket.id} title={trinket.title} subtitle="Trinket" descriptionLines={trinket.descriptionLines} />
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
        <Button size="lg" variant="outline" onClick={onCancel}>Cancel</Button>
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
