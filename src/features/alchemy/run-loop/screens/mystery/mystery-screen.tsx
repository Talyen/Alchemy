import { useMemo, useState, type ReactNode } from "react";
import { playUISound } from "@/lib/audio";
import type { BattleCard, KeywordId, TalentXP, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";

import { TitledScreenShell } from "../../../shared/ui/layout-components";
import { usePlasmaBaseline } from "../../../shared/ui/use-plasma-source";
import { getPlasmaColorPair } from "@/features/alchemy/shared/config";
import { FadeSlot } from "../../../shared/ui/use-fade";

import { CardChoicePicker } from "./mystery-deck-pickers";
import { MysteryRewardSummary } from "./mystery-reward-summary";
import { MysteryEventIntro } from "./mystery-event-intro";
import {
  choiceHasDisplayableSummary,
  choiceOffersCardSelection,
  getPlasmaKeywordsForMysteryReward,
  hasPositiveMysteryEffect,
} from "./mystery-choice-utils";

export function MysteryScreen({
  event,
  mysteryCardChoices,
  mysteryGrantedTrinketIds,
  mysteryGrantedGearInstances,
  mysteryChosenCardId,
  mysteryChosenChoice,
  runTalentXP = {},
  talentXP = {},
  onChoose,
  onChooseCard,
  onContinue,
  findCard,
  findTrinket,
}: {
  event: MysteryEvent;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
  mysteryChosenChoice: MysteryChoice | null;
  runTalentXP?: TalentXP;
  talentXP?: TalentXP;
  onChoose: (choice: MysteryChoice) => boolean;
  onChooseCard: (cardId: string) => boolean;
  onContinue: () => void;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}) {
  const [error, setError] = useState("");
  function handlePick(choice: MysteryChoice) {
    if (!onChoose(choice)) {
      setError("This choice is unavailable. Try again.");
      return;
    }
    setError("");
    if (!choiceOffersCardSelection(choice) && hasPositiveMysteryEffect(choice.effects)) {
      playUISound("talentUnlock");
    }
  }

  function handlePickerConfirm(confirm: () => boolean) {
    if (!confirm()) {
      setError("This choice is unavailable. Try again.");
      return;
    }
    setError("");
    if (mysteryChosenChoice && choiceHasDisplayableSummary(mysteryChosenChoice)) {
      if (hasPositiveMysteryEffect(mysteryChosenChoice.effects)) playUISound("talentUnlock");
    } else {
      onContinue();
    }
  }

  function handleCardChoiceConfirm(cardId: string) {
    handlePickerConfirm(() => onChooseCard(cardId));
  }

  const phase = mysteryCardChoices ? "cards" : mysteryChosenChoice ? "summary" : "intro";
  const title = mysteryCardChoices ? "Choose a Card" : mysteryChosenChoice ? "Reward" : event.title;

  const plasmaKeywordIds = useMemo(() => {
    if (phase !== "summary" || !mysteryChosenChoice) return null;
    return getPlasmaKeywordsForMysteryReward({
      choice: mysteryChosenChoice,
      findCard,
      grantedTrinketIds: mysteryGrantedTrinketIds,
      grantedGearInstances: mysteryGrantedGearInstances,
      chosenCardId: mysteryChosenCardId,
    });
  }, [
    phase,
    mysteryChosenChoice,
    findCard,
    mysteryGrantedTrinketIds,
    mysteryGrantedGearInstances,
    mysteryChosenCardId,
  ]);

  return (
    <FadeSlot swapKey={`${event.id}:${phase}`} className="h-full w-full">
      <MysteryScreenShell title={title} keywordIds={plasmaKeywordIds}>
        <div className="mt-6 flex w-full flex-col">
          {error && (
            <p role="alert" className="mb-4 text-center">
              {error}
            </p>
          )}
          {mysteryCardChoices ? (
            <CardChoicePicker choices={mysteryCardChoices} onSelect={handleCardChoiceConfirm} />
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
        </div>
      </MysteryScreenShell>
    </FadeSlot>
  );
}

export function MysteryScreenShell({
  title = "Mystery",
  keywordIds,
  children,
}: {
  title?: string | undefined;
  keywordIds?: readonly KeywordId[] | null | undefined;
  children?: ReactNode | undefined;
}) {
  usePlasmaBaseline(keywordIds ? getPlasmaColorPair(keywordIds) : null);
  return <TitledScreenShell title={title}>{children}</TitledScreenShell>;
}
