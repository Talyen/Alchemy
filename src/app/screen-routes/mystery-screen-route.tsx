import { useEffect, useRef } from "react";
import { useHeldWhile } from "@/features/alchemy/shared/ui/fade-presence";
import { cardById, trinketById } from "@/features/alchemy/shared/config/game-data-catalog";
import { MysteryScreen, MysteryScreenShell } from "@/features/alchemy/run-loop/screens";
import { useMysteryScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunLoopCommands } from "./route-ctx";

function useHeldMysteryVisit(r: ReturnType<typeof useMysteryScreenData>) {
  const isMysteryActive = Boolean(r.mysteryEvent);
  return {
    heldEvent: useHeldWhile(isMysteryActive, r.mysteryEvent),
    heldCardChoices: useHeldWhile(isMysteryActive, r.mysteryCardChoices),
    heldGrantedTrinketIds: useHeldWhile(isMysteryActive, r.mysteryGrantedTrinketIds),
    heldGrantedGearInstances: useHeldWhile(isMysteryActive, r.mysteryGrantedGearInstances),
    heldChosenCardId: useHeldWhile(isMysteryActive, r.mysteryChosenCardId),
    heldChosenChoice: useHeldWhile(isMysteryActive, r.mysteryChosenChoice),
    heldPendingRemoval: useHeldWhile(isMysteryActive, r.mysteryPendingRemoval),
    isMysteryActive,
  };
}

export function MysteryScreenRoute({ commands }: { commands: RunLoopCommands["mystery"] }) {
  const r = useMysteryScreenData();
  const { handleContinue } = commands;

  const lastMysteryEventIdRef = useRef<string | null>(null);
  const autoContinueAttemptedRef = useRef<string | null | undefined>(undefined);
  const {
    heldEvent,
    heldCardChoices,
    heldGrantedTrinketIds,
    heldGrantedGearInstances,
    heldChosenCardId,
    heldChosenChoice,
    heldPendingRemoval,
  } = useHeldMysteryVisit(r);

  useEffect(() => {
    if (r.mysteryEvent) {
      if (lastMysteryEventIdRef.current !== r.mysteryEvent.id) {
        lastMysteryEventIdRef.current = r.mysteryEvent.id;
        autoContinueAttemptedRef.current = null;
      }
      return;
    }
    if (heldEvent) return;
    const visitId = lastMysteryEventIdRef.current;
    if (autoContinueAttemptedRef.current !== undefined && autoContinueAttemptedRef.current === visitId) return;
    autoContinueAttemptedRef.current = visitId;
    handleContinue();
  }, [r.mysteryEvent, heldEvent, handleContinue]);

  if (!heldEvent) {
    return <MysteryScreenShell />;
  }

  return (
    <MysteryScreen
      event={heldEvent}
      runDeck={r.runDeck}
      mysteryCardChoices={heldCardChoices}
      mysteryGrantedTrinketIds={heldGrantedTrinketIds}
      mysteryGrantedGearInstances={heldGrantedGearInstances}
      mysteryChosenCardId={heldChosenCardId}
      mysteryChosenChoice={heldChosenChoice}
      mysteryPendingRemoval={heldPendingRemoval}
      runTalentXP={r.runTalentXP}
      talentXP={r.talentXP}
      onChoose={commands.handleChoice}
      onChooseCard={commands.handleChooseCard}
      onRemoveCard={commands.handleRemoveCard}
      onContinue={commands.handleContinue}
      findCard={(id) => cardById[id]}
      findTrinket={(id) => trinketById[id]}
    />
  );
}
