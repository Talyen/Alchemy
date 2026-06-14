// Shared run deck/boon mutations with compendium discovery tracking.
// Depends on game-data types and appendUnique helper.
import type { BattleCard } from "@/lib/game-data";
import { appendUnique } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";
import { useAppStore } from "../../shared/stores/app-store";

export function appendCardToRunWithDiscovery(
  card: BattleCard,
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>,
): void {
  setRunDeck((p) => [...p, card]);
  useAppStore.getState().setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
}

export function appendBoonToRunWithDiscovery(boonId: string, setRunBoons: Dispatch<SetStateAction<string[]>>): void {
  setRunBoons((p) => [...p, boonId]);
  useAppStore.getState().setDiscoveredBoonIds((cur) => appendUnique(cur, boonId));
}
