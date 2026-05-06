// Mystery event screen — shows a random narrative event with choices.
// After choosing Harvest, transitions to a dedicated reward screen (with victory
// sound) so the result is presented clearly without inline scrolling.
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, handCardWidthClass, staticCardTransform } from "../config";
import type { MysteryEvent, MysteryChoice, MysteryEffect } from "../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { BattleCardButton } from "../ui/card-ui";

function EffectResultText({ effect }: { effect: MysteryEffect }) {
  switch (effect.kind) {
    case "healHP": return <span>Restored {effect.amount} HP</span>;
    case "damageHP": return <span>Took {effect.amount} damage</span>;
    case "gainGold": return <span>Gained {effect.amount} Gold</span>;
    case "gainMaxMana": return <span>Max Mana increased</span>;
    case "none": return <span>You continue on your journey</span>;
    default: return null;
  }
}

function RewardScreen({
  choice,
  findCard,
  onContinue,
}: {
  choice: MysteryChoice;
  findCard: (id: string) => BattleCard | undefined;
  onContinue: () => void;
}) {
  const addCardEffects = choice.effects.filter((e) => e.kind === "addCard");
  const otherEffects = choice.effects.filter((e) => e.kind !== "addCard");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <h1 className="text-4xl text-foreground">Reward</h1>
      {addCardEffects.map((effect, i) => {
        if (effect.kind !== "addCard") return null;
        const card = findCard(effect.cardId);
        if (!card) return null;
        const isHovered = hoveredCardId === card.id;
        return (
          <div key={i} className="flex flex-col items-center gap-3">
            <BattleCardButton
              card={card}
              hovered={isHovered}
              onHoverStart={() => setHoveredCardId(card.id)}
              onHoverEnd={() => setHoveredCardId(null)}
              ariaLabel={card.title}
              shimmerActive={false}
              className={handCardWidthClass}
            />
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="text-sm text-muted-foreground">Added to your deck</p>
          </div>
        );
      })}
      {otherEffects.map((effect, i) => (
        <p key={i} className="text-base text-muted-foreground">
          <EffectResultText effect={effect} />
        </p>
      ))}
      <Button size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

export function MysteryScreen({
  event,
  onChoose,
  onContinue,
  findCard,
}: {
  event: MysteryEvent;
  onChoose: (choice: MysteryChoice) => void;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
}) {
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  function handlePick(choice: MysteryChoice) {
    onChoose(choice);
    setChosen(choice);
    if (choice.effects.some((e) => e.kind === "addCard")) {
      playUISound("mysteryGood");
    }
  }

  if (chosen) {
    return <RewardScreen choice={chosen} findCard={findCard} onContinue={onContinue} />;
  }

  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-6 text-center">
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
      <h1 className="text-4xl text-foreground">{event.title}</h1>
      <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
        {event.narrative}
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        {event.choices.map((choice, i) => (
          <Button
            key={i}
            size="lg"
            variant="outline"
            className="min-w-32"
            onClick={() => handlePick(choice)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
