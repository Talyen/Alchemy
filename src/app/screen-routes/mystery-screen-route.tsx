import { useEffect, useRef } from "react";
import { useHeldWhile } from "@/features/alchemy/shared/ui/fade-presence";
import { cardById, trinketLibrary } from "@/features/alchemy/shared/config/game-data-catalog";
import { MysteryScreen, MysteryScreenShell } from "@/features/alchemy/run-loop/screens";
import { useMysteryScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunLoopCommands, RunLoopRouteCtx } from "./route-ctx";

export function MysteryScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["mystery"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useMysteryScreenData();
  const { handleContinue } = commands;
  const autoContinueAttemptedRef = useRef(false);
  const isMysteryActive = Boolean(r.mysteryEvent);
  const heldEvent = useHeldWhile(isMysteryActive, r.mysteryEvent);
  const heldCardChoices = useHeldWhile(isMysteryActive, r.mysteryCardChoices);
  const heldGrantedTrinketIds = useHeldWhile(isMysteryActive, r.mysteryGrantedTrinketIds);
  const heldGrantedGearInstances = useHeldWhile(isMysteryActive, r.mysteryGrantedGearInstances);
  const heldChosenCardId = useHeldWhile(isMysteryActive, r.mysteryChosenCardId);
  const heldChosenChoice = useHeldWhile(isMysteryActive, r.mysteryChosenChoice);
  const heldPendingRemoval = useHeldWhile(isMysteryActive, r.mysteryPendingRemoval);

  useEffect(() => {
    if (r.mysteryEvent || heldEvent) return;
    if (autoContinueAttemptedRef.current) return;
    autoContinueAttemptedRef.current = true;
    handleContinue();
  }, [r.mysteryEvent, heldEvent, handleContinue]);

  if (!heldEvent) {
    return <MysteryScreenShell onOpenMenu={onOpenBattleMenu} />;
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
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}
