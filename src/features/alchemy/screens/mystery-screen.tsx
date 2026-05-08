// Mystery event screen — shows a random narrative event with choices.
// After choosing, transitions to a dedicated reward screen with victory
// sounds and visual summaries of all gains.
import { useState } from "react";
import type { CSSProperties } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { playUISound, playVictory } from "@/lib/audio";
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { keywordDefinitions, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { PaginationControls, ScreenHeader } from "../ui/shared-ui";
import { cardSurfaceClass, collectionCardWidthClass, handCardWidthClass, staticCardTransform } from "../config";
import type { MysteryEvent, MysteryChoice, MysteryEffect } from "../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";
import { AnimatedHeight } from "../ui/animated-height";
import { BattleCardButton, DetailPopup } from "../ui/card-ui";

function ChoiceDescription({ text }: { text: string }) {
  return (
    <p>
      {tokenizeDescription(text).map((part, index) => {
        const definition = part.keywordId ? keywordDefinitions[part.keywordId] : null;
        return definition ? (
          <span key={`${part.text}-${index}`} className={cn("font-semibold", definition.colorClass)}>{part.text}</span>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        );
      })}
    </p>
  );
}

function EffectResultText({ effect }: { effect: MysteryEffect }) {
  switch (effect.kind) {
    case "healHP": return <span>Restored {effect.amount} HP</span>;
    case "damageHP": return <span>Took {effect.amount} damage</span>;
    case "gainMaxMana": return <span>Gained +1 Mana Crystal</span>;
    case "gainXP": return <span>Gained {effect.amount} {effect.keyword} XP</span>;
    case "removeCard":
      return effect.mode === "random"
        ? <span>A card was removed from your deck</span>
        : <span>Select a card to remove</span>;
    case "none": return null;
    default: return null;
  }
}

function RewardScreen({
  choice,
  runDeck,
  findCard,
  findTrinket,
  onContinue,
}: {
  choice: MysteryChoice;
  runDeck: BattleCard[];
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onContinue: () => void;
}) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title="Reward" />

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
                  shimmerActive={false}
                  className={handCardWidthClass}
                />
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground">Added {card.title} to your Deck</p>
              </div>
            );
          }
          case "addRandomCard": {
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
                  shimmerActive={false}
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
                    <DetailPopup idPrefix={trinket.id} title={trinket.title} subtitle="Relic" descriptionLines={trinket.descriptionLines} />
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
          case "gainGold":
            return (
              <p key={i} className="inline-flex items-center gap-2 text-lg font-medium text-yellow-300">
                <Coins className="h-5 w-5" />
                Found {effect.amount} Gold
              </p>
            );
          case "none":
            return null;
          default:
            return (
              <p key={i} className="text-base text-muted-foreground">
                <EffectResultText effect={effect} />
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
      <div className="grid grid-cols-5 gap-3">
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
                shimmerActive={false}
                className={collectionCardWidthClass}
              />
              <p className="text-xs text-foreground">{card.title}</p>
            </button>
          );
        })}
        <PaginationControls page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} size="sm" />
      </div>
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

export function MysteryScreen({
  event,
  onChoose,
  onRemoveCard,
  onContinue,
  runDeck,
  findCard,
  findTrinket,
}: {
  event: MysteryEvent;
  onChoose: (choice: MysteryChoice) => void;
  onRemoveCard: (index: number) => void;
  onContinue: () => void;
  runDeck: BattleCard[];
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}) {
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MysteryChoice | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  function hasPositiveEffect(effects: MysteryEffect[]) {
    return effects.some((e) =>
      ["addCard", "addRandomCard", "gainTrinket", "healHP", "gainGold", "gainMaxMana", "gainXP"].includes(e.kind)
    );
  }
  function hasNegativeEffect(effects: MysteryEffect[]) {
    return effects.some((e) =>
      ["damageHP", "loseGold", "removeCard"].includes(e.kind)
    );
  }

  function handlePick(choice: MysteryChoice) {
    onChoose(choice);

    const isNone = choice.effects.every((e) => e.kind === "none");
    const needsRemoval = choice.effects.some((e) => e.kind === "removeCard" && e.mode === "choose");

    if (isNone) {
      onContinue();
      return;
    }

    if (needsRemoval) {
      setPendingRemoval(choice);
    } else {
      setChosen(choice);
      if (hasPositiveEffect(choice.effects)) playVictory();
      if (hasNegativeEffect(choice.effects)) playUISound("mysteryBad");
    }
  }

  function handleRemoveConfirm(index: number) {
    onRemoveCard(index);
    setPendingRemoval(null);
    if (!chosen) {
      const choice = pendingRemoval!;
      setChosen(choice);
      if (hasPositiveEffect(choice.effects)) playVictory();
      if (hasNegativeEffect(choice.effects)) playUISound("mysteryBad");
    }
  }

  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-6 text-center">
      <AnimatedHeight deps={[pendingRemoval, chosen]}>
        {pendingRemoval ? (
          <RemoveCardPicker
            runDeck={runDeck}
            onSelect={handleRemoveConfirm}
            onCancel={() => setPendingRemoval(null)}
          />
        ) : chosen ? (
          <RewardScreen choice={chosen} runDeck={runDeck} findCard={findCard} findTrinket={findTrinket} onContinue={onContinue} />
        ) : (
          <div className="state-swap flex flex-col items-center gap-6">
            {featuredCard ? (
              <BattleCardButton
                card={featuredCard}
                hovered={isHovered}
                onHoverStart={() => setHoveredCardId(event.id)}
                onHoverEnd={() => setHoveredCardId(null)}
                ariaLabel={featuredCard.title}
                shimmerActive={false}
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
                  className="block h-auto w-full rounded-[30px] aspect-[375/524]"
                  loading="eager"
                />
              </div>
            ) : null}
            <ScreenHeader title={event.title} />
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              {event.narrative}
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              {event.choices.map((choice, i) => (
                <div key={i} className="group relative">
                  <Button
                    size="lg"
                    variant="outline"
                    className="min-w-32"
                    onClick={() => handlePick(choice)}
                  >
                    {choice.label}
                  </Button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 translate-y-1 rounded-[16px] border border-border/80 bg-card px-3 py-2 text-left text-sm leading-6 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <ChoiceDescription text={choice.description} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatedHeight>
    </div>
  );
}
