// Mystery event screen — shows a random narrative event with choices.
// After choosing, transitions to a dedicated reward screen with victory
// sounds and visual summaries of all gains.
import { useState } from "react";
import type { CSSProperties } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { playVictory } from "@/lib/audio";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { ScreenHeader } from "../ui/shared-ui";
import { cardSurfaceClass, handCardWidthClass, staticCardTransform } from "../config";
import { MysteryEffectList } from "../ui/mystery-effect-badge";
import type { MysteryEvent, MysteryChoice, MysteryEffect } from "../mystery-events";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { AnimatedHeight } from "../ui/animated-height";
import { BattleCardButton } from "../ui/card-ui";
import { CardChoicePicker, RemoveCardPicker, RewardScreen } from "./mystery-screen-parts";

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
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 translate-y-1 rounded-[16px] border border-border/80 bg-card px-3 py-2 text-left text-sm leading-6 text-muted-foreground opacity-0 transition-[opacity,transform] duration-150 ease-alchemy-out will-change-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <MysteryEffectList effects={choice.effects} findCard={findCard} findTrinket={findTrinket} choiceLabel={choice.label} />
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
