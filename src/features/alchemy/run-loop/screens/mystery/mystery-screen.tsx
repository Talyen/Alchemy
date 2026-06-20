// Renders the mystery event UI, supporting narrative introduction, option picking,
// card choice/removal overlays, and the final reward summary.
// Depends on global run and screen Zustand stores, audio jingles, and sub-views in parts.tsx.
// Consumed by the screen routing system to display the Mystery event node.
import { useState } from "react";
import { playUISound } from "@/lib/audio";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";

import {
  CardChoicePicker,
  RemoveCardPicker,
  MysteryRewardSummary,
  MysteryEventIntro,
  choiceOffersCardSelection,
  choiceRequiresCardRemoval,
  hasPositiveMysteryEffect,
} from "./parts";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";

export function MysteryScreen({
  event,
  runDeck,
  mysteryCardChoices,
  onChoose,
  onChooseCard,
  onRemoveCard,
  onContinue,
  findCard,
  findTrinket,
}: {
  event: MysteryEvent;
  runDeck: BattleCard[];
  mysteryCardChoices: BattleCard[] | null;
  onChoose: (choice: MysteryChoice) => void;
  onChooseCard: (cardId: string) => void;
  onRemoveCard: (index: number) => void;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}) {
  // chosen: Stores the choice object to display on the final reward summary screen.
  const [chosen, setChosen] = useState<MysteryChoice | null>(null);

  // pendingRemoval: Holds the choice that requires the player to select a card to remove.
  // When non-null, prompts the card removal grid before showing the reward summary.
  const [pendingRemoval, setPendingRemoval] = useState<MysteryChoice | null>(null);

  // Triggered when a narrative choice button is clicked.
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
      // Play a positive reward sound effect if the outcome is net positive.
      if (hasPositiveMysteryEffect(choice.effects)) playUISound("talentUnlock");
    }
  }

  // Invoked after the user selects a card from the deck to remove.
  function handleRemoveConfirm(index: number) {
    // pendingRemoval is expected here because this path is reachable only after choosing
    // a remove-card event; after removal, resume the delayed result screen.
    onRemoveCard(index);
    setPendingRemoval(null);
    if (!chosen) {
      const choice = pendingRemoval!;
      setChosen(choice);
      if (hasPositiveMysteryEffect(choice.effects)) playUISound("talentUnlock");
    }
  }

  // Invoked after the user selects a card from the choice card picker.
  function handleCardChoiceConfirm(cardId: string) {
    onChooseCard(cardId);
    playUISound("talentUnlock");
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
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
    </div>
  );
}
