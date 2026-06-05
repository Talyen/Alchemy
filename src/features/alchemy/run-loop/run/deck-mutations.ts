// Shared run deck/trinket mutations with compendium discovery tracking.
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

export function appendTrinketToRunWithDiscovery(
  trinketId: string,
  setRunTrinkets: Dispatch<SetStateAction<string[]>>,
): void {
  setRunTrinkets((p) => [...p, trinketId]);
  useAppStore.getState().setDiscoveredTrinketIds((cur) => appendUnique(cur, trinketId));
}
