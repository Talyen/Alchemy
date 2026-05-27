// Provides modular React subcomponents for the mystery screen: pickers, intro, and rewards.
// Depends on UI primitives, game constants, utility functions, and mystery types.
// Consumed exclusively by MysteryScreen to keep layout details separate from event flow.
/* eslint-disable react-refresh/only-export-components */
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { GoldPill, MaterialPill } from "../../ui/material-icons";

import { cardSurfaceClass, collectionTileWidthClass, viewCardWidthClass } from "../../config";
import type { MysteryChoice, MysteryEvent, MysteryEffect } from "../../mystery-events";
import { TiltSurface } from "../../ui/tilt-surface";
import { CardSelectionGrid } from "../../ui/card-selection-grid";
import { BattleCardButton, CardTitle, DetailPopup, getCardDisplayTitle } from "../../ui/card-ui";
import { MysteryEffectBadge, MysteryEffectList } from "../../ui/mystery-effect-badge";
import { ScreenDescription, ScreenHeader } from "../../ui/shared-ui";
import { TooltipPanel } from "../../ui/tooltip-panel";

type LookupProps = {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
};

// Sizing constants grouped into a config object.
const CONFIG = {
  EVENT_IMAGE_WIDTH: 900,
  EVENT_IMAGE_HEIGHT: 675,
};

/** True when any mystery effect is a net positive (card gain, heal, gold, materials, etc). */
export function hasPositiveMysteryEffect(effects: MysteryEffect[]) {
  return effects.some((e) =>
    [
      "addCard",
      "chooseCard",
      "gainTrinket",
      "gainRandomTrinket",
      "healHealth",
      "gainGold",
      "gainXP",
      "gainMaterial",
    ].includes(e.kind),
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

function renderFoundOrLost(effect: MysteryEffect, prefix: string) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
      {prefix}
      <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
    </div>
  );
}

// Renders a single consequence effect reward item. Encapsulates its own hover state.
function MysteryRewardEffectItem({
  effect,
  runDeck,
  findCard,
  findTrinket,
}: {
  effect: MysteryEffect;
  runDeck: BattleCard[];
} & LookupProps) {
  const [isHovered, setIsHovered] = useState(false);

  function renderCardReward(card: BattleCard) {
    return (
      <div className="flex flex-col items-center gap-3">
        <BattleCardButton
          card={card}
          hovered={isHovered}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          ariaLabel={getCardDisplayTitle(card)}
          shimmerActive={false}
          shimmerToken={undefined}
          className={viewCardWidthClass}
        />
        <p className="text-sm font-semibold text-foreground">
          <CardTitle card={card} />
        </p>
        <p className="text-sm text-muted-foreground">
          Added <CardTitle card={card} /> to your Deck
        </p>
      </div>
    );
  }

  const rewardRenderers: Record<string, () => ReactNode> = {
    addCard: () => {
      const card = findCard((effect as { cardId: string }).cardId);
      return card ? renderCardReward(card) : null;
    },
    chooseCard: () => {
      const card = runDeck[runDeck.length - 1];
      return card ? renderCardReward(card) : null;
    },
    gainTrinket: () => {
      const trinket = findTrinket((effect as { trinketId: string }).trinketId);
      if (!trinket) return null;
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            {isHovered ? (
              <DetailPopup
                idPrefix={trinket.id}
                title={trinket.title}
                subtitle={undefined}
                descriptionLines={trinket.descriptionLines}
              />
            ) : null}
            <TiltSurface className={cn(cardSurfaceClass, collectionTileWidthClass)}>
              <img
                src={trinket.art}
                alt={trinket.title}
                className="block w-full rounded-shell-hero aspect-square"
                loading="eager"
              />
            </TiltSurface>
          </div>
          <p className="text-sm font-semibold text-foreground">{trinket.title}</p>
          <p className="text-sm text-muted-foreground">Added {trinket.title} to your Inventory</p>
        </div>
      );
    },
    gainRandomTrinket: () => <p className="text-sm font-semibold text-foreground">Gained a random trinket</p>,
    gainGold: () => renderFoundOrLost(effect, "Found"),
    gainMaterial: () => renderFoundOrLost(effect, "Found"),
    loseGold: () => renderFoundOrLost(effect, "Lost"),
    removeCard: () => null,
    none: () => null,
  };

  const render =
    rewardRenderers[effect.kind] ??
    (() => (
      <p className="text-base text-muted-foreground">
        <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} />
      </p>
    ));

  return render();
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
  const resourceEffects = choice.effects.filter((e) => e.kind === "gainGold" || e.kind === "gainMaterial");
  const otherEffects = choice.effects.filter((e) => e.kind !== "gainGold" && e.kind !== "gainMaterial");

  const totalGold = resourceEffects
    .filter((e): e is typeof e & { kind: "gainGold" } => e.kind === "gainGold")
    .reduce((sum, e) => sum + e.amount, 0);

  const mats: Record<string, number> = {};
  for (const e of resourceEffects) {
    if (e.kind === "gainMaterial") {
      mats[e.material] = (mats[e.material] ?? 0) + e.amount;
    }
  }

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title={eventTitle} />

      {otherEffects.map((effect, i) => (
        <MysteryRewardEffectItem
          key={i}
          effect={effect}
          runDeck={runDeck}
          findCard={findCard}
          findTrinket={findTrinket}
        />
      ))}

      {resourceEffects.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          Found
          {totalGold > 0 ? <GoldPill amount={totalGold} /> : null}
          {MATERIAL_IDS.filter((mat) => mats[mat] > 0).map((mat) => (
            <MaterialPill key={mat} material={mat} amount={mats[mat]} />
          ))}
        </div>
      )}

      <Button size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

