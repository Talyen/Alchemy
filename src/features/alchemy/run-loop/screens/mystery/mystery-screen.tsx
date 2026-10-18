import { text as gameText } from "@/lib/localization/runtime";
import { useGameTranslation } from "@/components/use-game-translation";

import { useMemo, useState, type ReactNode } from "react";
import { playUISound } from "@/lib/audio";
import type { BattleCard, KeywordId, TalentXP, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent, MysteryEffect } from "@/lib/mystery";

import { TitledScreenShell } from "../../../shared/ui/layout-components";
import { usePlasmaBaseline } from "../../../shared/ui/use-plasma-source";
import { getPlasmaColorPair } from "@/features/alchemy/shared/config";
import { FadeSlot } from "../../../shared/ui/use-fade";

import { CardChoicePicker } from "./mystery-deck-pickers";
import { MysteryRewardSummary } from "./mystery-reward-summary";
import { MysteryEventIntro } from "./mystery-event-intro";
import { choiceOffersCardSelection, getPlasmaKeywordsForMysteryReward } from "./mystery-choice-utils";

export function MysteryScreen({
  event,
  previewEffect,
  mysteryCardChoices,
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
  previewEffect?: ((effect: MysteryEffect) => MysteryEffect) | undefined;
  mysteryCardChoices: BattleCard[] | null;
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
  const i18n = useGameTranslation();
  const [error, setError] = useState(false);
  function handlePick(choice: MysteryChoice) {
    if (!onChoose(choice)) {
      setError(true);
      return;
    }
    setError(false);
    if (!choiceOffersCardSelection(choice) && choice.effects.length > 0) {
      playUISound("talentUnlock");
    }
  }

  function handleCardChoiceConfirm(cardId: string) {
    if (!onChooseCard(cardId)) {
      setError(true);
      return;
    }
    setError(false);
    if (mysteryChosenChoice && mysteryChosenChoice.effects.length > 0) {
      playUISound("talentUnlock");
    } else {
      onContinue();
    }
  }

  const phase = mysteryCardChoices ? "cards" : mysteryChosenChoice ? "summary" : "intro";
  const title = mysteryCardChoices ? "Choose a Card" : mysteryChosenChoice ? "Reward" : event.title;

  const plasmaKeywordIds = useMemo(() => {
    if (phase !== "summary" || !mysteryChosenChoice) return null;
    return getPlasmaKeywordsForMysteryReward({
      choice: mysteryChosenChoice,
      findCard,
      grantedGearInstances: mysteryGrantedGearInstances,
      chosenCardId: mysteryChosenCardId,
    });
  }, [phase, mysteryChosenChoice, findCard, mysteryGrantedGearInstances, mysteryChosenCardId]);

  return (
    <FadeSlot swapKey={`${event.id}:${phase}`} className="h-full w-full">
      <MysteryScreenShell title={i18n.displayText(title)} keywordIds={plasmaKeywordIds}>
        <div className="mt-6 flex w-full flex-col">
          {error && (
            <p role="alert" className="mb-4 text-center">
              {i18n.displayText("This choice is unavailable. Try again.")}
            </p>
          )}
          {mysteryCardChoices ? (
            <CardChoicePicker choices={mysteryCardChoices} onSelect={handleCardChoiceConfirm} />
          ) : mysteryChosenChoice ? (
            <MysteryRewardSummary
              choice={mysteryChosenChoice}
              findCard={findCard}
              findTrinket={findTrinket}
              grantedGearInstances={mysteryGrantedGearInstances}
              chosenCardId={mysteryChosenCardId}
              runTalentXP={runTalentXP}
              talentXP={talentXP}
              onContinue={onContinue}
            />
          ) : (
            <MysteryEventIntro
              event={event}
              previewEffect={previewEffect}
              findCard={findCard}
              findTrinket={findTrinket}
              onPick={handlePick}
            />
          )}
        </div>
      </MysteryScreenShell>
    </FadeSlot>
  );
}

export function MysteryScreenShell({
  title = gameText("ui.mystery-screen.default-title", "Mystery"),
  keywordIds,
  children,
}: {
  title?: string | undefined;
  keywordIds?: readonly KeywordId[] | null | undefined;
  children?: ReactNode | undefined;
}) {
  useGameTranslation();
  usePlasmaBaseline(keywordIds ? getPlasmaColorPair(keywordIds) : null);
  return <TitledScreenShell title={title}>{children}</TitledScreenShell>;
}
