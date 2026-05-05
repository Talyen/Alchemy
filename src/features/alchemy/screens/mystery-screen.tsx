// Mystery event screen — shows a random narrative event with choices.
// After choosing, displays the concrete result (card added, HP restored, etc.) instead
// of a generic choice confirmation.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import type { MysteryEvent, MysteryChoice, MysteryEffect } from "../mystery-events";
import { BattleCardButton } from "../ui/card-ui";
import { handCardWidthClass } from "../config";

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

function ChoiceResult({ choice, findCard, onContinue }: { choice: MysteryChoice; findCard: (id: string) => BattleCard | undefined; onContinue: () => void }) {
  const addCardEffects = choice.effects.filter((e) => e.kind === "addCard");
  const otherEffects = choice.effects.filter((e) => e.kind !== "addCard");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-5">
      {addCardEffects.map((effect, i) => {
        if (effect.kind !== "addCard") return null;
        const card = findCard(effect.cardId);
        if (!card) return null;
        const isHovered = hoveredCardId === card.id;
        return (
          <div key={i} className="flex flex-col items-center gap-3">
            <div onMouseEnter={() => setHoveredCardId(card.id)} onMouseLeave={() => setHoveredCardId(null)}>
              <BattleCardButton card={card} hovered={isHovered} onHoverStart={() => setHoveredCardId(card.id)} onHoverEnd={() => setHoveredCardId(null)} ariaLabel={card.title} shimmerActive={false} className={handCardWidthClass} />
            </div>
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="text-sm text-muted-foreground">Added to your deck</p>
          </div>
        );
      })}
      {otherEffects.map((effect, i) => (
        <p key={i} className="text-base text-muted-foreground"><EffectResultText effect={effect} /></p>
      ))}
      <Button size="lg" onClick={onContinue}>Continue</Button>
    </div>
  );
}

export function MysteryScreen({
  event, onChoose, onContinue, findCard,
}: {
  event: MysteryEvent;
  onChoose: (choice: MysteryChoice) => void;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
}) {
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);

  function handlePick(choice: MysteryChoice) {
    onChoose(choice);
    setChosen(choice);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      {event.art ? <img src={event.art} alt={event.title} className="w-full max-w-[320px] rounded-[18px] object-contain" /> : null}
      <h1 className="text-4xl text-foreground">{event.title}</h1>
      <p className="max-w-lg text-base leading-relaxed text-muted-foreground">{event.narrative}</p>

      {!chosen ? (
        <div className="flex flex-wrap justify-center gap-4">
          {event.choices.map((choice, i) => (
            <Button key={i} size="lg" variant="outline" className="min-w-44 flex-col gap-1 py-4" onClick={() => handlePick(choice)}>
              <span className="text-sm font-semibold">{choice.label}</span>
              <span className="text-xs text-muted-foreground">{choice.description}</span>
            </Button>
          ))}
        </div>
      ) : (
        <ChoiceResult choice={chosen} findCard={findCard} onContinue={onContinue} />
      )}
    </div>
  );
}