// Renders a single selectable item inside the card removal grid.
function RemoveCardGridItem({
  card,
  index,
  isSelected,
  onSelect,
}: {
  card: BattleCard;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors",
        isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent hover:border-border",
      )}
    >
      <BattleCardButton
        card={card}
        hovered={isSelected}
        onHoverStart={() => {}}
        onHoverEnd={() => {}}
        onClick={() => onSelect(index)}
        ariaLabel={`Select ${getCardDisplayTitle(card)}`}
        shimmerActive={false}
        shimmerToken={undefined}
        className={viewCardWidthClass}
      />
      <p className="text-sm font-semibold text-foreground">
        <CardTitle card={card} />
      </p>
    </div>
  );
}

// Lets the player choose the exact deck card removed by a mystery consequence.
export function RemoveCardPicker({ runDeck, onSelect }: { runDeck: BattleCard[]; onSelect: (index: number) => void }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const items = runDeck.map((card, index) => ({ card, index }));

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenDescription>Select a card to remove from your deck</ScreenDescription>
      <CardSelectionGrid
        items={items}
        page={page}
        onPageChange={setPage}
        pageSize={SELECTION_GRID_PAGE_SIZE}
        renderItem={({ card, index }) => (
          <RemoveCardGridItem
            card={card}
            index={index}
            isSelected={selectedIndex === index}
            onSelect={setSelectedIndex}
          />
        )}
      />
      <div className="flex justify-center gap-4">
        <Button
          size="lg"
          disabled={selectedIndex === null}
          onClick={() => {
            if (selectedIndex !== null) onSelect(selectedIndex);
          }}
        >
          Remove Card
        </Button>
      </div>
    </div>
  );
}

// Renders a single selectable item inside the choice card options grid.
function CardChoiceGridItem({
  card,
  isSelected,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onClick,
}: {
  card: BattleCard;
  isSelected: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}) {
  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onClick}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={viewCardWidthClass}
      selected={isSelected}
    />
  );
}

// Presents the card options generated by the controller for choose-card mystery effects.
export function CardChoicePicker({ choices, onSelect }: { choices: BattleCard[]; onSelect: (cardId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const items = choices.map((card, index) => ({ card, index }));

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title="Choose a Card" />
      <p className="text-base text-muted-foreground">Select one of the scrolls to add to your deck</p>
      <CardSelectionGrid
        items={items}
        page={0}
        onPageChange={() => {}}
        pageSize={choices.length}
        renderItem={({ card }) => (
          <CardChoiceGridItem
            card={card}
            isSelected={selectedId === card.id}
            isHovered={hoveredId === card.id}
            onHoverStart={() => setHoveredId(card.id)}
            onHoverEnd={() => setHoveredId(null)}
            onClick={() => setSelectedId(card.id)}
          />
        )}
      />
      <Button
        size="lg"
        disabled={selectedId === null}
        onClick={() => {
          if (selectedId !== null) onSelect(selectedId);
        }}
      >
        Add Card
      </Button>
    </div>
  );
}

// Renders a single choice button along with its absolute-positioned outcome tooltip.
function MysteryEventChoiceButton({
  choice,
  findCard,
  findTrinket,
  onPick,
}: {
  choice: MysteryChoice;
  onPick: (choice: MysteryChoice) => void;
} & LookupProps) {
  return (
    <div className="group relative">
      <Button
        size="lg"
        variant="outline"
        className="min-w-32"
        data-testid="mystery-choice"
        onClick={() => onPick(choice)}
      >
        {choice.label}
      </Button>
      {/* Tooltip displays consequence details on hover */}
      <TooltipPanel
        width="w-[23.7cqh]"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <MysteryEffectList
          effects={choice.effects}
          findCard={findCard}
          findTrinket={findTrinket}
          choiceLabel={choice.label}
          choiceDescription={choice.description}
        />
      </TooltipPanel>
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
      <ScreenHeader title={event.title} />
      {event.art ? (
        /* Image container applies interactive CSS tilt properties */
        <TiltSurface className="aspect-[4/3] w-full max-w-[32.59cqh] overflow-hidden rounded-shell-card transition-none">
          <img
            src={event.art}
            alt={event.title}
            width={CONFIG.EVENT_IMAGE_WIDTH}
            height={CONFIG.EVENT_IMAGE_HEIGHT}
            className="h-full w-full rounded-shell-card object-contain"
            loading="eager"
          />
        </TiltSurface>
      ) : featuredCard ? (
        <BattleCardButton
          card={featuredCard}
          hovered={isHovered}
          onHoverStart={() => setHoveredCardId(event.id)}
          onHoverEnd={() => setHoveredCardId(null)}
          ariaLabel={featuredCard.title}
          shimmerActive={false}
          shimmerToken={undefined}
          className={viewCardWidthClass}
        />
      ) : null}
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
          <MysteryEventChoiceButton
            key={i}
            choice={choice}
            findCard={findCard}
            findTrinket={findTrinket}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
