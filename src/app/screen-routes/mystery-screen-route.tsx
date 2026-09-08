import { useEffect, useMemo, useRef } from "react";
import { useHeldWhile } from "@/features/alchemy/shared/ui/use-fade";
import { cardById, trinketById } from "@/features/alchemy/shared/config/game-data-catalog";
import { MysteryScreen, MysteryScreenShell } from "@/features/alchemy/run-loop/screens";
import { useMysteryScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunLoopCommands } from "./route-ctx";

const findCard = (id: string) => cardById[id];
const findTrinket = (id: string) => trinketById[id];

function useHeldMysteryVisit(r: ReturnType<typeof useMysteryScreenData>) {
  const isMysteryActive = Boolean(r.mysteryEvent);
  const liveVisit = useMemo(
    () =>
      isMysteryActive
        ? {
            event: r.mysteryEvent!,
            cardChoices: r.mysteryCardChoices,
            grantedTrinketIds: r.mysteryGrantedTrinketIds,
            grantedGearInstances: r.mysteryGrantedGearInstances,
            chosenCardId: r.mysteryChosenCardId,
            chosenChoice: r.mysteryChosenChoice,
            pendingRemoval: r.mysteryPendingRemoval,
          }
        : null,
    [
      isMysteryActive,
      r.mysteryEvent,
      r.mysteryCardChoices,
      r.mysteryGrantedTrinketIds,
      r.mysteryGrantedGearInstances,
      r.mysteryChosenCardId,
      r.mysteryChosenChoice,
      r.mysteryPendingRemoval,
    ],
  );
  return useHeldWhile(isMysteryActive, liveVisit);
}

export function MysteryScreenRoute({ commands }: { commands: RunLoopCommands["mystery"] }) {
  const r = useMysteryScreenData();
  const { handleContinue } = commands;

  const lastMysteryEventIdRef = useRef<string | null>(null);
  const autoContinueAttemptedRef = useRef<string | null | undefined>(undefined);
  const heldVisit = useHeldMysteryVisit(r);

  useEffect(() => {
    if (r.mysteryEvent) {
      if (lastMysteryEventIdRef.current !== r.mysteryEvent.id) {
        lastMysteryEventIdRef.current = r.mysteryEvent.id;
        autoContinueAttemptedRef.current = null;
      }
      return;
    }
    if (heldVisit) return;
    const visitId = lastMysteryEventIdRef.current;
    if (autoContinueAttemptedRef.current !== undefined && autoContinueAttemptedRef.current === visitId) return;
    autoContinueAttemptedRef.current = visitId;
    handleContinue();
  }, [r.mysteryEvent, heldVisit, handleContinue]);

  if (!heldVisit) {
    return <MysteryScreenShell />;
  }

  return (
    <MysteryScreen
      event={heldVisit.event}
      runDeck={r.runDeck}
      mysteryCardChoices={heldVisit.cardChoices}
      mysteryGrantedTrinketIds={heldVisit.grantedTrinketIds}
      mysteryGrantedGearInstances={heldVisit.grantedGearInstances}
      mysteryChosenCardId={heldVisit.chosenCardId}
      mysteryChosenChoice={heldVisit.chosenChoice}
      mysteryPendingRemoval={heldVisit.pendingRemoval}
      runTalentXP={r.runTalentXP}
      talentXP={r.talentXP}
      onChoose={commands.handleChoice}
      onChooseCard={commands.handleChooseCard}
      onRemoveCard={commands.handleRemoveCard}
      onContinue={commands.handleContinue}
      findCard={findCard}
      findTrinket={findTrinket}
    />
  );
}
