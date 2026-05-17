// Mystery event screen — shows a random narrative event with choices.
// After choosing, transitions to a dedicated reward screen with victory
// sounds and visual summaries of all gains.
import { useState } from "react";
import { playVictory } from "@/lib/audio";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";

import type { MysteryChoice } from "../../mystery-events";
import { AnimatedHeight } from "../../ui/animated-height";
import {
  CardChoicePicker,
  RemoveCardPicker,
  MysteryRewardSummary,
  MysteryEventIntro,
  choiceOffersCardSelection,
  choiceRequiresCardRemoval,
  hasPositiveMysteryEffect,
} from "./parts";
import { useRunStore } from "../../stores/run-store";
import { useScreenStore } from "../../stores/screen-store";

export function MysteryScreen({
  onChoose,
  onChooseCard,
  onRemoveCard,
  onContinue,
  findCard,
  findTrinket,
}: {
  onChoose: (choice: MysteryChoice) => void;
  onChooseCard: (cardId: string) => void;
  onRemoveCard: (index: number) => void;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}) {
  const event = useScreenStore((s) => s.mysteryEvent)!;
  const runDeck = useRunStore((s) => s.runDeck);
  const mysteryCardChoices = useScreenStore((s) => s.mysteryCardChoices);
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MysteryChoice | null>(null);

  function handlePick(choice: MysteryChoice) {
    // Follow-up card/removal choices split state mutation from the reward screen: the
    // controller applies effects first, then this screen shows the picker or summary.
    if (choiceOffersCardSelection(choice)) {
      setChosen(choice);
      onChoose(choice);
      return;
    }

    onChoose(choice);

    if (choiceRequiresCardRemoval(choice)) {
      setPendingRemoval(choice);
    } else {
      setChosen(choice);
      if (hasPositiveMysteryEffect(choice.effects)) playVictory();
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
      if (hasPositiveMysteryEffect(choice.effects)) playVictory();
    }
  }

  function handleCardChoiceConfirm(cardId: string) {
    onChooseCard(cardId);
    playVictory();
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-6 text-center">
      <AnimatedHeight deps={[pendingRemoval, chosen, mysteryCardChoices]}>
        {mysteryCardChoices ? (
          <CardChoicePicker choices={mysteryCardChoices} onSelect={handleCardChoiceConfirm} />
        ) : pendingRemoval ? (
          <RemoveCardPicker runDeck={runDeck} onSelect={handleRemoveConfirm} />
        ) : chosen ? (
          <MysteryRewardSummary
            choice={chosen}
            runDeck={runDeck}
            findCard={findCard}
            findTrinket={findTrinket}
            onContinue={onContinue}
            eventTitle={event.title}
          />
        ) : (
          <MysteryEventIntro event={event} findCard={findCard} findTrinket={findTrinket} onPick={handlePick} />
        )}
      </AnimatedHeight>
    </div>
  );
}
