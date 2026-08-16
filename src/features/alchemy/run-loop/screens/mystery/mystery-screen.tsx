// Renders the mystery event UI, supporting narrative introduction, option picking,
// card choice/removal overlays, and the final reward summary.
// Depends on global run and screen Zustand stores, audio jingles, and sub-views in parts.tsx.
// Consumed by the screen routing system to display the Mystery event node.
import type { ReactNode } from "react";
import { playUISound } from "@/lib/audio";
import type { BattleCard, TalentXP, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";

import { ScreenDescription, TitledScreenShell } from "../../../shared/ui/shared-ui";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { RemoveCardPanel } from "../../../shared/ui/remove-card-panel";

import {
  CardChoicePicker,
  MysteryRewardSummary,
  MysteryEventIntro,
  choiceOffersCardSelection,
  choiceRequiresCardRemoval,
  choiceHasDisplayableSummary,
  hasPositiveMysteryEffect,
} from "./parts";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";

export function MysteryScreen({
  event,
  runDeck,
  mysteryCardChoices,
  mysteryGrantedTrinketIds,
  mysteryGrantedGearInstances,
  mysteryChosenCardId,
  mysteryChosenChoice,
  mysteryPendingRemoval,
  runTalentXP = {},
  talentXP = {},
  onChoose,
  onChooseCard,
  onRemoveCard,
  onContinue,
  findCard,
  findTrinket,
  onOpenMenu,
}: {
  event: MysteryEvent;
  runDeck: BattleCard[];
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  runTalentXP?: TalentXP;
  talentXP?: TalentXP;
  onChoose: (choice: MysteryChoice) => void;
  onChooseCard: (cardId: string) => void;
  onRemoveCard: (index: number) => void;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  function handlePick(choice: MysteryChoice) {
    onChoose(choice);
    if (
      !choiceOffersCardSelection(choice) &&
      !choiceRequiresCardRemoval(choice) &&
      hasPositiveMysteryEffect(choice.effects)
    ) {
      playUISound("talentUnlock");
    }
  }

  function handleRemoveConfirm(index: number) {
    onRemoveCard(index);
    if (mysteryChosenChoice && choiceHasDisplayableSummary(mysteryChosenChoice)) {
      if (hasPositiveMysteryEffect(mysteryChosenChoice.effects)) playUISound("talentUnlock");
    } else {
      onContinue();
    }
  }

  function handleCardChoiceConfirm(cardId: string) {
    onChooseCard(cardId);
    playUISound("talentUnlock");
  }

  const phase = mysteryCardChoices
    ? "cards"
    : mysteryPendingRemoval
      ? "remove"
      : mysteryChosenChoice
        ? "summary"
        : "intro";
  const title = mysteryCardChoices
    ? "Choose a Card"
    : mysteryPendingRemoval
      ? "Remove a Card"
      : mysteryChosenChoice
        ? "Reward"
        : event.title;

  return (
    <MysteryScreenShell title={title} onOpenMenu={onOpenMenu}>
      <FadeSlot swapKey={phase} className="mt-6 flex min-h-[56cqh] w-full flex-col">
        {mysteryCardChoices ? (
          <CardChoicePicker choices={mysteryCardChoices} onSelect={handleCardChoiceConfirm} />
        ) : mysteryPendingRemoval ? (
          <RemoveCardPanel
            runDeck={runDeck}
            intro={<ScreenDescription>Select a card to remove from your deck</ScreenDescription>}
            onConfirm={handleRemoveConfirm}
          />
        ) : mysteryChosenChoice ? (
          <MysteryRewardSummary
            choice={mysteryChosenChoice}
            findCard={findCard}
            findTrinket={findTrinket}
            grantedTrinketIds={mysteryGrantedTrinketIds}
            grantedGearInstances={mysteryGrantedGearInstances}
            chosenCardId={mysteryChosenCardId}
            runTalentXP={runTalentXP}
            talentXP={talentXP}
            onContinue={onContinue}
          />
        ) : (
          <MysteryEventIntro event={event} findCard={findCard} findTrinket={findTrinket} onPick={handlePick} />
        )}
      </FadeSlot>
    </MysteryScreenShell>
  );
}

export function MysteryScreenShell({
  title = "Mystery",
  onOpenMenu,
  children,
}: {
  title?: string;
  onOpenMenu: (rect?: DOMRect) => void;
  children?: ReactNode;
}) {
  return (
    <TitledScreenShell title={title} onOpenMenu={onOpenMenu} menuLabel="Open mystery menu">
      {children}
    </TitledScreenShell>
  );
}
